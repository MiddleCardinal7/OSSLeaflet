// windCommon.js
import { addDataMarkers } from './markers.js';
import { fetchJsonWithCache } from './clientCache.js';

export function loadWindLikeLayer(map, layers, layerKey, config) {
    const windLayer = layers?.[layerKey];
    if (!windLayer) return;

    const { jsonPath, imagePath, legendImage, popupLabel, consoleTag } = config;

    // Overlay
    const bounds = [[24, -126], [50, -89]];
    const overlay = L.imageOverlay(imagePath, bounds, { interactive: false });
    overlay.addTo(map);

    // Legend
    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = () => {
        const div = L.DomUtil.create('div', 'info legend');
        div.innerHTML = `
      <img src="${legendImage}" style="width: 500px; border:1px solid black;" />
    `;
        return div;
    };
    legend.addTo(map);

    // Fetch JSON array helper
    async function fetchArray() {
        try {
            const json = await fetchJsonWithCache(jsonPath, { ttlMs: 5 * 60 * 1000, useLocalStorage: false });
            const arr = Array.isArray(json) && Array.isArray(json[0]) ? json[0] : (Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []));
            return arr;
        } catch (err) {
            console.warn('Failed to load wind gust speed data:', err);
            return [];
        }
    }

    //helper function to determine divisor number of markers based on zoom level
    function getZoomCounts(zoom) {
        if (zoom >= 5) {
            return zoom * 40;
        } else {
            return zoom * 150
        }
    }

    // Icon helpers
    const iconCache = new Map();

    function bucketAngle(angle) {
        if (!Number.isFinite(angle)) return 0;
        let a = angle % 360;
        if (a < 0) a += 360;
        const step = 22.5;
        const raw = Math.round(a / step) * step;
        const n = ((raw % 360) + 360) % 360;
        const roundedInt = Math.round(n);
        return Math.abs(n - roundedInt) < 1e-9 ? roundedInt : Number(n.toFixed(1));
    }

    function windSpeedForIcon(value) {
        if (value > 10 && value % 2 !== 0) return value - 1;
        return value;
    }

    const iconForValue = (value, item) => {
        const speedRaw = value ?? item?.value ?? item?.properties?.value;
        const angleRaw = item?.angle ?? item?.properties?.value2 ?? item?.properties?.angle ?? item?.value2;
        const speed = Number.isFinite(Number(speedRaw)) ? Math.round(Number(speedRaw)) : 0;
        const angleBucket = bucketAngle(Number(angleRaw));
        const speedStr = String(windSpeedForIcon(speed));
        const angleStr = (Math.abs(angleBucket % 1) < 1e-9) ? String(Math.round(angleBucket)) : String(angleBucket);
        const filename = `Data/icons/Wind/${speedStr}_${angleStr}.png`;
        const cacheKey = `${speed}_${angleStr}`;
        if (iconCache.has(cacheKey)) return iconCache.get(cacheKey);
        const icon = L.icon({
            iconUrl: filename,
            iconSize: [50, 50],
            iconAnchor: [14, 14],
            popupAnchor: [0, -14]
        });
        iconCache.set(cacheKey, icon);
        return icon;
    };

    // Cached array + update logic
    let cachedArr = null;
    let debounceTimer = null;

    async function update() {
        if (!cachedArr) cachedArr = await fetchArray();
        if (!cachedArr?.length) return windLayer.clearLayers();

        const zoom = map.getZoom();
        const bounds = map.getBounds();
        const nSample = getZoomCounts(zoom);

        // Filter by viewport
        const inBounds = cachedArr
            .map(item => {
                const coords = item.geometry?.coordinates;
                const lat = coords ? coords[1] : item.lat ?? item.latitude;
                const lon = coords ? coords[0] : item.lon ?? item.longitude;

                if (lat == null || lon == null) return null;
                return bounds.contains([+lat, +lon])
                    ? { item, lat: +lat, lon: +lon }
                    : null;
            })
            .filter(Boolean);

        // Sampling logic (unchanged)
        let chosen = [];
        if (inBounds.length <= nSample) {
            chosen = inBounds.map(x => x.item);
        } else {
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
                buckets[row * cols + col].push(p);
            }

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const bucket = buckets[r * cols + c];
                    if (!bucket.length) continue;

                    const centerLat = north - (r + 0.5) * cellH;
                    const centerLon = west + (c + 0.5) * cellW;

                    let best = bucket[0];
                    let bestDist =
                        (best.lat - centerLat) ** 2 + (best.lon - centerLon) ** 2;

                    for (let i = 1; i < bucket.length; i++) {
                        const b = bucket[i];
                        const d = (b.lat - centerLat) ** 2 + (b.lon - centerLon) ** 2;
                        if (d < bestDist) {
                            best = b;
                            bestDist = d;
                        }
                    }
                    chosen.push(best.item);
                }
            }
        }

        // Normalize points
        const normalized = chosen.map(it => {
            const coords = it.geometry?.coordinates;
            const lat = coords ? coords[1] : it.lat ?? it.latitude;
            const lon = coords ? coords[0] : it.lon ?? it.longitude;

            return {
                lat: +lat,
                lon: +lon,
                value: it.value ?? it.properties?.value,
                angle:
                    it.angle ??
                    it.value2 ??
                    it.properties?.value2 ??
                    it.properties?.angle,
                id: it.id ?? it.properties?.id
            };
        });


        windLayer.clearLayers();

        addDataMarkers(map, windLayer, normalized, {
            popupFormatter: it =>
                `<strong>${popupLabel}:</strong> ${it.value}<br/><strong>Angle:</strong> ${it.angle}°`,
            tooltipFormatter: it => `${it.value} (${it.angle}°)`,
            latField: 'lat',
            lonField: 'lon',
            iconForValue
        });

        console.debug(consoleTag, 'zoom=', zoom, 'n=', nSample, 'shown=', normalized.length);
    }

    function scheduleUpdate() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (map.hasLayer(windLayer)) update();
        }, 250);
    }

    update();
    map.on('moveend', scheduleUpdate);
    map.on('zoomend', scheduleUpdate);

    // Cleanup
    return () => {
        map.off('moveend', scheduleUpdate);
        map.off('zoomend', scheduleUpdate);
        try {
            windLayer.clearLayers();
            map.removeLayer(overlay);
            map.removeControl(legend);
        } catch { }
    };
}
