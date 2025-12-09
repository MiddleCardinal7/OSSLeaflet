import { addDataMarkers } from './markers.js';
import { buildDataPath, onTimestampChange } from './timestamps.js';
import { sampleAndChoose, createImageOverlay, createLegendControl, scheduleUpdater, getZoomCountsDefault, fetchDataArray} from './layerUtils.js';

// Wind Gust Layer
export function loadWindGustLayer(map, layers) {
    const windLayer = layers?.['windGustSpeed'];
    if (!windLayer) return;

    // initial paths
    let gustPath = buildDataPath('wgust.json');
    let imageUrl = buildDataPath('wgust.png');
    const imageBounds = [[24, -126], [50, -89]];

    // create overlay and legend
    const gustOverlay = createImageOverlay(map, imageUrl, imageBounds);
    const legend = createLegendControl('Data/icons/Legends/wind.png');
    legend.addTo(map);

    let cachedArr = null;
    const DEBOUNCE_MS = 250;

    // helper functions
    function bucketAngle(angle) {
        if (!Number.isFinite(angle)) return 0;
        let a = angle % 360;
        if (a < 0) a += 360;
        const step = 22.5;
        const b = Math.round(a / step) * step;
        return b === 360 ? 0 : b;
    }
    function windSpeedForIcon(value) {
        if (value > 10) return value % 2 === 0 ? value : value - 1;
        return value;
    }

    const iconCache = new Map();
    function iconForValue(value, item) {
        const speedRaw = value ?? item?.value ?? item?.properties?.value;
        const angleRaw = item?.angle ?? item?.properties?.value2 ?? item?.properties?.angle ?? item?.value2;
        const speed = Number.isFinite(Number(speedRaw)) ? Math.round(Number(speedRaw)) : 0;
        const angleBucket = bucketAngle(Number(angleRaw));
        const speedStr = String(windSpeedForIcon(speed));
        const angleStr = String(angleBucket);
        const cacheKey = `${speedStr}_${angleStr}`;
        if (iconCache.has(cacheKey)) return iconCache.get(cacheKey);
        const filename = `Data/icons/Wind/${speedStr}_${angleStr}.png`;
        let icon;

        //If the wind is calm (0 degrees), make the icon smaller
        if (angleStr === '0' && speedStr === '0') {
            icon = L.icon({ iconUrl: filename, iconSize: [2, 2], iconAnchor: [14, 14], popupAnchor: [0, -14] });
        }

        else {
            icon = L.icon({ iconUrl: filename, iconSize: [50, 50], iconAnchor: [14, 14], popupAnchor: [0, -14] });
        }

        iconCache.set(cacheKey, icon);
        return icon;
    }

    async function update() {
        try {
            if (!cachedArr) cachedArr = await fetchDataArray(gustPath);
        } catch (e) {
            console.warn('[windGustSpeed] fetch failed', e);
            cachedArr = [];
        }
        if (!cachedArr || cachedArr.length === 0) { windLayer.clearLayers(); return; }

        const zoom = map.getZoom();
        const nSample = getZoomCountsDefault(zoom);
        const chosen = sampleAndChoose(cachedArr, map, nSample);

        const normalized = chosen.map(n => {
            const it = n.item;
            const lat = it.lat ?? it.latitude ?? it[1];
            const lon = it.lon ?? it.longitude ?? it[0];
            if (lat == null || lon == null) return null;
            return {
                lat: Number(lat),
                lon: Number(lon),
                value: it.value ?? it.properties?.value,
                angle: it.value2 ?? it.properties?.value2 ?? it.angle ?? it.properties?.angle,
                id: it.id ?? it.properties?.id
            };
        }).filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lon));

        windLayer.clearLayers();
        addDataMarkers(map, windLayer, normalized, {
            popupFormatter: it => `<strong>Gust:</strong> ${it.value ?? 'n/a'} mph from ${it.angle ?? 'n/a'}°`,
            tooltipFormatter: it => `${it.value ?? 'n/a'} mph (${it.angle ?? 'n/a'}°)`,
            latField: 'lat',
            lonField: 'lon',
            iconForValue
        });
    }

    const scheduleCleanup = scheduleUpdater(map, windLayer, update, DEBOUNCE_MS);

    // handle timestamp changes
    const unsubscribe = onTimestampChange(() => {
        gustPath = buildDataPath('wgust.json');
        imageUrl = buildDataPath('wgust.png');
        if (gustOverlay && typeof gustOverlay.setUrl === 'function') gustOverlay.setUrl(imageUrl);
        cachedArr = null;
        update();
    });

    // return cleanup function
    return () => {
        try { scheduleCleanup(); } catch (e) { }
        try { if (gustOverlay) map.removeLayer(gustOverlay); } catch (e) { }
        try { if (legend) map.removeControl(legend); } catch (e) { }
        unsubscribe();
    };
}
