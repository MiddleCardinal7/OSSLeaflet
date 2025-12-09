// cctv.js
import { fetchJsonWithCache } from './clientCache.js';

export function loadCCTVData(map, layers) {
    const cctvLayer = layers['cctv'];
    if (!cctvLayer) return;

    const jsonPath = 'Data/OSS-Data-2025-12-01/OSS_cctv.json';
    let cancelled = false;
    let allCameras = [];

    // -- determine how dense the markers should be based on zoom --
    function getSampleRate(zoom) {
        console.log("CCTV layer zoom:", zoom);
        if (zoom < 6) return 30;
        if (zoom < 7) return 15;  // very zoomed out
        if (zoom < 8) return 10;   // medium zoom
        if (zoom < 10) return 2;  // closer
        return 1;                 // fully detailed
    }

    // CCTV icon
    const cctvIcon = L.icon({
        iconUrl: 'Data/icons/cctv/CCTV.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });

    window.openCCTVImage = function(url) {
    const overlay = document.getElementById('cctv-lightbox');
    const img = document.getElementById('cctv-lightbox-img');
    if (!overlay || !img || !url) return;

    img.src = url;
    overlay.style.display = 'flex'; // show overlay

    // Clicking the overlay or image closes it
    overlay.onclick = () => {
        overlay.style.display = 'none';
        img.src = '';
    };
};

    // --- redraw markers based on zoom and bounds ---
    function redraw() {
        if (cancelled) return;

        cctvLayer.clearLayers();

        const zoom = map.getZoom();
        const bounds = map.getBounds();
        const step = getSampleRate(zoom);

        for (let i = 0; i < allCameras.length; i += step) {
            const cam = allCameras[i];
            const lat = parseFloat(cam.latitude);
            const lon = parseFloat(cam.longitude);
            if (!isFinite(lat) || !isFinite(lon)) continue;

            // OPTIONAL: only show markers inside the current map view
            if (!bounds.contains([lat, lon])) continue;

            const popupHtml = `
  <div style="position: relative; width: 300px;">
    <strong>${cam.location || 'CCTV Camera'}</strong><br>
    <em>${cam.nearby || ''}</em><br>
    Route: ${cam.route || ''}<br>
    Direction: ${cam.direction || ''}<br><br>
    ${cam.url?.[0] ? `<img src="${cam.url[0]}" width="300" id="cctv-img-${cam.uid}">` : ''}

    <div style="display: flex; justify-content: space-between; margin-top: 5px;">
      <a href="#" onclick="openCCTVImage('${cam.url?.[0]}'); return false;" style="font-size: 12px;">Enlarge Image</a>
      <a href="https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lon}" target="_blank" style="font-size: 12px;">NWS Forecast</a>
    </div>
  </div>
`;


            const marker = L.marker([lat, lon], { icon: cctvIcon, zIndexOffset: 400 })
                .bindPopup(popupHtml, {
                    autoClose: true,
                    closeButton: false,
                    className: "cctv-popup"
                })
                .on("mouseover", function () {
                    this.openPopup();
                })
            cctvLayer.addLayer(marker);

        }
    }

    async function load() {
        try {
            const raw = await fetchJsonWithCache(jsonPath);
            if (cancelled || !Array.isArray(raw) || !Array.isArray(raw[0])) return;

            allCameras = raw[0];
            redraw(); // initial draw

            // update when zoom or map view changes
            map.on('zoomend moveend', redraw);

        } catch (err) {
            console.error("Error loading CCTV data:", err);
        }
    }

    load();

    // --- detach cleanup ---
    return () => {
        cancelled = true;
        map.off('zoomend', redraw);
        map.off('moveend', redraw);
        cctvLayer.clearLayers();
    };
}

