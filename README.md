# Jammu & Kashmir six-region GeoJSON builder

## Kashmir Ke Waris website

Open `index.html` for the public landing page, or `districts.html` for the editor. No accounts, registration, payments or backend are needed. The landing page includes previews of actual boundary geometry and links to all three editor views. The studio logo returns home. Downloaded `districts.html` still works as a standalone editor; its home link needs the website's `index.html`.

Prepare the Vercel deployment with `npm run build` (`npm.cmd run build` in PowerShell if script execution is restricted). The dependency-free Node build copies only public assets into `dist/`. `vercel.json` specifies the build command and output directory. Import the repository into your Vercel account as a project; no environment variables are required. A live Vercel deployment has not been created by this change. Confirm your hosting plan permits your intended use.

To preview locally, run `.\.venv\Scripts\python.exe -m http.server 8000 --directory dist`, then visit `http://localhost:8000`. The deployed site serves `index.html` at its root. Source caches, virtual environments, tests and other development files are not copied into `dist/`.

Edit the landing page in `index.html` and `landing.css`; map previews live in `assets/`. Rebuild the editor with `build_map_preview.py` after editor source changes, then run the static site build.

## Kashmir Map Studio

Open **`districts.html`** directly in a browser. It is a single-file map-data editor with embedded boundary data and an SVG canvas. Copy this file alone to share the tool; no installation, account, tile server or internet connection is required. The editor supports **Region View**, **District View**, and **Pre Partition Regions**. It is ready for static hosting but has not been published to a public URL.

1. Choose a view and optionally filter to a region or province.
2. Enter numeric values in **Data**, click a polygon to focus its row, or upload/paste CSV. Download **Template CSV** for exact IDs. Imports require `id,value` or `name,region,value`; ambiguous names, duplicates, unknown areas and invalid numbers prevent the import and produce row errors. Valid imports update matching rows, retaining other values. Blank means no data; zero and negative values are supported. Use plain numbers without thousands separators or currency symbols.
3. Use **Style** for titles, subtitles, source, author, palettes, reversal, units, labels, borders and canvas colour. Colours and sums reflect the currently visible areas. All area labels are shown by default; crowded labels use nearby callouts with connector lines. Use a region filter or smaller label size for more space. Prefixes/suffixes are display formatting, not numeric conversion. Choose Sum or Average under Summary calculation. Average is the arithmetic mean of entered values in visible areas, including zero and ignoring blanks; it is not weighted.
4. Toggle LoC and coverage gaps under **Layers**. **Slides** stores restorable map snapshots within the project.
5. **Export** produces PNG (2000 × 1800), SVG, CSV or GeoJSON. Exports retain attribution. GeoJSON includes visible polygons with `value` properties and the LoC if enabled. **Save project** downloads editable values, styles and snapshots; **Open project** restores them. Values are separate for each map view, with no automatic district-to-region aggregation. **Undo** restores up to 30 prior changes.

The browser attempts local autosave; use Save project for a portable, reliable backup, especially with file URLs or private browsing. Nothing is uploaded. **Load example** uses explicitly labelled demonstration data; it is not real statistics. No public accounts, cloud collaboration or hosting backend is included.

