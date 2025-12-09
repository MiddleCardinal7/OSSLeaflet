// initUI: wires a toggle element (button or div) and a panel with checkboxes to a layers API
import { loadTimestamps, getTimestamps, getCurrentTimestamp, setCurrentTimestamp } from './timestamps.js';
import { createLegendControl } from './layerUtils.js';

export function initUI({ layersApi, map = null, panelId = 'layersPanel', toggleId = 'layersToggle' } = {}) {
  const panel = document.getElementById(panelId);
  const toggle = document.getElementById(toggleId);

  if (!panel || !toggle) {
    console.warn('initUI: missing DOM elements', { panelId, toggleId });
    return;
  }

  function setPanelOpen(open) {
    panel.style.display = open ? 'block' : 'none';
    toggle.setAttribute('aria-expanded', String(open));
    panel.setAttribute('aria-hidden', String(!open));
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    setPanelOpen(panel.style.display !== 'block');
  });

  // keyboard accessibility (Enter/Space)
  toggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setPanelOpen(panel.style.display !== 'block');
    }
  });

  // wire checkboxes
  panel.querySelectorAll('input[type="checkbox"][data-layer-id]').forEach(cb => {
    const id = cb.dataset.layerId;
    cb.addEventListener('change', (e) => {
      if (!layersApi) return console.warn('initUI: no layersApi provided');
      if (e.target.checked) {
        layersApi.add(id);
        // if this checked layer is inside the forecast group, reset timestamp to first
        const forecastGroup = cb.closest('.layer-group[data-group="forecast"]');
        if (forecastGroup) {
          const tsSelect = document.getElementById('timestampSelect');
          if (tsSelect && tsSelect.options.length) {
            tsSelect.value = tsSelect.options[0].value;
            try { setCurrentTimestamp(tsSelect.value); } catch (e) { /* ignore */ }
            // update prev/next/label controls if present
            const listNow = Array.from(tsSelect.options).map(o => o.value);
            updateControls(listNow, tsSelect.value);
          }
        }
      } else {
        layersApi.remove(id);
      }
    });
  });

  // Layer group toggles: when one category is opened, disable all layers from the other
  const groups = Array.from(panel.querySelectorAll('.layer-group'));
  function setGroupOpen(groupEl, open) {
    const header = groupEl.querySelector('.group-header');
    const content = groupEl.querySelector('.group-content');
    if (header) header.setAttribute('aria-expanded', String(open));
    if (content) content.style.display = open ? 'block' : 'none';
  }

  function closeOtherGroups(openGroupEl) {
    groups.forEach(g => {
      if (g === openGroupEl) return;
      // collapse UI
      setGroupOpen(g, false);
      // if we're closing the road group ensure its legend is removed
      try {
        if (g.getAttribute && g.getAttribute('data-group') === 'road') updateRoadLegend(false);
      } catch (err) { /* ignore */ }
      // uncheck and remove any active layers in this group
      g.querySelectorAll('input[type="checkbox"][data-layer-id]:checked').forEach(cb => {
        try {
          cb.checked = false;
          const id = cb.dataset.layerId;
          if (layersApi) layersApi.remove(id);
        } catch (e) { /* ignore */ }
      });
    });
  }

  // wire group header buttons
  groups.forEach(g => {
    const header = g.querySelector('.group-header');
    const content = g.querySelector('.group-content');
    if (!header || !content) return;
    header.addEventListener('click', (e) => {
      const isOpen = header.getAttribute('aria-expanded') === 'true';
      // toggle this group
      setGroupOpen(g, !isOpen);
      if (!isOpen) {
        // We just opened this group -> close others and disable their layers
        closeOtherGroups(g);
      }
      // Show/hide the Road/Travel legend when its group opens/closes
      try {
        const groupName = g.getAttribute('data-group');
        const opened = !isOpen;
        if (groupName === 'road') updateRoadLegend(opened);
      } catch (err) { /* ignore */ }
    });
    // keyboard
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        header.click();
      }
    });
  });

  // default: open road group (data-group="road") and close others
  const defaultRoad = panel.querySelector('.layer-group[data-group="road"]');
  if (defaultRoad) {
    setGroupOpen(defaultRoad, true);
    closeOtherGroups(defaultRoad);
  }

  // --- Road/Travel legend control management ---
  // Use the legend image from Data/icons/Legends/RoadTravelConditions.png
  let roadLegendControl = null;
  function updateRoadLegend(show) {
    if (!map) return; // map may be null in some contexts
    try {
      if (show) {
        if (!roadLegendControl) {
          roadLegendControl = createLegendControl('Data/icons/Legends/RoadTravelConditions.png', 'bottomleft');
        }
        try { roadLegendControl.addTo(map); } catch (e) { /* ignore if already added */ }
      } else {
        if (roadLegendControl) {
          try { map.removeControl(roadLegendControl); } catch (e) { /* ignore */ }
        }
      }
    } catch (err) {
      console.warn('Failed to update Road legend', err);
    }
  }

  // Ensure legend initial state matches the default road group open state
  if (defaultRoad) {
    const header = defaultRoad.querySelector('.group-header');
    const isOpen = header && header.getAttribute('aria-expanded') === 'true';
    updateRoadLegend(Boolean(isOpen));
  }

  // --- Move timestamp-controls into a floating control over the map so it appears above legends ---
  const timestampControls = panel.querySelector('.timestamp-controls');
  const mapEl = document.getElementById('map');
  let mapTsOverlay = null;
  if (timestampControls && mapEl) {
    // create overlay container
    mapTsOverlay = document.createElement('div');
    mapTsOverlay.id = 'map-timestamp-overlay';
    // minimal inline styles; css class exists in site.css
    mapTsOverlay.style.position = 'absolute';
    mapTsOverlay.style.left = '10px';
    mapTsOverlay.style.bottom = '50px';
    mapTsOverlay.style.zIndex = '650';
    mapTsOverlay.style.pointerEvents = 'auto';
    mapTsOverlay.style.display = 'none'; // hidden by default; shown when forecast group opens
    mapTsOverlay.className = 'map-timestamp-overlay';
    // move the timestamp controls into the overlay
    mapTsOverlay.appendChild(timestampControls);
    // prevent double-clicks (and other click events) inside the timestamp overlay from
    // propagating to the map — this stops the map from zooming when the user double-clicks
    // the timestamp selector. Prefer Leaflet helper if available.
    try {
      if (typeof L !== 'undefined' && L.DomEvent && L.DomEvent.disableClickPropagation) {
        L.DomEvent.disableClickPropagation(mapTsOverlay);
      } else {
        // fallback: stop dblclick propagation and mousedown to be safe
        mapTsOverlay.addEventListener('dblclick', (ev) => { ev.stopPropagation(); ev.preventDefault(); });
        mapTsOverlay.addEventListener('mousedown', (ev) => { ev.stopPropagation(); });
      }
    } catch (err) {
      // non-fatal — ignore
      console.warn('ui: failed to attach click propagation handlers for timestamp overlay', err);
    }
    // ensure the map container is positioned so absolute works
    mapEl.style.position = mapEl.style.position || 'relative';
    mapEl.appendChild(mapTsOverlay);

    // toggle overlay visibility when groups open/close
    const forecastGroupEl = panel.querySelector('.layer-group[data-group="forecast"]');
    function showOverlayForForecast(open) {
      if (!mapTsOverlay) return;
      mapTsOverlay.style.display = open ? 'block' : 'none';
    }
    // initial state: overlay visible only if forecast group is open
    const fgHeader = forecastGroupEl && forecastGroupEl.querySelector('.group-header');
    const fgOpen = fgHeader && fgHeader.getAttribute('aria-expanded') === 'true';
    showOverlayForForecast(Boolean(fgOpen));

    // update overlay visibility when group headers are clicked
    groups.forEach(g => {
      const header = g.querySelector('.group-header');
      if (!header) return;
      header.addEventListener('click', () => {
        const isOpen = header.getAttribute('aria-expanded') === 'true';
        const groupName = g.getAttribute('data-group');
        if (groupName === 'forecast') showOverlayForForecast(isOpen);
        else showOverlayForForecast(false);
      });
    });
  }

  // wire timestamp selector if present (and prev/next controls)
  const tsSelect = document.getElementById('timestampSelect');
  const tsPrev = document.getElementById('tsPrev');
  const tsNext = document.getElementById('tsNext');
  const tsLabel = document.getElementById('timestampLabel');

  function formatTimestamp(ts) {
    if (!ts) return '';
    const s = String(ts);
    // Expect YYYYMMDDHHmm or at least YYYYMMDDHH
    if (s.length >= 12) {
      const y = s.slice(0,4), m = s.slice(4,6), d = s.slice(6,8), hh = s.slice(8,10), mm = s.slice(10,12);
      return `${y}-${m}-${d} ${hh}:${mm} MST`;
    }
    if (s.length >= 10) {
      const y = s.slice(0,4), m = s.slice(4,6), d = s.slice(6,8), hh = s.slice(8,10);
      return `${y}-${m}-${d} ${hh}:00 MST`;
    }
    return s;
  }

  function updateControls(list, current) {
    if (!tsLabel) return;
    tsLabel.textContent = formatTimestamp(current) || String(current || '');
    if (!tsPrev || !tsNext || !tsSelect) return;
    const idx = list.indexOf(String(current));
    tsPrev.disabled = idx <= 0;
    tsNext.disabled = idx === -1 || idx >= list.length - 1;
  }

  if (tsSelect) {
    // load timestamps and populate select
    loadTimestamps().then(list => {
      const persisted = localStorage.getItem('oss_timestamp');
      // clear
      tsSelect.innerHTML = '';
      list.forEach(ts => {
        const opt = document.createElement('option');
        opt.value = ts;
        opt.textContent = ts;
        tsSelect.appendChild(opt);
      });
      // choose persisted or earliest
      if (persisted && list.includes(persisted)) tsSelect.value = persisted; else if (list.length) tsSelect.value = list[0];
      // set current timestamp (this will emit event)
      setCurrentTimestamp(tsSelect.value);

      // set label and prev/next enabled state
      updateControls(list, tsSelect.value);

      // wire prev/next
      if (tsPrev) tsPrev.addEventListener('click', () => {
        const listNow = Array.from(tsSelect.options).map(o => o.value);
        const idx = listNow.indexOf(tsSelect.value);
        if (idx > 0) {
          tsSelect.value = listNow[idx - 1];
          setCurrentTimestamp(tsSelect.value);
          updateControls(listNow, tsSelect.value);
        }
      });
      if (tsNext) tsNext.addEventListener('click', () => {
        const listNow = Array.from(tsSelect.options).map(o => o.value);
        const idx = listNow.indexOf(tsSelect.value);
        if (idx < listNow.length - 1) {
          tsSelect.value = listNow[idx + 1];
          setCurrentTimestamp(tsSelect.value);
          updateControls(listNow, tsSelect.value);
        }
      });

    }).catch(err => console.warn('initUI: failed to load timestamps', err));

    tsSelect.addEventListener('change', (e) => {
      setCurrentTimestamp(e.target.value);
      const listNow = Array.from(tsSelect.options).map(o => o.value);
      updateControls(listNow, e.target.value);
    });
  }

  // close when clicking outside
  document.addEventListener('click', (ev) => {
    if (!panel.contains(ev.target) && ev.target !== toggle) {
      setPanelOpen(false);
    }
  });
}