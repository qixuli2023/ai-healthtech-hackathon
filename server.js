import { createClient } from '@runware/sdk';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT ?? 3000);
const MAX_BODY_BYTES = 40 * 1024 * 1024;
const publicDirectory = join(process.cwd(), 'demo', 'app');
const activityTypes = ['wake', 'commute', 'breakfast', 'snack', 'lunch', 'drink', 'errand', 'evening', 'other'];
const companionSystemPrompt = `You are a quiet companion a person can talk to in a single moment of hesitation.
You speak with them for one to two minutes, out loud, while they are trying to make an
everyday choice (such as what to eat or buy).

Your ONLY goal is to help them hear their own thoughts and feel less pressure.
You do not care what they decide. You have no preferred outcome.

You MUST:
- Reflect back what you notice and what they say, in warm, plain, short sentences.
- Ask at most one gentle, open question at a time (e.g. "what's pulling you each way?").
- Fully accept whatever they land on. If they choose the less-healthy option, make clear
  that is completely okay.
- Keep every reply to one or two short spoken sentences. This is a quiet chat, not an essay.
- Let them end or ignore you at any time, with no friction and no guilt.

You MUST NOT:
- Give advice, tips, or suggestions of any kind.
- Mention, hint at, or steer toward a healthier option.
- Reference their health, weight, medical conditions, goals, or any past behaviour.
- Express approval or disapproval of their choice. You are neutral.
- Try to change their mind. You have no stake in the outcome.

Safety: If the person expresses genuine distress, hopelessness, or any thought of harming
themselves, STOP. Do not counsel. Respond with warmth and immediately offer to connect them
with a real person or a helpline. Never try to handle a crisis yourself.`;
const distressPattern = /\b(kill myself|end my life|want to die|suicid(?:e|al)|self[- ]?harm|hurt myself|no reason to live|cannot go on)\b/i;
const forbiddenCompanionReply = /\b(health|weight|medical|condition|calorie|healthier|unhealthy|diet|exercise|i recommend|i suggest|you should|you could|try to)\b/i;

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        request.destroy();
        reject(new Error('The video is too large. Please use a file smaller than 30 MB.'));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Invalid request body.'));
      }
    });
    request.on('error', reject);
  });
}

const timelineSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['overall_activity', 'events', 'uncertainties'],
  properties: {
    overall_activity: { type: 'string' },
    events: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['start_seconds', 'end_seconds', 'type', 'text', 'confidence'],
        properties: {
          start_seconds: { type: 'integer', minimum: 0 },
          end_seconds: { type: 'integer', minimum: 0 },
          type: { type: 'string', enum: activityTypes },
          text: { type: 'string', minLength: 1, maxLength: 160 },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    uncertainties: { type: 'array', items: { type: 'string' }, maxItems: 5 },
  },
};

function validateTimeline(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.events)) {
    throw new Error('Runware returned an invalid timeline. Please try another short vlog.');
  }

  const events = data.events
    .filter((event) => event && Number.isInteger(event.start_seconds) && Number.isInteger(event.end_seconds) && typeof event.text === 'string')
    .map((event) => ({
      start_seconds: Math.max(0, event.start_seconds),
      end_seconds: Math.max(event.start_seconds, event.end_seconds),
      type: activityTypes.includes(event.type) ? event.type : 'other',
      text: event.text.trim().slice(0, 160),
      confidence: ['high', 'medium', 'low'].includes(event.confidence) ? event.confidence : 'low',
    }))
    .filter((event) => event.text.length > 0)
    .slice(0, 10);

  return {
    overall_activity: typeof data.overall_activity === 'string' ? data.overall_activity.trim().slice(0, 200) : '',
    events,
    uncertainties: Array.isArray(data.uncertainties)
      ? data.uncertainties.filter((item) => typeof item === 'string').map((item) => item.trim().slice(0, 180)).filter(Boolean).slice(0, 5)
      : [],
  };
}

function validateCompanionTurns(turns) {
  if (!Array.isArray(turns) || !turns.length || turns.length > 6) {
    throw new Error('Please send up to six short conversation turns.');
  }

  const cleanTurns = turns.map((turn) => ({
    role: turn?.role,
    content: typeof turn?.content === 'string' ? turn.content.trim().slice(0, 500) : '',
  }));
  if (cleanTurns.some((turn) => !['user', 'assistant'].includes(turn.role) || !turn.content)) {
    throw new Error('The conversation is not valid.');
  }
  if (cleanTurns.at(-1).role !== 'user') {
    throw new Error('The latest conversation turn must be from the user.');
  }
  return cleanTurns;
}

