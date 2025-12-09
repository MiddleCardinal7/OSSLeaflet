# One Stop Shop — Project Handoff

This file is a handoff document for the One Stop Shop (OSS) Leaflet port. It includes summary, architecture, developer notes, runbook, and helpful next steps.

---

## 1) Project Summary

- Project: One Stop Shop (Leaflet port of OSS)
- Purpose: Central map-driven UI for weather/road information layers (e.g., `temperature`, `windGustSpeed`, `rwis`, `cms`, `incidents`).
- Primary project goal: Replace Google Maps API with Leaflet.js and client-side data loading from local JSON files and raster overlays.
- Key deliverables included in repo:
  - Full-screen Leaflet landing page
  - Layer manager UI for toggling layers
  - Loaders for data-driven layers with client-side caching
  - Raster overlay support for images like `wgust.png`

---

## 2) Contacts & Handoff Checklist

- Project owner / Product contact: Dr. Douglas Galarus - dgalarus@mtech.edu
- Developers: Brady Schiff - bschiff@mtech.edu, James Brady - jbrady@mtech.edu, Alex Thompson - athompson5@mtech.edu

Checklist to transfer:
- Repo access
- One Drive files

---

## 3) Tech Stack & Key Concepts

- UI: HTML/CSS; project uses `index.html` and `site.css`.
- Map library: Leaflet.js (via CDN). The code uses ES modules (script `type="module"`).
- Data & assets: JSON in `Data/data/FORECAST_WEATHER/<timestamp>/` and icons in `Data/icons/`.
- Core modules (see Code Layout below): `main.js`, `mapInit.js`, `mapConfig.js`, `mapLayers.js`, `ui.js`, `clientCache.js`, `markers.js`, `temperature.js`, `windGustSpeed.js`.
- Caching: client side via `clientCache.js` (in-memory + optional localStorage fallback).

---

## 4) Code Layout & Main Files

- `index.html` — Main page. Loads `main.js` with script type="module".
- `site.css` — Layout & map CSS (full screen + control styling).
- `main.js` — Bootstraps the app: `initMap()`, `createLayers(map)` and call to `initUI`.
- `mapConfig.js` — Map center / zoom defaults and `LAYERS_DEFS` listing layers & metadata.
- `mapInit.js` — `initMap` returns a Leaflet `map` instance.
- `mapLayers.js` — `createLayers(map)` returns `layers` (L.layerGroup instances) and an `api` to `add`, `remove`, `toggle`, and `registerHooks`. Hook support lets loaders attach/detach.
- `ui.js` — Controls the layer manager UI and wires `layersApi` into the checkboxes.
- `clientCache.js` — Exports `fetchJsonWithCache` and `clearCache()`.
- `markers.js` — `addDataMarkers(map, layerGroup, data, options)` normalizes JSON shapes and creates markers.
- `temperature.js`, `windGustSpeed.js` — Data loaders for temperature and wind gust layers; include caching, sampling and cleanup. `windGustSpeed` uses `value` and `value2` for speed and angle and `Data/icons/Wind` icon naming.

---

## 5) Architecture & Layer Lifecycle

- `createLayers(map)` builds `{ layers, api }`. Each layer starts as an empty `L.layerGroup()`.
- `mapLayers` registers hooks (attach/detach) per layer. `attach()` starts the loader and the loader returns a cleanup function; `detach()` calls cleanup and clears layers.
- UI toggles call `layersApi.add(id)` or `layersApi.remove(id)`, which in turn call attach/detach.
- Loaders receive both `map` and `layers` for event binding and to add markers/overlays.

---

## 6) Data Layer Implementation Notes

- Fetching & caching
  - Use `fetchJsonWithCache(url, { ttlMs, useLocalStorage })` to fetch the JSON and avoid repeated network loads.
  - Set a reasonable TTL (default 5 minutes in code).

- Normalization
  - The `markers.js` helper normalizes multiple shapes including:
    - Plain arrays, arrays in arrays (e.g., `[[ ... ]]`), `json.data`, and GeoJSON FeatureCollections
    - `lat` & `lon` fields or numeric coordinates in `item.coordinates` or `geometry.coordinates`

- Sampling & Performance
  - Zoom-based sample counts control densitiy. When zoomed out, grid sampling computes `cols` and `rows` from a target sample count `nSample` and picks representative points per grid cell.
  - Debounced listeners on `moveend`/`zoomend` reduce rerendering.

- Marker creation
  - Use `markers.addDataMarkers` to centralize marker creation, tooltips and popups.
  - Use icon caching to avoid creating many identical `L.icon` instances.

- Wind specifics
  - `value` & `value2` in the `wgust.json` are used for speed and angle.
  - Angle is bucketed to nearest 22.5° using `bucketAngle()`; 360° becomes 0°.
  - Icon lookup uses `Data/icons/Wind/{speed}_{angle}.png` and caches icons.

- Raster overlay
  - `wgust.png` is added using `L.imageOverlay(imageUrl, bounds)`; `bounds` are computed from the normalized point extents and the overlay is added to `layers['windGustSpeed']` to ensure consistent toggling.

---

## 7) How to Add a New Layer (Developer flow)

1) Add a new definition in `mapConfig.js` (`LAYERS_DEFS`), e.g. { id: 'myLayer', name: 'My Layer' }.
2) Add an empty `L.layerGroup()` in `mapLayers.createLayers` (it's created automatically by the loop) and register hooks `hooks['myLayer'] = {...}` with  `attach()` and `detach()`.
3) Implement `loadMyLayer(map, layers)` in `myLayer.js` using `clientCache` and `markers` to create markers and return a cleanup function.
4) Add a checkbox entry in `index.html` / `ui.js` for the new layer.

---

## 8) Deployment & Runbook

- Local dev server, export funcitons require HTTP:

```bash
python -m http.server 8000
# or
npx http-server -p 8080
```

---

## 9) Testing & Acceptance

- Visual verification:
  - App loads with full screen map
  - Layers toggle and render markers
  - Grid sampling at low zooms; more points at high zooms
  - Wind layer uses angle & icon mapping with `Data/icons/Wind`
  - Raster overlay `wgust.png` aligns to point bounds

---

## 10) Delivery Items

- Repo: `SeniorProjectOSS` — ensure permissions transferred.
- Asset folders: `Data/` (JSON + icons). Ensure these are included in repository.
- Build and deployment instructions (repos README.md).

---

## 11) Next Steps

- Continue development of further OSS layers. Examples include snow, fire incidents, or chain requirements.
- Measure performance of Leaflet display against current Google Maps API display.
- Add error handling & fallback UI for missing data. Show user-friendly messages when JSON files fail to load, timestamps are missing, or when icons/rasters cannot be found.
- Migrate repeated logic into shared helper funcitons. Sampling, bounding box calculations, and grid normalization appear multiple times. Moving these into utils/ can reduce code duplication.

---

