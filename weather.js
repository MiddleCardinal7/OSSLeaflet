import { buildDataPath, onTimestampChange } from './timestamps.js';
import { makeStringIconFactory, createLayerUpdater, getZoomCountsDefault, bounds } from './layerUtils.js';

// Weather Layer
export function loadWeatherData(map, layers) {
  const wxLayer = layers['weather'];
  if (!wxLayer) return;

  // initial paths
  const wxPath = buildDataPath('wx.json');
  const imageUrl = buildDataPath('wx.png');
  const imageBounds = bounds;

  // string-based icon factory (value maps directly to filename)
  const iconForValue = makeStringIconFactory(
    'Data/icons/wx', 
    [28, 28], 
    [14, 14], 
    v => String(v) // use the value exactly as-is
  );
  
  function checkSunny(it) {
    if (it === 'None') {
      return 'Sunny'
    } else return it;
  }

  // create updater object
  const updater = createLayerUpdater({
    map,
    layer: wxLayer,
    dataPath: wxPath,
    ttlMs: 5 * 60 * 1000,
    useLocalStorage: false,
    normalize: undefined,
    iconForValue,
    popupFormatter: it => `<strong>Weather:</strong> ${checkSunny(it.value) ?? 'n/a'}`,
    tooltipFormatter: it => `${checkSunny(it.value) ?? 'n/a'}`,
    getSampleCount: getZoomCountsDefault,
    debounceMs: 250,
    overlayImage: imageUrl,
    overlayBounds: imageBounds,
    legendImage: 'Data/icons/Legends/wx.png'
  });

  // handle timestamp changes
  const unsubscribe = onTimestampChange(() => {
    const newJson = buildDataPath('wx.json');
    const newPng = buildDataPath('wx.png');
    updater.updatePaths(newJson, newPng);
  });

  return () => {
    updater.cleanup();
    unsubscribe();
  };
}
