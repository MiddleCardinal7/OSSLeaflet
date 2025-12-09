import { buildDataPath, onTimestampChange } from './timestamps.js';
import { makeNumericIconFactory, createLayerUpdater, getZoomCountsDefault, bounds } from './layerUtils.js';

// Temperature Layer
export function loadHumidityData(map, layers) {
  const tempLayer = layers['humidity'];
  if (!tempLayer) return;

  // initial paths
  let tempPath = buildDataPath('rhm.json');
  let imageUrl = buildDataPath('rhm.png');
  const imageBounds = bounds;

  // create updater object (not just cleanup function)
  const updater = createLayerUpdater({
    map,
    layer: tempLayer,
    dataPath: tempPath,
    ttlMs: 5 * 60 * 1000,
    useLocalStorage: false,
    normalize: undefined,
    iconForValue: makeNumericIconFactory('Data/icons/Humidity', [28, 28]),
    popupFormatter: it => `<strong>Humidity:</strong> ${it.value ?? 'n/a'}%`,
    tooltipFormatter: it => `${it.value ?? 'n/a'}%`,
    getSampleCount: getZoomCountsDefault,
    debounceMs: 250,
    overlayImage: imageUrl,
    overlayBounds: imageBounds,
    legendImage: 'Data/icons/Legends/humidity.png'
  });

  // handle timestamp changes cleanly
  const unsubscribe = onTimestampChange(() => {
    const newJson = buildDataPath('rhm.json');
    const newPng = buildDataPath('rhm.png');

    // call updater.updatePaths (not cleanup.updatePaths)
    updater.updatePaths(newJson, newPng);
  });

  // return full cleanup function
  return () => {
    updater.cleanup();
    unsubscribe();
  };
}
