import { buildDataPath, onTimestampChange } from './timestamps.js';
import { makeNumericIconFactory, createLayerUpdater, getZoomCountsDefault, bounds } from './layerUtils.js';

// Temperature Layer
export function loadTemperatureData(map, layers) {
  const tempLayer = layers['temperature'];
  if (!tempLayer) return;

  // initial paths
  let tempPath = buildDataPath('temp.json');
  let imageUrl = buildDataPath('temp.png');
  const imageBounds = bounds;

  // create updater object (not just cleanup function)
  const updater = createLayerUpdater({
    map,
    layer: tempLayer,
    dataPath: tempPath,
    ttlMs: 5 * 60 * 1000,
    useLocalStorage: false,
    normalize: undefined,
    iconForValue: makeNumericIconFactory('Data/icons/AirTemp', [28, 28]),
    popupFormatter: it => `<strong>Temp:</strong> ${it.value ?? 'n/a'}°F`,
    tooltipFormatter: it => `${it.value ?? 'n/a'}°F`,
    getSampleCount: getZoomCountsDefault,
    debounceMs: 250,
    overlayImage: imageUrl,
    overlayBounds: imageBounds,
    legendImage: 'Data/icons/Legends/temp.png'
  });

  // handle timestamp changes cleanly
  const unsubscribe = onTimestampChange(() => {
    const newJson = buildDataPath('temp.json');
    const newPng = buildDataPath('temp.png');

    // call updater.updatePaths (not cleanup.updatePaths)
    updater.updatePaths(newJson, newPng);
  });

  // return full cleanup function
  return () => {
    updater.cleanup();
    unsubscribe();
  };
}


