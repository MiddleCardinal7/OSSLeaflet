import { createLayers } from './mapLayers.js';
import { initMap } from './mapInit.js';
import { initUI } from './ui.js';

// 1. init map
const map = initMap('map');

// 2. create layers (blank stubs for now)
const { layers, api: layersApi } = createLayers(map);

// 3. wire UI (assumes checkboxes in DOM)
initUI({ layersApi, map });
