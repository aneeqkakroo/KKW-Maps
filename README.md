# Kashmir Ke Waris

A free map-data editor with no registration or backend. Open `index.html` for the landing page or `districts.html` for the standalone editor.

Free-to-use GeoJSON maps of Kashmir, derived from OpenStreetMap, with a complete six-region display outline and available district boundaries. Accuracy is limited by the source snapshots: these are approximate, disputed boundaries, not survey-certified borders or a verified complete current district inventory. Reuse is free under ODbL 1.0 with OpenStreetMap attribution and applicable share-alike requirements.

## GeoJSON downloads

| Map | Repository download | Public URL |
|---|---|---|
| Complete six-region map | [GeoJSON](output/jammu_kashmir_six_regions.geojson) | [Download](https://maps.kashmirkewaris.org/geojson/jammu_kashmir_six_regions.geojson) |
| Available districts | [GeoJSON](output/jammu_kashmir_districts.geojson) | [Download](https://maps.kashmirkewaris.org/geojson/jammu_kashmir_districts.geojson) |
| AJK | [GeoJSON](output/districts_ajk.geojson) | [Download](https://maps.kashmirkewaris.org/geojson/districts_ajk.geojson) |
| GB | [GeoJSON](output/districts_gb.geojson) | [Download](https://maps.kashmirkewaris.org/geojson/districts_gb.geojson) |
| J&K (Jammu + Kashmir divisions) | [GeoJSON](output/districts_jk.geojson) | [Download](https://maps.kashmirkewaris.org/geojson/districts_jk.geojson) |
| Kashmir Division | [GeoJSON](output/districts_kashmir.geojson) | [Download](https://maps.kashmirkewaris.org/geojson/districts_kashmir.geojson) |
| Ladakh | [GeoJSON](output/districts_ladakh.geojson) | [Download](https://maps.kashmirkewaris.org/geojson/districts_ladakh.geojson) |

Public URLs reflect the configured deployment and require publishing the latest build. Use the six-region file for full geographic coverage; district files alone omit areas without district geometry.

## Features

- AJK, GB and J&K district templates with matching regional previews. J&K combines Jammu and Kashmir divisions; Ladakh remains separately available.
- Region, District and Pre Partition views; CSV import and manual values.
- Palettes, labels, sum/average summaries, LoC overlay and optional Kashmir Ke Waris watermark (Layers panel).
- PNG, SVG, CSV and GeoJSON exports; browser autosave, project files, snapshots and undo.
- District View contains 49 administrative districts plus geographic labels for **Aksai Chin** and **Shaksgam Valley**. These labels are not additional districts or numeric data rows.
- **Frontier Province includes Ladakh, Gilgit-Baltistan and Aksai Chin**, retaining the existing Shaksgam/Siachen display grouping. Kashmir Province combines Kashmir Division with Muzaffarabad, Neelam Valley and Hattian Bala. Jammu Province combines Jammu Division with the other seven AJK districts.

Province groupings use modern boundaries and are not verified pre-1947 surveys. District coverage is incomplete (Changthang is missing). See [source documentation](docs/SOURCES.md). Data attribution remains in exports independently of the watermark toggle.

## Repository layout

```
index.html, landing.css   Landing page
assets/                  Logo and generated map previews
districts.html           Generated standalone editor (do not edit directly)
src/editor/              Editor template, JavaScript and CSS
scripts/                 Python boundary builders and static-site packaging
tests/                   DOM and data regression tests
docs/                    Boundary provenance
output/                  GeoJSON, coverage reports and source-cache/
dist/                    Generated Vercel deployment (ignored)
```

The active `.venv/` is retained for local Python builds. Generated Python caches, Node dependencies and deployment files are ignored. OSM caches in `output/source-cache/` are retained so boundaries can be rebuilt without another download.

## Build and test

From the repository root in PowerShell:

```powershell
# Install JavaScript test dependencies (once)
npm.cmd ci

# Rebuild editor, provinces, LoC and landing previews from existing GeoJSON
.\.venv\Scripts\python.exe scripts/build_map_preview.py

# Prepare only public files for deployment, then test
npm.cmd run build
npm.cmd test

# Preview website
.\.venv\Scripts\python.exe -m http.server 8000 --directory dist
```

Open http://localhost:8000. If creating a fresh Python environment:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Rebuild district geometry with `.\.venv\Scripts\python.exe scripts/build_district_geojson.py`. Rebuild the six-region source output with `.\.venv\Scripts\python.exe scripts/build_kashmir_geojson.py`; network access is needed when its caches are absent or refreshed. The LoC cache is sourced separately from OSM relation 4609727.

## Vercel

Import the repository into Vercel. `vercel.json` runs `npm run build` and publishes `dist/`; no environment variables are required. The static build uses the committed generated `districts.html`, so Python is not needed on Vercel. Rebuild and commit that HTML after editing `src/editor/`. Source caches, tests and environments are excluded from the public build. This repository configuration does not itself create a live deployment.

## Using the studio

### Public boundary URLs

The static build publishes generated GeoJSON under `https://maps.kashmirkewaris.org/geojson/`. The directory index lists all downloads; `geojson/index.json` provides machine-readable names, URLs and feature counts. Public data responses allow cross-origin GET requests and use a five-minute cache lifetime. No accounts or API keys are required. Raw source caches are not published.

Main files:

- `/geojson/jammu_kashmir_districts.geojson` — all 49 available districts
- `/geojson/jammu_kashmir_six_regions.geojson` — six regions
- `/geojson/jammu_kashmir_provinces.geojson` — three province groupings
- `/geojson/jammu_kashmir_loc.geojson` — Line of Control
- `/geojson/districts_kashmir.geojson` — Kashmir districts (other region files follow the same naming)

```javascript
const response = await fetch('https://maps.kashmirkewaris.org/geojson/jammu_kashmir_districts.geojson');
if (!response.ok) throw new Error(`Boundary download failed: ${response.status}`);
const geojson = await response.json();
```

Retain OpenStreetMap contributor attribution and ODbL obligations when reusing the data. Province and gap collections retain their source limitations; an empty FeatureCollection is not missing HTTP content.

Choose a view, enter values or import CSV, then use Style and Layers to customise the map. CSV requires `id,value` or `name,region,value`; download the template to avoid ambiguous names. Imports reject invalid/ambiguous rows without partially applying data. Blank means no data; zero and negative numbers are supported. Sum/average uses entered values in visible areas; average ignores blanks and is not weighted. Values are independent across views.

All area labels appear by default, using connector lines for crowded locations. Watermark visibility is saved with projects and snapshots and applied to PNG/SVG exports. Older projects default to showing the watermark. The Chinaar Tech footer and OpenStreetMap data credit are independent credits.

Projects autosave locally when browser storage is available. Use Save project for a reliable backup or moving between devices. Nothing is uploaded. Clearing browser storage can erase local projects. Example values are demonstrations, not real statistics.
