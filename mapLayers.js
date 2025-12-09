import { LAYERS_DEFS } from './mapConfig.js';
import { loadWindGustLayer } from './windGustSpeed.js';
import { loadWindSpeedLayer } from './windSpeed.js';
import { loadTemperatureData } from './temperature.js';
import { loadSkyCoverData } from './skyCover.js';
import { loadHumidityData } from './humidity.js';
import { loadWeatherData } from './weather.js';
import { loadIncidentData } from './incidents.js';
import {loadCCTVData} from './cctv.js';
import { loadCMSData } from './cms.js';
import { loadRwisData } from './rwis.js';

const WEATHER_LAYERS = ['temperature', 'skyCover', 'humidity', 'windSpeed', 'windGustSpeed', 'weather'];

export function createLayers(map) {
  const layers = {};
  const hooks = {};

  // Create empty LayerGroups for all layers
  LAYERS_DEFS.forEach(def => {
    layers[def.id] = L.layerGroup();
  });

  // --- Attach/Detach hooks ---
  const setupHook = (id, loader) => {
    let cleanup = null;
    hooks[id] = {
      attach() { cleanup = loader(map, layers); },
      detach() {
        if (typeof cleanup === 'function') { cleanup(); cleanup = null; }
        if (layers[id]) layers[id].clearLayers();
      }
    };
  };

  setupHook('windGustSpeed', loadWindGustLayer);
  setupHook('windSpeed', loadWindSpeedLayer);
  setupHook('temperature', loadTemperatureData);
  setupHook('skyCover', loadSkyCoverData);
  setupHook('humidity', loadHumidityData);
  setupHook('weather', loadWeatherData);
  setupHook('cctv', loadCCTVData);
  setupHook('cms', loadCMSData);
  setupHook('rwis', loadRwisData);
  setupHook('incidents', loadIncidentData);

  // --- API ---
  const api = {
    getLayer(id) { return layers[id]; },
    registerHooks(id, h) { hooks[id] = h; },

    add(id) {
      if (!layers[id]) return;

      // If it's a weather layer, remove all other weather layers first
      if (WEATHER_LAYERS.includes(id)) {
        WEATHER_LAYERS.forEach(otherId => {
          if (otherId !== id && map.hasLayer(layers[otherId])) {
            this.remove(otherId);
          }
        });
      }

      map.addLayer(layers[id]);
      hooks[id]?.attach?.();

      // Sync checkbox
      const cb = document.getElementById(id);
      if (cb) cb.checked = true;
    },

    remove(id) {
      if (!layers[id]) return;
      map.removeLayer(layers[id]);
      hooks[id]?.detach?.();

      // Sync checkbox
      const cb = document.getElementById(id);
      if (cb) cb.checked = false;
    },

    toggle(id) {
      if (map.hasLayer(layers[id])) this.remove(id);
      else this.add(id);
    },

    list() { return Object.keys(layers); }
  };

  return { layers, api };
}
