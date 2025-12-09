// exports simple constants
export const MAP_CENTER = [41.0, -112.0];
export const MAP_ZOOM = 6;
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_OPTIONS = {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
};

// layer metadata (id, label, factory)
export const LAYERS_DEFS = [
  { id: 'cctv', label: 'CCTV' },
  { id: 'cms', label: 'CMS (Changeable Message Sign)' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'rwis', label: 'RWIS (Road Weather Information System)' },
  { id: 'chainRequirements', label: 'Chain Requirements' },
  { id: 'weather', label: 'Weather' },
  { id: 'windSpeed', label: 'Wind Speed' },
  { id: 'windGustSpeed', label: 'Wind Gust Speed' },
  { id: 'temperature', label: 'Temperature' },
  { id: 'humidity', label: 'Relative Humidity' },
  { id: 'skyCover', label: 'Sky Cover' },
  { id: 'snow', label: 'Snow' },
  { id: 'fireIncidents', label: 'Fire Incidents' }
];