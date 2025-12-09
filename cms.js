import { fetchJsonWithCache } from './clientCache.js';
import { addDataMarkers } from './markers.js';

// Load CMS (Changeable Message Sign) data and render as markers on the provided layerGroup
export function loadCMSData(map, layers) {
  const layer = layers['cms'];
  if (!layer) return;

  const jsonPath = 'Data/OSS-Data-2025-12-01/OSS_cms.json';
  let cancelled = false;

  // Use image-based icons for active vs blank CMS signs (actual image size 24x11)
  const cmsIcon = L.icon({
    iconUrl: 'Data/icons/cms/cms.png',
    iconSize: [24, 11],
    iconAnchor: [12, 11],
    popupAnchor: [0, -11]
  });

  const cmsBlankIcon = L.icon({
    iconUrl: 'Data/icons/cms/cms_blank.png',
    iconSize: [24, 11],
    iconAnchor: [12, 11],
    popupAnchor: [0, -11]
  });

  function formatPopup(item) {
    const lat = item.latitude || item.lat || item.location?.lat || null;
    const lon = item.longitude || item.lon || item.location?.lon || null;
    const updated = item.updated || item.record_date || '';
    const title = item.name || item.location || item.uid || 'CMS';

    // CMS text is often an array-of-arrays `text: [[row1],[row2],[row3]]`
    let textHtml = '';
    try {
      const t = item.text;
      if (Array.isArray(t)) {
        t.forEach((row, idx) => {
          if (Array.isArray(row)) {
            textHtml += row.map(cell => (cell || '').trim()).join(' ') + '<br />';
          } else if (typeof row === 'string') {
            textHtml += row.trim() + '<br />';
          }
          if (idx === 0 && t.length > 1) textHtml += '<hr style="margin:6px 0">';
        });
      }
    } catch (e) {
      // ignore
    }

    const nwsLink = (lat && lon) ? `<br><a href="https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lon}" target="_blank">View NWS Forecast</a>` : '';

    return `
      <div style="min-width:220px">
        <div style="font-weight:700; margin-bottom:6px">${title}</div>
        <div style="font-size:12px; color:#ccc; margin-bottom:6px">Updated: ${updated}</div>
        <div style="background:#000; color:#ffd700; padding:8px; border-radius:4px; font-family:monospace; white-space:pre-wrap; line-height:1.2; font-size:13px;">${textHtml || '(blank)'}</div>
        ${nwsLink}
      </div>
    `;
  }

  async function load() {
    try {
      const raw = await fetchJsonWithCache(jsonPath);
      if (cancelled || !raw) return;

      // OSS files sometimes wrap array in another array
      const items = Array.isArray(raw) && raw.length === 1 && Array.isArray(raw[0]) ? raw[0] : (Array.isArray(raw) ? raw : (raw.data || []));

      items.forEach(item => {
        const lat = Number(item.latitude ?? item.lat ?? (item.location?.lat));
        const lon = Number(item.longitude ?? item.lon ?? (item.location?.lon));
        if (!isFinite(lat) || !isFinite(lon)) return;

        const isActive = Boolean(item.active) || (String(item.display || '').toLowerCase() !== 'blank');
        const icon = isActive ? cmsIcon : cmsBlankIcon;

        const marker = L.marker([lat, lon], { icon, zIndexOffset: 200 });
        marker.bindPopup(formatPopup(item));
        marker.bindTooltip(item.uid || item.name || item.location || '', { permanent: false });
        layer.addLayer(marker);
      });

      // nothing else to update on zoom for CMS, static markers are fine

    } catch (err) {
      console.error('Error loading CMS data:', err);
    }
  }

  load();

  return () => {
    cancelled = true;
    layer.clearLayers();
  };
}
