const app = document.querySelector('#app');
const storageKey = 'quietly-demo-state-v1';
let sourceDay;

const iconByType = {
  wake: '⌁', commute: '↗', breakfast: '◒', snack: '◇', lunch: '⊹', drink: '◌', errand: '□', evening: '☾'
};

async function initialise() {
  sourceDay = await fetch('data/day.json').then((response) => {
    if (!response.ok) throw new Error('Could not load the demo day.');
    return response.json();
  });
  if (!localStorage.getItem(storageKey)) saveState(defaultState());
  render();
}

function defaultState() {
  return {
    onboardingComplete: false,
    goals: [],
    tone: 'Gentle',
    moment: 'morning',
    recording: true,
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
  else if (route === 'today' && current.onboardingComplete) renderToday(current);
  else renderOnboarding(current);
}

function renderOnboarding(current) {
  app.innerHTML = `
    <section class="screen onboarding">
      <span class="wordmark">quietly</span>
      <h1>What would you like to feel a bit better about?</h1>
      <p class="soft-copy">No pressure. Just the small things that matter to you.</p>
      <span class="choice-label">A little more of</span>
      <div class="chips" id="goals">
        ${['More energy', 'Move a bit more', 'Eat a bit better', 'Sleep better'].map((goal) => chip(goal, current.goals.includes(goal))).join('')}
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

function chip(goal, selected) {
  return `<button class="chip ${selected ? 'selected' : ''}" data-goal="${goal}">${goal}</button>`;
}

function renderToday(current) {
  const card = current.moment === 'morning' ? morningCard(current) : eveningCard(current);
  app.innerHTML = `
    <section class="screen">
      <div class="topline">
        <span class="wordmark">quietly</span>
        <button class="text-button" data-route="timeline">today it saw…</button>
      </div>
      <div class="time-toggle" aria-label="Demo current moment">
        <button class="${current.moment === 'morning' ? 'active' : ''}" data-moment="morning">Morning ☀</button>
        <button class="${current.moment === 'evening' ? 'active' : ''}" data-moment="evening">Evening ☾</button>
      </div>
      <p class="day-label">demo current moment · ${current.moment}</p>
      ${card}
      <p class="feedback">${current.feedback}</p>
      <p class="source-note">Only moments you can see in <button class="text-button" data-route="timeline">Today it saw…</button> shape these cards.</p>
    </section>`;
}

function morningCard(current) {
  if (current.dismissedMorning) {
    return `<article class="index-card"><span class="card-kicker">A quiet morning</span><p class="card-copy">No lunch ideas from me today. Your call ☺</p></article>`;
  }
  const hasLunchPattern = current.events.some((event) => event.type === 'lunch');
  const favourite = current.prefs.likes.find((like) => like === 'ramen') || current.prefs.likes[0];
  const goalHint = current.goals.includes('Move a bit more') ? 'A little walk could be part of it.' : 'Take it at your own pace.';
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
  app.innerHTML = `
    <section class="screen">
      <div class="topline"><span class="wordmark">quietly</span><button class="text-button" data-route="today">back to today</button></div>
      <h2>Today it saw…</h2>
      <button class="recording-button ${current.recording ? 'is-recording' : ''}" data-action="recording">
        <span class="record-dot"></span>${current.recording ? 'Recording' : 'Paused'}
      </button>
      ${current.recording ? '' : '<p class="paused-note">not recording — your call</p>'}
      <p class="timeline-intro">Your moments stay yours. Remove anything you do not want reflected back.</p>
      ${current.events.length ? `<ol class="timeline">${current.events.map((event, index) => timelineItem(event, index)).join('')}</ol>` : '<p class="empty-state">No moments left for today. The cards will only reflect what remains.</p>'}
    </section>`;
}

function timelineItem(event, index) {
  return `<li class="timeline-item"><div class="timeline-main"><span class="timeline-time">${event.time}</span><span class="timeline-icon">${iconByType[event.type] || '◦'}</span><span class="timeline-text">${event.text}</span></div><button class="tiny-button" data-delete="${index}">⌫ delete</button></li>`;
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.dataset.route) { location.hash = target.dataset.route; return; }
  if (target.dataset.goal) {
    mutate((current) => { current.goals = current.goals.includes(target.dataset.goal) ? current.goals.filter((goal) => goal !== target.dataset.goal) : [...current.goals, target.dataset.goal]; });
    return;
  }
  if (target.dataset.tone) { mutate((current) => { current.tone = target.dataset.tone; }); return; }
  if (target.dataset.moment) { mutate((current) => { current.moment = target.dataset.moment; current.feedback = ''; }); return; }
  if (target.dataset.delete !== undefined) {
    mutate((current) => { current.events.splice(Number(target.dataset.delete), 1); current.feedback = 'That moment is gone. It will not appear in your cards.'; });
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
  if (target.dataset.action === 'reset-day') { saveState(defaultState()); location.hash = 'today'; return; }
  if (target.dataset.action === 'regenerate') { mutate((current) => { current.feedback = 'Cards refreshed from the moments still here.'; }); }
});

window.addEventListener('hashchange', render);
initialise().catch((error) => { app.innerHTML = `<p class="empty-state">${error.message}</p>`; });
