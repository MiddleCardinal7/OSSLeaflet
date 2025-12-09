import { fetchJsonWithCache } from './clientCache.js';
import { addDataMarkers } from './markers.js';

// bounds used for raster image overlay on weather layers
var southWestCorner = L.latLng([24, -126]);
var northEastCorner = L.latLng([50, -89]);
export var bounds = L.latLngBounds(southWestCorner, northEastCorner);

// default zoom->count heuristic
export function getZoomCountsDefault(zoom) {
  if (zoom >= 5) {
        return zoom * 40;
    } else {
        return zoom * 150
    }
}

// fetch JSON and resolve array shapes used across layers
export async function fetchDataArray(path, options = { ttlMs: 5 * 60 * 1000, useLocalStorage: false }) {
  const json = await fetchJsonWithCache(path, options);
  const arr = Array.isArray(json) && Array.isArray(json[0]) ? json[0] : (Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []));
  return arr || [];
}

// Sample points inside current bounds and return chosen items with resolved lat/lon
export function sampleAndChoose(cachedArr, map, nSample) {
  if (!Array.isArray(cachedArr) || cachedArr.length === 0) return [];
  const bounds = map.getBounds();
  const inBounds = [];
  for (let i = 0; i < cachedArr.length; i++) {
    const item = cachedArr[i];
    const coord = (item?.geometry && Array.isArray(item.geometry.coordinates))
      ? { lat: item.geometry.coordinates[1], lon: item.geometry.coordinates[0] }
      : { lat: item.lat ?? item.latitude, lon: item.lon ?? item.longitude };
    if (coord && coord.lat != null && coord.lon != null && bounds.contains([Number(coord.lat), Number(coord.lon)])) inBounds.push({ item, lat: Number(coord.lat), lon: Number(coord.lon) });
  }

  if (!nSample || nSample <= 1) return inBounds.map(x => ({ item: x.item, lat: x.lat, lon: x.lon }));

  if (inBounds.length <= nSample) return inBounds.map(x => ({ item: x.item, lat: x.lat, lon: x.lon }));

  const cols = Math.ceil(Math.sqrt(nSample));
  const rows = Math.ceil(nSample / cols);
  const west = bounds.getWest();
  const east = bounds.getEast();
  const north = bounds.getNorth();
  const south = bounds.getSouth();
  const cellW = (east - west) / cols;
  const cellH = (north - south) / rows;

  const buckets = Array.from({ length: cols * rows }, () => []);
  for (const p of inBounds) {
    const col = Math.min(cols - 1, Math.max(0, Math.floor((p.lon - west) / cellW)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor((north - p.lat) / cellH)));
    const idx = row * cols + col;
    buckets[idx].push(p);
  }

  const chosen = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const bucket = buckets[idx];
      if (!bucket || bucket.length === 0) continue;
      const centerLat = north - (row + 0.5) * cellH;
      const centerLon = west + (col + 0.5) * cellW;
      let best = bucket[0];
      let bestDist = (best.lat - centerLat) * (best.lat - centerLat) + (best.lon - centerLon) * (best.lon - centerLon);
      for (let k = 1; k < bucket.length; k++) {
        const b = bucket[k];
        const d = (b.lat - centerLat) * (b.lat - centerLat) + (b.lon - centerLon) * (b.lon - centerLon);
        if (d < bestDist) { best = b; bestDist = d; }
      }
      chosen.push({ item: best.item, lat: best.lat, lon: best.lon });
    }
  }
  return chosen;
}

// Map an item (original shape) to a normalized point {lat, lon, value, id, ...}
export function normalizeItemToPoint(it) {
  const item = it.item ?? it;

  const extractValue = (obj) =>
    obj.value ??
    obj.wx ??
    obj.Wx ??
    obj.weather ??
    obj.conditions ??
    obj.properties?.value ??
    obj.properties?.wx ??
    obj.properties?.Wx ??
    obj.properties?.weather ??
    obj.properties?.conditions;

  if (item?.geometry && Array.isArray(item.geometry.coordinates)) {
    const [lon, lat] = item.geometry.coordinates;
    return {
      lat: Number(lat),
      lon: Number(lon),
      value: extractValue(item),
      id: item.properties?.id ?? item.id
    };
  }

  const lat = item.lat ?? item.latitude ?? item[1];
  const lon = item.lon ?? item.longitude ?? item[0];

  if (lat == null || lon == null) return null;

  return {
    lat: Number(lat),
    lon: Number(lon),
    value: extractValue(item),
    id: item.id ?? item.properties?.id
  };
}

export function createLegendControl(imgSrc, position = 'bottomleft') {
  const legend = L.control({ position });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'info legend');
    div.innerHTML = `\n        <img \n        src="${imgSrc}" \n        alt="Legend" \n        style="width: 500px; border: 1px solid black;"\n        />\n    `;
    return div;
  };
  return legend;
}

