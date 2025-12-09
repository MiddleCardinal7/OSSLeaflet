import { fetchJsonWithCache } from './clientCache.js';
import { addDataMarkers } from './markers.js';

// Load RWIS (Road Weather Information System) stations and render as markers
// on the provided layerGroup. Modeled after cms.js but tailored for RWIS fields.
export function loadRwisData(map, layers) {
  const layer = layers['rwis'];
  if (!layer) return;

  const jsonPath = 'Data/OSS-Data-2025-12-01/OSS_rwis.json';
  let cancelled = false;

  const rwisIcon = L.icon({
    iconUrl: 'Data/icons/rwis/rwis.png',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });

  const rwisColdIcon = L.icon({
    iconUrl: 'Data/icons/rwis/rwiscold.png',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });

  function formatPopup(item) {
    const lat = item.latitude || item.lat || item.location?.lat || null;
    const lon = item.longitude || item.lon || item.location?.lon || null;
    const updated = item.updated || item.record_date || item.timestamp || item.obs_time || '';
    const title = item.name || item.station || item.uid || 'RWIS Station';

    const nwsLink = (lat && lon) ? `<a href="https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lon}" target="_blank">View NWS Forecast</a>` : '';

    // Build table with all data points
    let tableHtml = '<table style="width:100%; border-collapse:collapse; font-size:12px;">';
    tableHtml += '<tbody>';

    // Define fields to display in order
    const fieldsToDisplay = [
      'air_temp', 'airTemperature', 'air_temperature', 'temperature', 'temp',
      'road_temp', 'roadTemperature', 'road_temperature', 'surface_temp',
      'condition', 'road_condition', 'obs', 'status',
      'humidity', 'wind_speed', 'wind_direction', 'precipitation',
      'visibility', 'dew_point', 'pressure'
    ];

    // Track which fields we've already added to avoid duplicates
    const addedFields = new Set();

    // Add priority fields first
    const priorityFields = [
      { key: 'uid', label: 'UID' },
      { key: 'name', label: 'Station Name' },
      { key: 'station', label: 'Station' },
      { key: 'latitude', label: 'Latitude' },
      { key: 'longitude', label: 'Longitude' },
      { key: 'updated', label: 'Updated' },
      { key: 'record_date', label: 'Record Date' },
      { key: 'timestamp', label: 'Timestamp' },
      { key: 'obs_time', label: 'Observation Time' }
    ];

    priorityFields.forEach(field => {
      if (item[field.key] !== undefined && item[field.key] !== null && item[field.key] !== '') {
        const value = String(item[field.key]).substring(0, 100); // Limit value length
        tableHtml += `<tr><td style="padding:4px; border:1px solid #ddd; font-weight:500;">${field.label}</td><td style="padding:4px; border:1px solid #ddd;">${value}</td></tr>`;
        addedFields.add(field.key);
      }
    });

    // Add remaining fields from the object
    Object.keys(item).forEach(key => {
      if (!addedFields.has(key) && item[key] !== undefined && item[key] !== null && item[key] !== '' && typeof item[key] !== 'object') {
        const value = String(item[key]);
        // Skip fields containing "Error", "Not Reported", "Unknown", or "icon"
        if (value.includes('Error') || value.includes('Not Reported') || value.includes('Unknown') || key.toLowerCase().includes('icon')) {
          return;
        }
        const valueDisplay = value.substring(0, 100); // Limit value length
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        tableHtml += `<tr><td style="padding:4px; border:1px solid #ddd; font-weight:500;">${label}</td><td style="padding:4px; border:1px solid #ddd;">${valueDisplay}</td></tr>`;
        addedFields.add(key);
      }
    });

    tableHtml += '</tbody></table>';

    return `
      <div style="min-width:280px; max-width:400px;">
        <div style="font-weight:700; margin-bottom:8px; font-size:14px;">${title}</div>
        <div style="max-height:400px; overflow-y:auto; margin-bottom:8px;">
          ${tableHtml}
        </div>
        ${nwsLink ? `<div style="margin-top:8px;"><a href="${nwsLink.match(/href="([^"]*)"/)[1]}" target="_blank">View NWS Forecast</a></div>` : ''}
      </div>
    `;
  }

  // Heuristic: detect "cold" states to choose an alternate icon. Checks both
  // numeric temperature fields and condition keywords.
  function isCold(item) {
    const tRaw = item.air_temp ?? item.airTemperature ?? item.air_temperature ?? item.temperature ?? item.temp ?? item.road_temp ?? item.surface_temp;
    const t = Number(tRaw);
    if (isFinite(t)) {
      // If temperature is plausibly Fahrenheit (>= -60 and <= 140), treat <=32 as cold
      if (t <= 32) return true;
      // Otherwise, if it looks like Celsius (<= 50), treat <=0 as cold
      if (t <= 0) return true;
    }

    const cond = String(item.condition || item.road_condition || item.obs || '').toLowerCase();
    if (cond.includes('snow') || cond.includes('ice') || cond.includes('freeze') || cond.includes('sleet') || cond.includes('icy')) return true;

    return false;
  }

  async function load() {
    try {
      const raw = await fetchJsonWithCache(jsonPath);
      if (cancelled || !raw) return;

      const items = Array.isArray(raw) && raw.length === 1 && Array.isArray(raw[0]) ? raw[0] : (Array.isArray(raw) ? raw : (raw.data || []));

      items.forEach(item => {
        const lat = Number(item.latitude ?? item.lat ?? (item.location?.lat));
        const lon = Number(item.longitude ?? item.lon ?? (item.location?.lon));
        if (!isFinite(lat) || !isFinite(lon)) return;

        const icon = isCold(item) ? rwisColdIcon : rwisIcon;

        const marker = L.marker([lat, lon], { icon, zIndexOffset: 100 });
        marker.bindPopup(formatPopup(item));
        marker.bindTooltip(item.uid || item.name || item.station || '', { permanent: false });
        layer.addLayer(marker);
      });

    } catch (err) {
      console.error('Error loading RWIS data:', err);
    }
  }

  load();

  return () => {
    cancelled = true;
    layer.clearLayers();
  };
}
