# SeniorProjectOSS

Files related to the One Stop Shop Senior Project for Dr. Galarus at Montana Tech. This project is meant to show Google maps API can be replaced with a free, open source alternative, leaflet.js.

The project was created by Brady Schiff (me), Alex Thompson, and James Brady.

This README documents the project layout and how to run it locally.

Files and purpose
- `index.html` — The main landing page. Loads CSS, Leaflet, and the app's entry point (`main.js`). Contains the map container and the layers control panel HTML.
- `site.css` — CSS styles
- `mapConfig.js` — Project configuration: map center/zoom, tile URL and options, and `LAYERS_DEFS` (the list of layer ids & labels used to generate blank layer groups).
- `mapInit.js` — Exports `initMap(containerId)` which initializes the Leaflet map, adds the base tile layer, and returns the map instance.
- `mapLayers.js` — Exports `createLayers(map)` which creates blank `L.layerGroup()` stubs for each entry in `mapConfig.js`. Use this file to implement the actual layer data (markers, tile overlays, GeoJSON, etc.) later.
- `ui.js` — Exports `initUI({ layersApi })` which wires the layers toggle control and the checkboxes to the `layersApi` returned by `createLayers()`.
- `main.js` — App entry point (ES module). Initializes the map, creates the blank layers, then wires the UI to the layers API.
- `markers.js` — Reads the JSON files and creates markers to match
- `clientCache.js` - Lightweight client-side caching utility for JSON fetches, supporting both in-memory and optional localStorage.
- `temperature.js` - Creates and populates a temperature layer. Uses a lat long grid system to display a processable amount of markers based on zoom level.
- `windGustSpeed.js` - Similar to temperature.js. Creates and exports a windGustSpeed layer that includes markers, raster image and legend. This file handles creation and removal of the layer from the map.
- `windSpeed.js` - Creates and exports the wind speed layer with markers, raster image overlay, and legend. Displays wind speed and direction with dynamic icons based on wind data.
- `weather.js` - Similar to temperature.js. Creates and exports weather layer, raster image and legend. Marker popups describe weather.
- `humidity.js` - Creates and exports the humidity layer, raster image and legend. Markers show the humidity percentage.
- `skyCover.js` - Creates and exports the sky cover layer, raster image and legend. Markers show the percentage of sky cover.
- `cctv.js` - Creates and exports the CCTV layer. This uses its own custom markers since functionality differs from the weather style markers.
- `cms.js` - Creates and exports the CMS (Changeable Message Sign) layer. Displays CMS signs with markers showing active/blank state and message content in popups.
- `rwis.js` - Creates and exports the RWIS (Road Weather Information System) layer. Displays RWIS station markers showing road and air temperature, road conditions, and links to NWS forecasts.
- `incidents.js` - Creates and exports the incidents layer. Displays incident markers with detailed formatting for timestamps, durations, and incident descriptions.
- `windCommon.js` - Shared code between the wind speed and wind gust layers
- `layerUtils.js` - Utility functions shared across multiple layers, including data fetching, marker sampling/gridding, image overlays, legend creation, and zoom-based rendering heuristics.
- `timestamps.js` - Manages available timestamps for time-series data and provides utilities to build data paths and notify listeners of timestamp changes.

Quick start (local)
1. Serve the folder (do not open `index.html` with `file://`). From the project root:

```bash
cd /path/to/SeniorProject
python3 -m http.server 8000
# open http://localhost:8000 in your browser
```

2. Open `http://localhost:8000` in your browser. The map will initialize and the layers panel will toggle. The layers created are currently empty stubs.
