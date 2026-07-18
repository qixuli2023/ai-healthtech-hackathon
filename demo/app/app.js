const app = document.querySelector('#app');
const storageKey = 'quietly-demo-state';
let sourceDay;

// Clear state created by earlier demo versions so the latest onboarding is shown.
localStorage.removeItem('quietly-demo-state-v1');
localStorage.removeItem('quietly-demo-state-v2');

const iconByType = {
  wake: '⌁', commute: '↗', breakfast: '◒', snack: '◇', lunch: '⊹', drink: '◌', errand: '□', evening: '☾'
};

const companionTurns = [
  { role: 'companion', text: 'Looks like you’re going back and forth — want to talk it through?' },
  { role: 'user', text: 'Yeah. I really want that cake, but I feel like I shouldn’t.' },
  { role: 'companion', text: 'Sounds like you genuinely want it today. Rough day, or something else?' },
  { role: 'user', text: 'Today was just bad.' },
  { role: 'companion', text: 'Yeah. If you want it just to feel a bit better — that’s completely okay.' }
];

async function initialise() {
  sourceDay = await fetch('data/day.json').then((response) => {
    if (!response.ok) throw new Error('Could not load the demo day.');
    return response.json();
  });
  const savedState = localStorage.getItem(storageKey);
  if (!savedState) {
    saveState(defaultState());
  } else {
    const saved = JSON.parse(savedState);
    saveState({
      ...defaultState(),
      ...saved,
      companionSessionTurns: Array.isArray(saved.companionSessionTurns) ? saved.companionSessionTurns : [],
      uploadedUncertainties: Array.isArray(saved.uploadedUncertainties) ? saved.uploadedUncertainties : [],
    });
  }
  render();
}

function defaultState() {
  return {
    onboardingComplete: false,
    conditions: [],
    tone: 'Gentle',
    moment: 'morning',
    recording: true,
    showDemoTimeline: false,
    companionSeen: false,
    companionSessionTurns: [],
    companionFallback: false,
    companionStatus: '',
    companionHandoff: false,
    uploadedEvents: null,
    uploadedSummary: '',
    uploadedUncertainties: [],
    isAnalysingVlog: false,
    videoStatus: '',
    videoError: '',
    events: structuredClone(sourceDay.events),
    prefs: structuredClone(sourceDay.prefs),
    dismissedMorning: false,
    feedback: ''
  };
}

function state() { return JSON.parse(localStorage.getItem(storageKey)); }
function saveState(next) { localStorage.setItem(storageKey, JSON.stringify(next)); }
function mutate(update) { const next = state(); update(next); saveState(next); render(); }

function render() {
  const current = state();
  const route = location.hash.replace('#', '') || (current.onboardingComplete ? 'today' : 'onboarding');
  if (route === 'timeline' && current.onboardingComplete) renderTimeline(current);
  else if (route === 'companion' && current.onboardingComplete) renderCompanion(current);
  else if (route === 'today' && current.onboardingComplete) renderToday(current);
  else renderOnboarding(current);
}

function renderOnboarding(current) {
  app.innerHTML = `
    <section class="screen onboarding">
      <span class="wordmark">quietly</span>
      <h1>What would you like to feel a bit better about?</h1>
      <p class="soft-copy">No pressure. Just the small things that matter to you.</p>
      <span class="choice-label">What type of chronic condition are you experiencing?</span>
      <div class="chips" id="conditions">
        ${['Obesity', 'Cardiovascular', 'Diabetes and metabolic', 'Cancer'].map((condition) => conditionChip(condition, current.conditions.includes(condition))).join('')}
      </div>
      <span class="choice-label">How should I sound?</span>
      <div class="chips" id="tones">
        ${['Gentle', 'Cheerful', 'Straight-talking'].map((tone) => `<button class="chip ${current.tone === tone ? 'selected' : ''}" data-tone="${tone}">${tone}</button>`).join('')}
      </div>
      <div class="onboarding-footer">
        <button class="skip" data-action="skip">Skip</button>
        <button class="outline-button" data-action="start">Start ☺</button>
      </div>
    </section>`;
}

function conditionChip(condition, selected) {
  return `<button class="chip ${selected ? 'selected' : ''}" data-condition="${condition}">${condition}</button>`;
}

