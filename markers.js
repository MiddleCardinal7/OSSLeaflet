export function addDataMarkers(map, layerGroup, data, options = {}) {
  const {
    latField = 'lat',
    lonField = 'lon',
    coordField = 'coordinates',
    popupFormatter = null,
    tooltipFormatter = null,
    iconForValue = null,
    defaultIcon = null,
    onEachFeature = null,
    pointToLayer = null
  } = options || {};

  if (!data) return [];

  // Normalize input: if data is a JSON string, try to parse it.
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      // If it isn't valid JSON, attempt to strip leading/trailing quotes and parse again
      try {
        const stripped = data.trim().replace(/^"|"$/g, '');
        data = JSON.parse(stripped);
      } catch (e2) {
        console.warn('addDataMarkers: failed to parse string data', e2);
        return [];
      }
    }
  }

  // If data is a nested array wrapper like [[ ... ]], flatten one level
  if (Array.isArray(data) && data.length === 1 && Array.isArray(data[0])) {
    data = data[0];
  }

  if (data.type && (data.type === 'FeatureCollection' || data.type === 'Feature')) {
    const g = L.geoJSON(data, {
      pointToLayer: pointToLayer || ((feature, latlng) => L.marker(latlng)),
      onEachFeature: onEachFeature || ((feature, layer) => {
        const props = feature.properties || {};
        if (props.popup) layer.bindPopup(props.popup);
        if (props.tooltip) layer.bindTooltip(props.tooltip);
      })
    });
    if (layerGroup) layerGroup.addLayer(g); else g.addTo(map);
    return [g];
  }


  const items = Array.isArray(data)
    ? data
    : (Array.isArray(data.data) ? data.data : []);

  const markers = [];

  items.forEach(item => {
    let lat = null, lon = null;

    // GeoJSON-like geometry
    if (item?.geometry?.type === 'Point' && Array.isArray(item.geometry.coordinates)) {
      [lon, lat] = item.geometry.coordinates; // [lon, lat]
    }
    // Generic coordinate arrays
    else if (Array.isArray(item[coordField]) && item[coordField].length >= 2) {
      const arr = item[coordField];
      if (Math.abs(arr[0]) > 90) { lon = arr[0]; lat = arr[1]; } else { lat = arr[0]; lon = arr[1]; }
    }
    else if (Array.isArray(item.coordinates) && item.coordinates.length >= 2) {
      const arr = item.coordinates;
      if (Math.abs(arr[0]) > 90) { lon = arr[0]; lat = arr[1]; } else { lat = arr[0]; lon = arr[1]; }
    }
    // Numeric lat/lon fields (or numeric strings) - coerce to Number
    else if ((typeof item[latField] === 'number' || typeof item[latField] === 'string') 
             && (typeof item[lonField] === 'number' || typeof item[lonField] === 'string')) {
      const maybeLat = Number(item[latField]);
      const maybeLon = Number(item[lonField]);
      if (!Number.isNaN(maybeLat) && !Number.isNaN(maybeLon)) { lat = maybeLat; lon = maybeLon; }
    }
    else if ((typeof item.latitude === 'number' || typeof item.latitude === 'string')
             && (typeof item.longitude === 'number' || typeof item.longitude === 'string')) {
      const maybeLat = Number(item.latitude);
      const maybeLon = Number(item.longitude);
      if (!Number.isNaN(maybeLat) && !Number.isNaN(maybeLon)) { lat = maybeLat; lon = maybeLon; }
    }
    else if (item.location && (typeof item.location.lat === 'number' || typeof item.location.lat === 'string') 
             && (typeof item.location.lon === 'number' || typeof item.location.lon === 'string')) {
      const maybeLat = Number(item.location.lat);
      const maybeLon = Number(item.location.lon);
      if (!Number.isNaN(maybeLat) && !Number.isNaN(maybeLon)) { lat = maybeLat; lon = maybeLon; }
    }
    else if ((typeof item.lat === 'number' || typeof item.lat === 'string') 
             && (typeof item.lon === 'number' || typeof item.lon === 'string')) {
      const maybeLat = Number(item.lat);
      const maybeLon = Number(item.lon);
      if (!Number.isNaN(maybeLat) && !Number.isNaN(maybeLon)) { lat = maybeLat; lon = maybeLon; }
    }

    if (lat == null || lon == null) return; // skip invalid points

    // Check for valid ranges
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return;

    const value = item.value ?? item.properties?.value ?? null;
    let popupContent = popupFormatter
      ? popupFormatter(item)
      : (item.popup || item.properties?.popup || null);
    
    // Add NWS forecast link to popup content
    const nwsLink = `<br><a href="https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lon}" target="_blank">View NWS Forecast</a>`;
    popupContent = popupContent ? `${popupContent}${nwsLink}` : nwsLink;

    const tooltip = tooltipFormatter
      ? tooltipFormatter(item)
      : (item.tooltip || item.properties?.tooltip || null);
    const icon = iconForValue
      ? iconForValue(value, item)
      : (item.icon || defaultIcon || null);

    // Create and add marker
    const markerOpts = icon ? { icon } : {};
    const m = L.marker([lat, lon], markerOpts);
    if (popupContent) m.bindPopup(popupContent);
    if (tooltip) m.bindTooltip(tooltip);
    if (layerGroup) layerGroup.addLayer(m); else m.addTo(map);

    markers.push(m);
  });

  return markers;
}