export function createImageOverlay(map, imageUrl, imageBounds) {
  if (!imageUrl || !imageBounds) return null;
  try {
    const overlay = L.imageOverlay(imageUrl, imageBounds, { interactive: false }).addTo(map);
    return overlay;
  } catch (e) {
    console.debug('createImageOverlay failed', e);
    return null;
  }
}

// produce an iconForValue function for numeric-valued icons with a base directory
export function makeNumericIconFactory(baseDir, iconSize = [28, 28], anchor = [14, 14]) {
  const iconCache = new Map();
  return (value, item) => {
    const v = value ?? item?.value ?? item?.properties?.value;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    const key = String(Math.round(n));
    const filename = `${baseDir}/${key}.png`;
    if (iconCache.has(filename)) return iconCache.get(filename);
    const icon = L.icon({ iconUrl: filename, iconSize, iconAnchor: anchor, popupAnchor: [0, -14] });
    iconCache.set(filename, icon);
    return icon;
  };
}

// generic string-based icon factory (e.g., weather codes)
export function makeStringIconFactory(baseDir, iconSize = [28,28], anchor = [14,14], transformFn = v => String(v).toLowerCase()) {
  const iconCache = new Map();
  return (value, item) => {
    const v = value ?? item?.value ?? item?.properties?.value;
    if (v == null) return null;
    const key = transformFn(v);
    const filename = `${baseDir}/${key}.png`;
    if (iconCache.has(filename)) return iconCache.get(filename);
    const icon = L.icon({ iconUrl: filename, iconSize, iconAnchor: anchor, popupAnchor: [0, -14] });
    iconCache.set(filename, icon);
    return icon;
  };
}

// Attach debounced update responders to map events and return a cleanup function
export function scheduleUpdater(map, layer, updateFn, debounceMs = 250) {
  let debounceTimer = null;
  function schedule() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (map.hasLayer(layer)) updateFn();
    }, debounceMs);
  }
  // initial
  updateFn();
  map.on('moveend', schedule);
  map.on('zoomend', schedule);
  return () => {
    map.off('moveend', schedule);
    map.off('zoomend', schedule);
    try { layer.clearLayers(); } catch (e) {}
  };
}

// High-level factory that encapsulates fetch -> sample -> normalize -> render -> schedule
export function createLayerUpdater(opts) {
  const {
    map,
    layer,
    dataPath: initialDataPath,
    ttlMs = 5 * 60 * 1000,
    useLocalStorage = false,
    normalize = normalizeItemToPoint,
    iconForValue = null,
    popupFormatter = it => `${it.value ?? 'n/a'}`,
    tooltipFormatter = null,
    latField = 'lat',
    lonField = 'lon',
    getSampleCount = getZoomCountsDefault,
    debounceMs = 250,
    overlayImage: initialOverlayImage,
    overlayBounds = null,
    legendImage = null
  } = opts || {};

    let dataPath = initialDataPath;
    let overlayImage = initialOverlayImage;

  if (!map || !layer || !dataPath) throw new Error('createLayerUpdater requires map, layer and dataPath');

  let cachedArr = null;

  async function update() {
    try {
      if (!cachedArr) cachedArr = await fetchDataArray(dataPath, { ttlMs, useLocalStorage });
    } catch (e) {
      console.warn('[createLayerUpdater] fetch failed', e);
      cachedArr = [];
    }
    if (!cachedArr || cachedArr.length === 0) { try { layer.clearLayers(); } catch (e) {} ; return; }

    const zoom = map.getZoom();
    const nSample = (typeof getSampleCount === 'function') ? getSampleCount(zoom) : getSampleCount;
    const chosen = sampleAndChoose(cachedArr, map, nSample);

    const normalized = chosen.map(n => normalize(n)).filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lon));

    try { layer.clearLayers(); } catch (e) {}

    addDataMarkers(map, layer, normalized, {
      popupFormatter,
      tooltipFormatter,
      latField,
      lonField,
      iconForValue
    });
  }

  const overlay = overlayImage && overlayBounds ? createImageOverlay(map, overlayImage, overlayBounds) : null;
  const legend = legendImage ? createLegendControl(legendImage) : null;
  if (legend) legend.addTo(map);

  const scheduleCleanup = scheduleUpdater(map, layer, update, debounceMs);

   // --- NEW: allow timestamp updates ---
  function updatePaths(newDataPath, newOverlayUrl) {
    if (newDataPath) dataPath = newDataPath;

    if (overlay && newOverlayUrl && typeof overlay.setUrl === "function") {
      overlay.setUrl(newOverlayUrl);
    }

    cachedArr = null;
    update();          // force immediate refresh
  }

  // --- CLEANUP ---
  function cleanup() {
    try { scheduleCleanup(); } catch (e) {}
    try { layer.clearLayers(); } catch (e) {}
    try { if (overlay) map.removeLayer(overlay); } catch (e) {}
    try { if (legend) map.removeControl(legend); } catch (e) {}
  }

  // ✅ return an API, not just cleanup
  return {
    cleanup,
    updatePaths,
  };
}