The **Line of Control** checkbox toggles the red dashed India–Pakistan line in all three views. It uses OSM relation [4609727](https://www.openstreetmap.org/relation/4609727), preserving source discontinuities. It does not extend the LoC into the AGPL or India–China LAC. The source is approximate and is not a live military-control map.

The pre-partition view implements the requested grouping using modern geometry:

- **Kashmir Province:** Kashmir Division (the existing Valley approximation) + Muzaffarabad + Neelam Valley + Hattian Bala districts.
- **Jammu Province:** Jammu Division + the other seven AJK districts.
- **Frontier Province:** the existing Ladakh + GB region polygons, retaining their Siachen/Shaksgam display grouping.

Aksai Chin remains grey and unassigned. Small enclosed boundary seams are filled in the province layer. These are user-defined historical groupings, not verified historical province boundaries or present-day administration.

To edit the tool, change `map.template.html`, `map-editor.css`, `map-editor-core.js` or `map-editor.js`, then run `.\.venv\Scripts\python.exe build_map_preview.py`. This generates `districts.html` and the province/LoC GeoJSON files. Do not edit the generated HTML directly. The district builder also regenerates the editor. The LoC cache is `output/source-cache/loc-relation.json`.

For development tests, install `npm install --prefix .qa --no-save --package-lock=false jsdom` and run `node test-map-editor.cjs`. Tests cover data parsing, ambiguous names, SVG rendering, filters, imports, values, LoC, snapshots, exports, undo and project validation under both file and HTTP URLs. Browser PNG download and interactive layout still require manual browser QA.

## District-level GeoJSON

The generated [district dataset](output/jammu_kashmir_districts.geojson) contains **49 mapped district features**: AJK 10, Gilgit-Baltistan 13, Jammu 10, Kashmir 10 and Ladakh 6. This is an incomplete source inventory, not a claim that all current districts are present.

Rebuild from the existing OSM source caches and six-region output:

```powershell
.\.venv\Scripts\python.exe build_district_geojson.py
.\.venv\Scripts\python.exe -m http.server 8000
```

Open [the district map](http://localhost:8000/districts.html) to select regions and districts, inspect names, and download the combined GeoJSON. The existing region viewer remains at `preview.html`.

You can open `districts.html` directly in a browser. Its source assets are only needed for rebuilding. IDE previews must allow JavaScript; otherwise use an external browser. Rebuild after changing source GeoJSON to update the embedded data.

The editor starts in District View with a plain background and empty values. It requests no external tiles, so exported images and direct-file previews do not depend on OSM tile access.

Outputs include `districts_<region_id>.geojson` for each of the six regions, `jammu_kashmir_districts.geojson`, `jammu_kashmir_district_gaps.geojson`, and `district_coverage_report.json`. Aksai Chin's district collection is empty because county geometry is unavailable in the source caches. The gap layer preserves its full region outline and other uncovered areas, including Shaksgam; gap features are **not districts**.

Features have stable region-prefixed OSM IDs, `name`, `region_id`, `region_name`, `osm_relation_id`, `source_url`, `source_snapshot`, `admin_level`, and `clipped_to_region`. Coordinates are longitude/latitude (EPSG:4326). District geometry is clipped to the existing six-region masks, retaining that project's disputed-area display choices. No Google Maps data is used.

Source caches date from May–July 2026. Newest available objects take precedence. All source polygons are repaired if needed; overlap and uncovered-area diagnostics are reported without inventing district borders. Diagnostic fractions use degree-squared area, not physical land area. Small gaps can reflect mismatched source snapshots and masks.

**Known inventory gaps:** Ladakh's source has six district relations and lacks Changthang, although the administration announced seven districts in April 2026. Leh may still contain pre-split territory, so near-complete geometric coverage does not imply administrative completeness. GB has 13 source districts and has not been verified as a complete current inventory. Aksai Chin and Shaksgam have no county boundaries in these caches. Live Overpass requests during preparation returned HTTP 406/429, so outputs use cached data. OSM attribution and ODbL apply to these derived files.

This is a **source-aware builder**, **not a verified boundary GeoJSON**. It uses OSM boundary relations to assemble six individually selectable polygon layers with an outer composite outline and optional disputed-area overlays. **The script must be run online** to produce GeoJSON; geographic source data is not bundled here.

## Windows (PowerShell)

Open a terminal in this folder:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe build_kashmir_geojson.py
```

In VS Code, select `.venv\Scripts\python.exe` using **Python: Select Interpreter**. These commands use the virtual environment directly, so PowerShell activation is optional.

On macOS/Linux, create the environment with `python3 -m venv .venv` and use `.venv/bin/python` for installation and execution. Run from the same folder so `requirements.txt` resolves. Running may take several minutes because Overpass servers can be busy. If needed try:

```powershell
.\.venv\Scripts\python.exe build_kashmir_geojson.py --endpoint https://overpass-api.de/api/interpreter
```

After a successful run:

```
output/
  jammu_kashmir_six_regions.geojson
  jammu_kashmir_outer_outline.geojson
  jammu_kashmir_special_overlays.geojson
  source-cache/
```

The first is a `FeatureCollection` containing **six real Polygon/MultiPolygon features** with IDs `ajk`, `gb`, `jammu`, `kashmir`, `ladakh`, and `aksai_chin` for React button selection. No API keys are required.

### Core caveats

- No published boundary set can be described as universally **exact 1947 borders** in the disputed sectors. This is a high-detail modern-OSM *approximation* of the historical Kashmir footprint, not a surveyed historical reconstruction.
- AJK, GB, Jammu, Kashmir Division and Ladakh come from contemporary OSM relations and/or districts. They are not equivalent to administrative boundaries in 1947.
- **Shaksgam** is grouped into the clickable `gb` polygon **only for historical-state map organisation**, while a separate Shaksgam overlay retains its distinct status. The Shaksgam Tract is presently administered by China; group assignment does not express sovereignty.
- **Siachen** has a separate glacier overlay and is included in the Ladakh selection. The glacier outline is **not** the whole Siachen disputed sector and does not fix the Actual Ground Position Line (AGPL).
- The `kashmir` selector denotes the *Kashmir administrative division*, not the narrower geographic Kashmir Valley.
- Outer outline is assembled from the union of six polygons. Reference OSM region relation 14101768 is compared as a diagnostic, not blindly imposed.
- The OpenStreetMap wiki acknowledges limitations in locally mapped Kashmir district boundaries. You must visually review these and contested sectors before publicly presenting them as authoritative.

### Preview on an interactive map

Run `python -m http.server 8000` from this folder, then open [http://localhost:8000/preview.html](http://localhost:8000/preview.html). The viewer requires internet to load Leaflet tiles. It highlights a region when clicked in the map or selected using a button.

### Licence and attribution

Boundary data © OpenStreetMap contributors, available under the Open Database License (ODbL). See <https://www.openstreetmap.org/copyright>. If you adapt and publicly use this dataset, follow ODbL obligations; source data is recorded in the output's `metadata` object.

See `SOURCES.md` for exact source relation identifiers and checks.

Map exports include a Kashmir Ke Waris watermark and Chinaar Tech footer credit, with a separate compact OpenStreetMap data attribution.
#   K K W - M a p s  
 