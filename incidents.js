// incidents.js
import { fetchJsonWithCache } from './clientCache.js';

export function loadIncidentData(map, layers) {
  const incidentsLayer = layers['incidents'];
  if (!incidentsLayer) return;

  const jsonPath = 'Data/OSS-Data-2025-12-01/OSS_incidents.json';
  let cancelled = false;
  let allIncidents = [];

  // simple helper to safely access string fields
  const safe = (v) => (v === null || v === undefined) ? '' : v;

  // Format helpers: convert times like YYYYMMDDHHMM... or ISO strings to "Mon D YYYY"
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function formatTimeFromDigits(digits) {
    if (!digits) return null;
    // take first two as hours, next two as minutes (ignore seconds if present)
    const hh = parseInt(digits.slice(0,2), 10);
    const mm = digits.length >= 4 ? parseInt(digits.slice(2,4), 10) : 0;
    if (!isFinite(hh) || !isFinite(mm)) return null;
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const hour12 = ((hh + 11) % 12) + 1; // converts 0->12,13->1
    return `${hour12}:${pad(mm)} ${ampm}`;
  }

  // Returns either "Time, Mon D YYYY" if time is available, or "Mon D YYYY" otherwise.
  function formatDateTime(value) {
    if (!value && value !== 0) return '';
    const s = String(value);

    // Try to extract YYYYMMDD and optional time digits (2-6 digits) following it
    // and optional timezone like ' UTC' or '-0700'
    const m = s.match(/(\d{8})(\d{2,6})?(?:\s*([+\-]\d{4}|UTC))?/i);
    if (m) {
      const y = m[1].slice(0,4);
      const mo = parseInt(m[1].slice(4,6),10);
      const d = parseInt(m[1].slice(6,8),10);
      if (isFinite(mo) && isFinite(d)) {
        const datePart = `${MONTHS_SHORT[mo-1]} ${d} ${y}`;
        const timePart = m[2] ? formatTimeFromDigits(m[2]) : null;
        const tzRaw = m[3] ? String(m[3]).toUpperCase() : null;
        const tz = tzRaw ? tzRaw.replace(/^(\+|\-)(\d{2})(\d{2})$/, (a,b,hh,mm)=>`${b}${hh}${mm}`) : null; // keep offsets as +HHMM/-HHMM or UTC
        if (timePart) {
          return tz ? `${timePart} ${tz}, ${datePart}` : `${timePart}, ${datePart}`;
        }
        return datePart;
      }
    }

    // fallback: try ISO / Date parsing
    try {
      const dt = new Date(s);
      if (!isNaN(dt.getTime())) {
        const hh = dt.getHours();
        const mm = dt.getMinutes();
        const timePart = formatTimeFromDigits(pad(hh) + pad(mm));
        const datePart = `${MONTHS_SHORT[dt.getMonth()]} ${dt.getDate()} ${dt.getFullYear()}`;
        // attempt to extract timezone from original string (e.g., -0700 or UTC)
        const tzMatch = s.match(/([+\-]\d{4}|UTC)/i);
        const tz = tzMatch ? String(tzMatch[1]).toUpperCase() : null;
        return timePart ? (tz ? `${timePart} ${tz}, ${datePart}` : `${timePart}, ${datePart}`) : datePart;
      }
    } catch (e) {
      // ignore
    }

    return s;
  }

  function formatMaybe(value) {
    if (value === null || value === undefined) return '';
    // If it's an array or object, stringify in a readable way
    if (Array.isArray(value)) return value.map(v => formatMaybe(v)).join(' ');
    if (typeof value === 'object') return JSON.stringify(value);
    // For strings/numbers try to format as date/time when possible
    return formatDateTime(value);
  }

  // incidents icon
    const incidentsIcon = L.icon({
        iconUrl: 'Data/icons/Incidents/incidents.png',
        iconSize: [28, 24],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });

  function buildPopupHtml(item) {
    const lat = item.latitude;
    const lon = item.longitude;
    const title = safe(item.location) || safe(item.name) || 'Incident';

    // Build the detail HTML; put large text into a fixed-height scrollable box
    let detailsHtml = '';
    const fields = ['type','area','route','milepost','severity','advice'];
    fields.forEach(f => {
      if (item[f]) detailsHtml += `<div><strong>${f.charAt(0).toUpperCase()+f.slice(1)}:</strong> ${safe(item[f])}</div>`;
    });

  if (item.starttime) detailsHtml += `<div><strong>Start Time:</strong> ${formatMaybe(item.starttime)}</div>`;
  if (item.updated) detailsHtml += `<div><strong>Updated:</strong> ${formatMaybe(item.updated)}</div>`;
  if (item.endtime) detailsHtml += `<div><strong>Clear Time:</strong> ${formatMaybe(item.endtime)}</div>`;

    // details and units may be arrays
    if (item.detail && item.detail.length) {
      detailsHtml += `<div style="margin-top:6px;"><strong>Details:</strong></div>`;
      // format each detail line; detail entries may be strings or arrays where first value is a timestamp
      const detailLines = item.detail.map(d => {
        if (Array.isArray(d)) {
          // format elements within the array (first element often a timestamp)
          return d.map(x => formatMaybe(x)).join(' ');
        }
        return formatMaybe(d);
      });
      detailsHtml += `<div>${detailLines.join('<br/>')}</div>`;
    }

    if (item.units && item.units.length) {
      detailsHtml += `<div style="margin-top:6px;"><strong>Responding Officer Status:</strong></div>`;
      const unitLines = item.units.map(u => {
        if (Array.isArray(u)) {
          // often [timestamp, status]
          const left = u.length > 0 ? formatMaybe(u[0]) : '';
          const rest = u.slice(1).map(x => formatMaybe(x)).join(' ');
          return (left ? left + ' ' : '') + rest;
        }
        return formatMaybe(u);
      });
      detailsHtml += `<div>${unitLines.join('<br/>')}</div>`;
    }

    const nwsLink = (lat && lon) ? `https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lon}` : '#';

    const html = `
      <div class="incident-popup" style="width:240px;">
        <div style="font-weight:700; margin-bottom:6px;">${title}</div>
        <div class="incident-details">
          ${detailsHtml || '<div>No additional information</div>'}
        </div>
        <div style="margin-top:8px; display:flex; justify-content:space-between;">
          <a target="_blank" href="${nwsLink}">NWS Forecast</a>
        </div>
      </div>
    `;

    return html;
  }

  function redraw() {
    if (cancelled) return;
    incidentsLayer.clearLayers();

    for (const it of allIncidents) {
      const lat = parseFloat(it.latitude);
      const lon = parseFloat(it.longitude);
      if (!isFinite(lat) || !isFinite(lon)) continue;

      const marker = L.marker([lat, lon], { icon: incidentsIcon, zIndexOffset: 300 });
      marker.bindPopup(buildPopupHtml(it), { maxWidth: 360, className: 'incident-popup-wrapper' });
      incidentsLayer.addLayer(marker);
    }
  }

  async function load() {
    try {
      const raw = await fetchJsonWithCache(jsonPath);
      if (cancelled || !Array.isArray(raw) || !Array.isArray(raw[0])) return;

      allIncidents = raw[0];
      redraw();
    } catch (err) {
      console.error('Failed to load incidents', err);
    }
  }

  load();

  return () => {
    cancelled = true;
    incidentsLayer.clearLayers();
  };
}
