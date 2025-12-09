// timestamps.js
// Loads available timestamps and exposes helpers to build data paths and notify listeners
// Keep root directory name the same to allow for easy replacement of data sets (ex: OSSWeatherData)
const ROOT_DIR = 'Data/OSS-Data-2025-12-01/FORECAST_WEATHER';
const INDEX_FILE = `${ROOT_DIR}/temp.json`;

let timestamps = [];
let current = null;

export async function loadTimestamps() {
  try {
    const resp = await fetch(INDEX_FILE, { cache: 'no-store' });
    const json = await resp.json();
    timestamps = Array.isArray(json) ? json.map(String) : [];
    if (timestamps.length > 0) {
      // default to first (earliest) timestamp
      current = timestamps[0];
    }
    return timestamps;
  } catch (err) {
    console.warn('Failed to load timestamps index', err);
    timestamps = [];
    current = null;
    return [];
  }
}

export function getTimestamps() { return timestamps.slice(); }
export function getCurrentTimestamp() { return current; }

export function setCurrentTimestamp(ts) {
  if (!ts) return;
  current = String(ts);
  try { localStorage.setItem('oss_timestamp', current); } catch (e) {}
  // dispatch a DOM event so modules can react
  document.dispatchEvent(new CustomEvent('timestamp-changed', { detail: current }));
}

export function buildDataPath(filename) {
  if (!current) return `${ROOT_DIR}/${filename}`;
  return `${ROOT_DIR}/${current}/${filename}`;
}

export function onTimestampChange(cb) {
  if (typeof cb !== 'function') return () => {};
  const handler = (ev) => cb(ev.detail);
  document.addEventListener('timestamp-changed', handler);
  return () => document.removeEventListener('timestamp-changed', handler);
}
