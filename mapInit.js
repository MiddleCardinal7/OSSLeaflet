import { MAP_CENTER, MAP_ZOOM, TILE_URL, TILE_OPTIONS } from './mapConfig.js';

export function initMap(containerId = 'map') {
  const map = L.map(containerId, { maxZoom: 19, minZoom: 4, zoomControl: false })
    .setView(MAP_CENTER, MAP_ZOOM);

  L.control.zoom({ position: 'topright' }).addTo(map);

  L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);

  return map;
}