// clientCache.js
// Simple client-side caching helper for JSON fetches.
// - In-memory cache keyed by request URL
// - Optional localStorage backing (useful across reloads)

const memCache = new Map();

export async function fetchJsonWithCache(url, options = {}) {
  // options: { ttlMs = 300000, useLocalStorage = false }
  const ttlMs = options.ttlMs ?? 5 * 60 * 1000; // 5 minutes
  const useLocal = Boolean(options.useLocalStorage);

  const now = Date.now();

  // Check in-memory cache
  const m = memCache.get(url);
  if (m && (now - m.ts) < ttlMs) {
    return m.data;
  }

  // Check localStorage if enabled
  if (useLocal) {
    try {
      const key = `clientCache:${url}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (now - parsed.ts) < ttlMs) {
          memCache.set(url, { data: parsed.data, ts: parsed.ts });
          return parsed.data;
        }
      }
    } catch (e) {
      // ignore localStorage errors
      console.debug('clientCache: localStorage read failed', e);
    }
  }

  // Fetch from network. Use a robust parser: try resp.json() first, but if
  // the server returns a non-standard payload (XSSI prefix, JS var assignment,
  // BOM, etc.) fall back to text and extract the JSON portion.
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  let json;
  const contentType = resp.headers.get && resp.headers.get('content-type');
  // If server advertises JSON, try the convenient parser first
  if (contentType && contentType.toLowerCase().includes('application/json')) {
    try {
      json = await resp.json();
    } catch (e) {
      // fall through to text parsing below
      json = undefined;
    }
  }

  if (json === undefined) {
    const txt = await resp.text();
    // Attempt 1: find first JSON token ('{' or '[') and parse from there
    const first = txt.search(/[\{\[]/);
    if (first !== -1) {
      const candidate = txt.slice(first);
      try {
        json = JSON.parse(candidate);
      } catch (e1) {
        // Attempt 2: strip any leading non-json characters more aggressively
        const cleaned = txt.replace(/^[^\{\[]+/, '');
        try {
          json = JSON.parse(cleaned);
        } catch (e2) {
          // As a last resort, throw the inner parsing error so caller can handle it
          throw new Error('Failed to parse JSON response: ' + e2.message);
        }
      }
    } else {
      throw new Error('Response does not contain JSON');
    }
  }

  // Store in caches
  memCache.set(url, { data: json, ts: now });
  if (useLocal) {
    try {
      const key = `clientCache:${url}`;
      localStorage.setItem(key, JSON.stringify({ data: json, ts: now }));
    } catch (e) {
      console.debug('clientCache: localStorage write failed', e);
    }
  }

  return json;
}

export function clearCache(url) {
  if (url) memCache.delete(url);
  else memCache.clear();

  // clear localStorage entries too
  try {
    if (url) {
      localStorage.removeItem(`clientCache:${url}`);
    } else {
      // remove keys prefixed with clientCache:
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('clientCache:')) localStorage.removeItem(k);
      }
    }
  } catch (e) {
    // ignore
  }
}
