const form = document.querySelector('#analysis-form');
const input = document.querySelector('#video');
const fileName = document.querySelector('#file-name');
const button = document.querySelector('#submit-button');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const analysis = document.querySelector('#analysis');

input.addEventListener('change', () => {
  const file = input.files[0];
  fileName.textContent = file ? `${file.name} (${Math.round(file.size / 1024 / 1024)} MB)` : '';
  result.hidden = true;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = input.files[0];
  if (!file) return;
  if (file.size > 30 * 1024 * 1024) {
    status.textContent = 'Please choose a video smaller than 30 MB.';
    return;
  }

  button.disabled = true;
  result.hidden = true;
  status.textContent = 'Uploading and reviewing the visible activity…';

  try {
    const videoDataUri = await fileToDataUri(file);
    const response = await fetch('/api/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoDataUri }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Unable to analyse this video.');

    analysis.textContent = payload.analysis;
    result.hidden = false;
    status.textContent = '';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

function fileToDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read this video file.'));
    reader.readAsDataURL(file);
  });
}
