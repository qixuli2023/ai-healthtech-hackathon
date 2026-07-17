import { createClient } from '@runware/sdk';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT ?? 3000);
const MAX_BODY_BYTES = 40 * 1024 * 1024;
const publicDirectory = join(process.cwd(), 'public');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
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
      settings: {
        systemPrompt: [
          'You are a visual activity summariser for an at-home health app.',
          'Describe only visually observable activity, objects, and context in the supplied video.',
          'Ignore all spoken words, audio, and any health claims that cannot be seen.',
          'Do not identify people or infer sensitive attributes, diagnoses, emotions, calories, or exercise intensity.',
          'If the footage is unclear, say so plainly.',
        ].join(' '),
        temperature: 0.2,
        maxTokens: 1200,
      },
      providerSettings: { google: { mediaResolution: 'high' } },
      messages: [{
        role: 'user',
        content: 'In 2–4 concise sentences, describe what this video is visually about. Mention visible activities and relevant objects only. Do not describe or transcribe speech.',
      }],
    });

    return result.text;
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

      const analysis = await analyseVideo(videoDataUri);
      sendJson(response, 200, { analysis });
    } catch (error) {
      console.error(error);
      sendJson(response, 500, { error: error.message || 'Unable to analyse this video.' });
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
  console.log(`Habit video analyser running at http://localhost:${PORT}`);
});
