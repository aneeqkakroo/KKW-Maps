# Traceable source identifiers

## District layer

`build_district_geojson.py` uses cached OSM relation membership (`subarea`) to identify AJK and GB districts at admin level 6 and Ladakh districts at admin level 5. Jammu and Kashmir use the explicit relation lists below. It retains subarea geometries during conversion, selects newer cached objects by source timestamp, and clips district polygons to the six-region output. Each exported district records its source relation URL and snapshot. The output coverage report lists every exported district and missing geometry.

- Cached snapshots: `main.json` May 6, 2026; `claims.json` and `jammu-districts.json` July 15, 2026.
- [Ladakh administration: seven districts notified, April 27, 2026](https://ladakh.gov.in/historic-milestone-for-ladakh-five-new-districts-notified-in-ladakh-taking-total-districts-to-seven/). Only six district relations are available in the cache; Changthang is unresolved.
- [OSM China boundary conventions](https://wiki.openstreetmap.org/wiki/China/Boundaries): county-level boundaries use admin level 6. No such county geometry for Aksai Chin or Shaksgam is present in the cached dataset.

The district output is a source-based partial administrative inventory. Neither Google Maps equivalence nor current administrative completeness has been verified.

All OSM relations are from community mapping, not cadastral/legal determinations. The script downloads the latest geometry from the OSM Overpass API at execution time.

| Data | OSM relation ID | Reference |
|---|---:|---|
| Azad Jammu and Kashmir | 3780130 | Wikidata Q200130 |
| Gilgit-Baltistan | 357995 | Wikidata Q200697 |
| Kashmir Division | 13424056 | Wikidata Q3712126 |
| Ladakh | 5515045 | OSM Indian state/UT boundary wiki |
| Aksai Chin | 2713465 | OpenStreetMap boundary=disputed relation |
| Shaksgam / Trans-Karakoram | 7935380 | OpenStreetMap boundary=disputed relation |
| Siachen Glacier | 3797223 | Wikidata Q333946 |
| Whole Kashmir region *reference only* | 14101768 | Wikidata Q43100 |
| Jammu Division | union of 10 OSM district relations | OSM Districts in Jammu and Kashmir wiki |

Ten Jammu districts: Doda 9550696; Jammu 1944884; Kathua 1944878; Kishtwar 1944353; Poonch 1944922; Rajouri 1944895; Ramban 9550697; Reasi 9548023; Samba 9550285; Udhampur 1944390.

Kashmir fallback district relations: Anantnag 1944955; Bandipora 9544369; Baramulla 1944971; Budgam 1944967; Ganderbal 9544371; Kulgam 9547248; Kupwara 1944978; Pulwama 1944956; Shopian 9547249; Srinagar 9544370.

## Links

- <https://wiki.openstreetmap.org/wiki/Districts_in_Jammu_and_Kashmir> (the wiki explicitly warns district data is estimated)
- <https://wiki.openstreetmap.org/wiki/India/Boundaries/States_and_Union_territories>
- <https://github.com/lux-in-tenebris-lucet/leaflet-india-boundary> (explains disputed boundary OSM relations)
- <https://www.wikidata.org/wiki/Q43100>
- <https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-breakaway-disputed-areas/> (independent visual/reference cross-check)

## Validation required before website publication

1. Check **all six regions visibly appear in the expected place** and no large gaps/overlaps occur.
2. Compare outer boundaries with at least one recognized historical map of the princely state; mark claim lines as disputed.
3. Check Shaksgam's independent overlay and the Siachen glacier vs wider AGPL — they are **not** interchangeable.
4. Decide how to handle other minor disputed areas (e.g., Demchok) and the distinction between Kashmir Division and Valley.
5. Preserve data source, dates, attribution and any local legal requirements for public maps.