function renderToday(current) {
  const card = current.moment === 'morning' ? morningCard(current) : eveningCard(current);
  app.innerHTML = `
    <section class="screen">
      <div class="topline">
        <span class="wordmark">quietly</span>
        <div class="header-links">
          <button class="heart-notification" data-action="open-companion" aria-label="Open Companion conversation">♡${current.companionSeen ? '' : '<span class="notification-count">1</span>'}</button>
          <button class="text-button" data-route="timeline">today I saw…</button>
        </div>
      </div>
      <div class="time-toggle" aria-label="Demo current moment">
        <button class="${current.moment === 'morning' ? 'active' : ''}" data-moment="morning">Morning ☀</button>
        <button class="${current.moment === 'evening' ? 'active' : ''}" data-moment="evening">Evening ☾</button>
      </div>
      <p class="day-label">demo current moment · ${current.moment}</p>
      ${card}
      <p class="feedback">${current.feedback}</p>
      <p class="source-note">Only moments you can see in <button class="text-button" data-route="timeline">Today I saw…</button> shape these cards.</p>
    </section>`;
}

function renderCompanion(current) {
  const turns = current.companionFallback ? companionTurns : current.companionSessionTurns;
  const atTurnLimit = current.companionSessionTurns.filter((turn) => turn.role === 'companion').length >= 4;
  const conversation = turns.length
    ? turns.map((turn) => `<div class="chat-row ${turn.role}"><p class="chat-bubble">${escapeHtml(turn.text)}</p></div>`).join('')
    : '<p class="companion-invite">Looks like you’re going back and forth — want to talk it through?</p>';
  const canSend = !current.companionFallback && !current.companionHandoff && !current.companionStatus && !atTurnLimit;
  app.innerHTML = `
    <section class="screen companion-screen">
      <div class="topline">
        <span class="wordmark">quietly</span>
        <button class="text-button" data-route="today">back to today</button>
      </div>
      <p class="eyebrow">companion</p>
      <h2>A moment to talk it through</h2>
      <div class="conversation" aria-label="Companion conversation">
        ${conversation}
      </div>
      <p class="companion-status">${escapeHtml(current.companionStatus)}</p>
      ${canSend ? `<form class="companion-compose" id="companion-form"><input id="companion-input" maxlength="500" autocomplete="off" placeholder="Say what’s on your mind…" aria-label="Your message" required /><button class="outline-button" type="submit">Send</button></form>` : ''}
      ${current.companionFallback ? '<p class="companion-fallback-note">Showing the offline demo conversation.</p><button class="text-button" data-action="retry-companion">try live chat again</button>' : ''}
      <div class="companion-footer"><button class="text-button" data-action="end-companion">end chat</button></div>
    </section>`;
}

function morningCard(current) {
  if (current.dismissedMorning) {
    return `<article class="index-card"><span class="card-kicker">A quiet morning</span><p class="card-copy">No lunch ideas from me today. Your call ☺</p></article>`;
  }
  const hasLunchPattern = current.events.some((event) => event.type === 'lunch');
  const favourite = current.prefs.likes.find((like) => like === 'ramen') || current.prefs.likes[0];
  const goalHint = 'Take it at your own pace.';
  const opener = current.tone === 'Cheerful' ? 'A small idea for today:' : current.tone === 'Straight-talking' ? 'One easy option today:' : 'Today, you might enjoy…';
  const copy = hasLunchPattern
    ? `${opener} if lunch is out, that ${favourite} place is your kind of thing — with a little walk if it feels good. ${goalHint}`
    : `${opener} keep it close to the things you already like. ${goalHint}`;
  return `<article class="index-card">
    <span class="card-kicker">Morning</span>
    <p class="card-copy">${copy}</p>
    <div class="reply-row">
      <button class="reply-button" data-reply="try">I’ll try ☺</button>
      <button class="reply-button" data-reply="not-today">Not today</button>
      <button class="reply-button" data-reply="not-for-me">Not for me</button>
    </div>
  </article>`;
}

function eveningCard(current) {
  const goodEvents = current.events.filter((event) => event.good).slice(0, 3);
  const closer = current.tone === 'Cheerful' ? 'that all counts ☺' : current.tone === 'Straight-talking' ? 'quiet wins.' : 'nice one ☺';
  if (!goodEvents.length) {
    return `<article class="index-card"><span class="card-kicker">Evening</span><p class="card-copy">Nothing to add tonight. Just your day, as it was.</p></article>`;
  }
  return `<article class="index-card">
    <span class="card-kicker">Today you quietly…</span>
    <ul class="praise-list">${goodEvents.map((event) => `<li>▸ ${event.text}</li>`).join('')}</ul>
    <p class="warm-close">${closer}</p>
    <div class="reply-row"><button class="reply-button heart" data-reply="thanks" aria-label="Thanks">♡</button></div>
  </article>`;
}