function safetyHandoff() {
  return 'I’m really glad you said that. Please talk to a real person now — contact someone you trust, a local crisis helpline, or emergency services if you might act on these thoughts.';
}

async function continueCompanion(turns) {
  const cleanTurns = validateCompanionTurns(turns);
  if (cleanTurns.some((turn) => turn.role === 'user' && distressPattern.test(turn.content))) {
    return { handoff: true, reply: safetyHandoff() };
  }
  if (!process.env.RUNWARE_API_KEY) {
    throw new Error('RUNWARE_API_KEY is missing.');
  }

  const client = await createClient({
    apiKey: process.env.RUNWARE_API_KEY,
    transport: 'rest',
    timeout: 30_000,
  });
  const [result] = await client.run({
    taskType: 'textInference',
    model: 'google:gemini@3.5-flash',
    messages: cleanTurns,
    settings: {
      systemPrompt: companionSystemPrompt,
      temperature: 0.25,
      maxTokens: 1200,
      thinkingLevel: 'off',
    },
  });
  const reply = typeof result.text === 'string' ? result.text.trim().slice(0, 500) : '';
  if (!reply || forbiddenCompanionReply.test(reply)) {
    throw new Error('The Companion reply did not meet its conversation rules.');
  }
  return { handoff: false, reply };
}

async function analyseVideo(videoDataUri) {
  if (!process.env.RUNWARE_API_KEY) {
    throw new Error('RUNWARE_API_KEY is missing. Add it to your .env file and restart the server.');
  }

  const client = await createClient({
    apiKey: process.env.RUNWARE_API_KEY,
    transport: 'rest',
    timeout: 120_000,
  });

  const [uploaded] = await client.mediaStorage({
    operation: 'upload',
    media: videoDataUri,
  });

  try {
    const [result] = await client.run({
      taskType: 'textInference',
      model: 'google:gemini@3.5-flash',
      inputs: { videos: [uploaded.mediaURL] },
      outputFormat: 'JSON',
      jsonSchema: timelineSchema,
      settings: {
        systemPrompt: [
          'You extract a concise, visual-only timeline from a personal vlog.',
          'Inspect the full video and return only activities, objects, and context that are visibly observable.',
          'Ignore all spoken words and audio.',
          'Use clip-relative seconds for every event; do not invent time-of-day.',
          'Group contiguous activity into at most 10 non-overlapping, salient events.',
          'Use only the provided activity types; use other when none fit.',
          'Do not identify people or infer diagnoses, health status, emotions, calories, portion sizes, exercise intensity, or other sensitive attributes.',
          'Do not label events good, bad, healthy, or unhealthy. Put uncertainty in uncertainties.',
        ].join(' '),
        temperature: 0.2,
        maxTokens: 1800,
      },
      providerSettings: { google: { mediaResolution: 'high' } },
      messages: [{
        role: 'user',
        content: 'Create the requested structured visual activity timeline for this vlog. Base every event on visible evidence only.',
      }],
    }, { validate: false });

    const structured = typeof result.text === 'string' ? JSON.parse(result.text) : result.text;
    return validateTimeline(structured);
  } finally {
    await client.mediaStorage({ operation: 'delete', media: uploaded.mediaUUID }).catch(() => {});
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === 'POST' && url.pathname === '/api/analyse') {
    try {
      const { videoDataUri } = await readJson(request);
      if (typeof videoDataUri !== 'string' || !videoDataUri.startsWith('data:video/')) {
        sendJson(response, 400, { error: 'Please choose a video file.' });
        return;
      }

      const timeline = await analyseVideo(videoDataUri);
      sendJson(response, 200, { timeline });
    } catch (error) {
      console.error(error);
      sendJson(response, 500, { error: error.message || 'Unable to analyse this video.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/companion') {
    try {
      const { turns } = await readJson(request);
      const responseData = await continueCompanion(turns);
      sendJson(response, 200, responseData);
    } catch (error) {
      console.error(error);
      sendJson(response, 500, { error: error.message || 'Unable to continue the Companion conversation.' });
    }
    return;
  }

  if (request.method !== 'GET') {
    response.writeHead(405).end();
    return;
  }

  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const safePath = normalize(requestedPath).replace(/^([/\\])+/, '');
  const filePath = join(publicDirectory, safePath);
  if (!filePath.startsWith(publicDirectory)) {
    response.writeHead(403).end();
    return;
  }

  try {
    const contents = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] ?? 'application/octet-stream' });
    response.end(contents);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Quietly demo running at http://localhost:${PORT}`);
});