function renderTimeline(current) {
  const hasUploadedTimeline = Array.isArray(current.uploadedEvents);
  app.innerHTML = `
    <section class="screen timeline-screen">
      <div class="topline"><span class="wordmark">quietly</span><button class="text-button" data-route="today">back to today</button></div>
      <h2>Today I saw…</h2>
      <button class="recording-button ${current.recording ? 'is-recording' : ''}" data-action="recording">
        <span class="record-dot"></span>${current.recording ? 'Recording' : 'Paused'}
      </button>
      ${current.recording ? '' : '<p class="paused-note">not recording — your call</p>'}
      <p class="timeline-intro">Your moments stay yours. Remove anything you do not want reflected back.</p>
      <div class="timeline-actions">
        <button class="outline-button" data-action="upload-video" ${current.isAnalysingVlog ? 'disabled' : ''}>${current.isAnalysingVlog ? 'Analysing vlog…' : 'Upload vlog'}</button>
      </div>
      <p class="video-status">${current.videoStatus}</p>
      <p class="video-error">${current.videoError}</p>
      ${hasUploadedTimeline ? uploadedTimeline(current) : ''}
      ${current.showDemoTimeline ? (current.events.length ? `<ol class="timeline">${current.events.map((event, index) => timelineItem(event, index)).join('')}</ol>` : '<p class="empty-state">No moments left for today. The cards will only reflect what remains.</p>') : ''}
      <div class="timeline-footer"><button class="text-button" data-action="show-demo">${current.showDemoTimeline ? 'Hide demo timeline' : 'Show demo timeline'}</button></div>
    </section>`;
}

function uploadedTimeline(current) {
  const uncertainty = current.uploadedUncertainties.length ? `<p class="timeline-uncertainty">${escapeHtml(current.uploadedUncertainties[0])}</p>` : '';
  const events = current.uploadedEvents.length
    ? `<ol class="timeline uploaded-timeline">${current.uploadedEvents.map((event, index) => timelineItem({ ...event, time: formatClipTime(event.start_seconds) }, index, 'uploaded')).join('')}</ol>`
    : '<p class="empty-state">No clear activities were found in this vlog.</p>';
  return `<section class="uploaded-section"><p class="card-kicker">from your vlog</p>${current.uploadedSummary ? `<p class="uploaded-summary">${escapeHtml(current.uploadedSummary)}</p>` : ''}${events}${uncertainty}</section>`;
}

function timelineItem(event, index, source = 'demo') {
  const deleteAttribute = source === 'uploaded' ? `data-delete-upload="${index}"` : `data-delete="${index}"`;
  return `<li class="timeline-item"><div class="timeline-main"><span class="timeline-time">${escapeHtml(event.time)}</span><span class="timeline-icon">${iconByType[event.type] || '◦'}</span><span class="timeline-text">${escapeHtml(event.text)}</span></div><button class="tiny-button" ${deleteAttribute}>⌫ delete</button></li>`;
}

function formatClipTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.dataset.route) { location.hash = target.dataset.route; return; }
  if (target.dataset.condition) {
    mutate((current) => { current.conditions = current.conditions.includes(target.dataset.condition) ? current.conditions.filter((condition) => condition !== target.dataset.condition) : [...current.conditions, target.dataset.condition]; });
    return;
  }
  if (target.dataset.tone) { mutate((current) => { current.tone = target.dataset.tone; }); return; }
  if (target.dataset.moment) { mutate((current) => { current.moment = target.dataset.moment; current.feedback = ''; }); return; }
  if (target.dataset.delete !== undefined) {
    mutate((current) => { current.events.splice(Number(target.dataset.delete), 1); current.feedback = 'That moment is gone. It will not appear in your cards.'; });
    return;
  }
  if (target.dataset.deleteUpload !== undefined) {
    mutate((current) => {
      current.uploadedEvents.splice(Number(target.dataset.deleteUpload), 1);
      current.videoStatus = 'That vlog moment is gone.';
    });
    return;
  }
  if (target.dataset.reply) {
    mutate((current) => {
      if (target.dataset.reply === 'try') current.feedback = 'Lovely — it is there if it suits you.';
      if (target.dataset.reply === 'not-today') current.feedback = 'Of course. Another day.';
      if (target.dataset.reply === 'not-for-me') { current.dismissedMorning = true; current.feedback = 'Got it — I’ll stop suggesting that.'; }
      if (target.dataset.reply === 'thanks') current.feedback = 'You noticed it. That is enough ☺';
    });
    return;
  }
  if (target.dataset.action === 'skip' || target.dataset.action === 'start') { mutate((current) => { current.onboardingComplete = true; }); location.hash = 'today'; return; }
  if (target.dataset.action === 'recording') { mutate((current) => { current.recording = !current.recording; }); return; }
  if (target.dataset.action === 'open-companion') { mutate((current) => { current.companionSeen = true; }); location.hash = 'companion'; return; }
  if (target.dataset.action === 'end-companion') { location.hash = 'today'; return; }
  if (target.dataset.action === 'retry-companion') {
    mutate((current) => {
      current.companionSessionTurns = [];
      current.companionFallback = false;
      current.companionStatus = '';
      current.companionHandoff = false;
    });
    return;
  }
  if (target.dataset.action === 'upload-video') { document.querySelector('#video-upload').click(); return; }
  if (target.dataset.action === 'show-demo') { mutate((current) => { current.showDemoTimeline = !current.showDemoTimeline; }); return; }
  if (target.dataset.action === 'reset-day') { saveState(defaultState()); location.hash = 'today'; return; }
  if (target.dataset.action === 'regenerate') { mutate((current) => { current.feedback = 'Cards refreshed from the moments still here.'; }); }
});

document.addEventListener('submit', (event) => {
  if (event.target.id !== 'companion-form') return;
  event.preventDefault();
  const input = event.target.querySelector('#companion-input');
  sendCompanionMessage(input.value);
});

document.addEventListener('change', (event) => {
  if (event.target.id !== 'video-upload' || !event.target.files[0]) return;
  const file = event.target.files[0];
  analyseVlog(file);
});

async function analyseVlog(file) {
  if (!file.type.startsWith('video/')) {
    mutate((current) => { current.videoError = 'Please choose a video file.'; });
    return;
  }
  if (file.size > 30 * 1024 * 1024) {
    mutate((current) => { current.videoError = 'Please choose a vlog smaller than 30 MB.'; });
    return;
  }

  mutate((current) => {
    current.isAnalysingVlog = true;
    current.videoStatus = `Analysing ${file.name}…`;
    current.videoError = '';
  });
  try {
    const videoDataUri = await fileToDataUri(file);
    const response = await fetch('/api/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoDataUri }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 404) throw new Error('Vlog analysis needs the Runware server. Start it with npm run dev, then open localhost:3000.');
      throw new Error(payload.error || 'Unable to analyse this vlog.');
    }

    mutate((current) => {
      current.uploadedEvents = payload.timeline.events;
      current.uploadedSummary = payload.timeline.overall_activity;
      current.uploadedUncertainties = payload.timeline.uncertainties;
      current.isAnalysingVlog = false;
      current.videoStatus = 'Your vlog timeline is ready.';
      current.videoError = '';
    });
  } catch (error) {
    mutate((current) => {
      current.isAnalysingVlog = false;
      current.videoStatus = '';
      current.videoError = error.message || 'Unable to analyse this vlog.';
    });
  } finally {
    document.querySelector('#video-upload').value = '';
  }
}

async function sendCompanionMessage(text) {
  const message = text.trim();
  if (!message) return;

  mutate((current) => {
    current.companionSessionTurns.push({ role: 'user', text: message });
    current.companionStatus = 'quietly is listening…';
  });

  try {
    const current = state();
    const response = await fetch('/api/companion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        turns: current.companionSessionTurns.slice(-6).map((turn) => ({ role: turn.role === 'companion' ? 'assistant' : 'user', content: turn.text })),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'The live Companion is unavailable.');

    mutate((next) => {
      next.companionSessionTurns.push({ role: 'companion', text: payload.reply });
      next.companionHandoff = Boolean(payload.handoff);
      const atLimit = next.companionSessionTurns.filter((turn) => turn.role === 'companion').length >= 4;
      next.companionStatus = payload.handoff ? 'A real person can help with this moment.' : atLimit ? 'I’ll leave you with that.' : '';
    });
  } catch {
    mutate((next) => {
      next.companionFallback = true;
      next.companionStatus = '';
    });
  }
}

function fileToDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read this vlog file.'));
    reader.readAsDataURL(file);
  });
}

window.addEventListener('hashchange', render);
initialise().catch((error) => { app.innerHTML = `<p class="empty-state">${error.message}</p>`; });
