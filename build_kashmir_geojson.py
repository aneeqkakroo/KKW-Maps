#!/usr/bin/env python3
"""Compile selectable Jammu & Kashmir polygons from traceable OSM relations.

This script FETCHES current data from OpenStreetMap when run. It is not a
historically surveyed 1947 dataset: there is no universally agreed exact
boundary for the disputed parts. Attribution: © OpenStreetMap contributors,
ODbL 1.0. Never describe the outputs as definitive jurisdictional boundaries.
"""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import time

try:
    import osm2geojson
    from shapely.geometry import shape, mapping, GeometryCollection, MultiPolygon, Polygon
    from shapely.ops import unary_union
    from shapely.validation import explain_validity
except ImportError as exc:
    raise SystemExit("Install dependencies first: python -m pip install -r requirements.txt") from exc

# OSM relation identifiers, documented in SOURCES.md.
MAJOR = {
    'ajk': 3780130,
    'gb': 357995,
    'kashmir': 13424056,
    'ladakh': 5515045,
    'aksai_chin': 2713465,
    'shaksgam': 7935380,
    'siachen': 3797223,
    'reference_kashmir_region': 14101768,
}
JAMMU_DISTRICTS = {
    'Doda': 9550696, 'Jammu': 1944884, 'Kathua': 1944878,
    'Kishtwar': 1944353, 'Poonch': 1944922, 'Rajouri': 1944895,
    'Ramban': 9550697, 'Reasi': 9548023, 'Samba': 9550285,
    'Udhampur': 1944390,
}
KASHMIR_DISTRICTS = {
    'Anantnag': 1944955, 'Bandipora': 9544369, 'Baramulla': 1944971,
    'Budgam': 1944967, 'Ganderbal': 9544371, 'Kulgam': 9547248,
    'Kupwara': 1944978, 'Pulwama': 1944956, 'Shopian': 9547249,
    'Srinagar': 9544370,
}
LABELS = {
    'ajk': 'Azad Jammu & Kashmir',
    'gb': 'Gilgit-Baltistan (with Shaksgam for historical map grouping)',
    'jammu': 'Jammu Division',
    'kashmir': 'Kashmir Division',
    'ladakh': 'Ladakh (including Siachen glacier overlay)',
    'aksai_chin': 'Aksai Chin',
}
# Generalized bounds for sanity checks. Not used as geometry itself.
EXPECTED_CENTRES = {
    'ajk': (73.8, 33.8, 2.5), 'gb': (74.7, 35.9, 3.5),
    'jammu': (75.0, 33.2, 2.5), 'kashmir': (74.9, 34.2, 2.5),
    'ladakh': (77.4, 34.4, 3.5), 'aksai_chin': (79.0, 35.2, 2.5),
}


def to_polygon(geom, label):
    """Return clean polygonal components; never manufacture missing geometry."""
    if geom is None or geom.is_empty:
        raise ValueError(f"{label}: no polygon returned by source")
    if not geom.is_valid:
        try:
            from shapely import make_valid
            geom = make_valid(geom)
        except ImportError:
            geom = geom.buffer(0)
    if isinstance(geom, GeometryCollection):
        components = [g for g in geom.geoms if g.geom_type in ('Polygon', 'MultiPolygon')]
        geom = unary_union(components)
    if geom.geom_type not in ('Polygon', 'MultiPolygon') or geom.is_empty:
        raise ValueError(f"{label}: source geometry is {geom.geom_type}, not a polygon")
    if not geom.is_valid:
        raise ValueError(f"{label}: invalid topology: {explain_validity(geom)}")
    return geom


def batch_overpass(ids, cache_path, endpoint, refresh=False):
    """Use OSM source IDs, retrieve all member ways/nodes; cache responses."""
    if cache_path.exists() and not refresh:
        print(f"[cache] {cache_path.name}")
        return json.loads(cache_path.read_text(encoding='utf-8'))
    ids = sorted(set(int(n) for n in ids))
    query = ("[out:json][timeout:240][maxsize:536870912];\n"
             "(rel(id:" + ",".join(map(str, ids)) + "););\n"
             "(._;>>;);\nout body;")
    print(f"[fetch] OSM relations: {', '.join(map(str, ids))}")
    raw = osm2geojson.overpass_call(query, endpoint=endpoint, timeout=300, retries=3)
    data = json.loads(raw)
    if not data.get('elements'):
        raise RuntimeError(f"No OSM objects returned for relations {ids}")
    cache_path.write_text(json.dumps(data), encoding='utf-8')
    return data


def relation_polygons(data, wanted):
    features = osm2geojson.json2shapes(data, filter_used_refs=True, raise_on_failure=False)
    result = {}
    for f in features:
        p = f.get('properties', {})
        if p.get('type') != 'relation':
            continue
        rel_id = int(p.get('id', -1))
        if rel_id not in wanted:
            continue
        g = f.get('shape')
        if g is not None and g.geom_type in ('Polygon', 'MultiPolygon'):
            result[rel_id] = to_polygon(g, f"OSM relation {rel_id}")
    return result


def ensure_location(geom, region_id):
    """Fail for clearly mismatched polygons such as an AJK district in Aksai Chin."""
    x, y, tolerance = EXPECTED_CENTRES[region_id]
    pt = geom.representative_point()
    if abs(pt.x - x) > tolerance or abs(pt.y - y) > tolerance:
        raise ValueError(
            f"{region_id}: unexpected location ({pt.y:.2f}N, {pt.x:.2f}E); "
            "source relation may be incorrectly named or mapped."
        )
    if not (70 <= geom.bounds[0] <= 81 and 31 <= geom.bounds[1] <= 39
            and 70 <= geom.bounds[2] <= 82 and 31 <= geom.bounds[3] <= 39):
        raise ValueError(f"{region_id}: implausible source bounds {geom.bounds}")


def assign_regions(raw):
    """Assign disputed overlaps consistently so region selection never double-fills."""
    # First preserve the geographic polygons; priority only affects overlapping claims.
    candidates = {
        'aksai_chin': raw['aksai_chin'],
        'ladakh': unary_union([raw['ladakh'], raw['siachen']]),
        'gb': unary_union([raw['gb'], raw['shaksgam']]),
        'ajk': raw['ajk'],
        'kashmir': raw['kashmir'],
        'jammu': raw['jammu'],
    }
    used = GeometryCollection()
    selected = {}
    for key, g in candidates.items():
        g = to_polygon(g.difference(used), key)
        selected[key] = g
        used = unary_union([used, g])
    return selected, to_polygon(used, 'full region')


def feature(identifier, title, geom, **props):
    return {'type': 'Feature', 'id': identifier,
            'properties': {'id': identifier, 'name': title, **props},
            'geometry': mapping(geom)}


def output_json(path, features, meta):
    out = {'type': 'FeatureCollection', 'name': path.stem,
           'metadata': meta, 'features': features}
    path.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f"[save] {path} — {path.stat().st_size // 1024} KB")


def build(args):
    out = Path(args.output).resolve()
    out.mkdir(parents=True, exist_ok=True)
    cache = out / 'source-cache'
    cache.mkdir(exist_ok=True)
    endpoint = args.endpoint
    try:
        group_1 = ['ajk', 'gb', 'kashmir', 'ladakh']
        group_2 = ['aksai_chin', 'shaksgam', 'siachen', 'reference_kashmir_region']
        geometries = {}
        for tag, keys in [('main', group_1), ('claims', group_2)]:
            ids = [MAJOR[k] for k in keys]
            raw = batch_overpass(ids, cache / f'{tag}.json', endpoint, args.refresh)
            geoms = relation_polygons(raw, set(ids))
            for k in keys:
                if MAJOR[k] in geoms:
                    geometries[k] = geoms[MAJOR[k]]
        # Construct Jammu Division from the 10 administrative districts.
        ids = list(JAMMU_DISTRICTS.values())
        data = batch_overpass(ids, cache / 'jammu-districts.json', endpoint, args.refresh)
        found = relation_polygons(data, set(ids))
        missing = [name for name, i in JAMMU_DISTRICTS.items() if i not in found]
        if missing:
            raise ValueError(f"Jammu districts missing: {missing}; output not produced")
        geometries['jammu'] = to_polygon(unary_union(list(found.values())), 'Jammu Division')
        # Some OSM editions have the Kashmir division relation incomplete;
        # fallback to a union of its 10 districts when necessary.
        if 'kashmir' not in geometries:
            ids = list(KASHMIR_DISTRICTS.values())
            data = batch_overpass(ids, cache / 'kashmir-districts.json', endpoint, args.refresh)
            found = relation_polygons(data, set(ids))
            missing = [name for name, i in KASHMIR_DISTRICTS.items() if i not in found]
            if missing:
                raise ValueError(f"Kashmir districts missing: {missing}; output not produced")
            geometries['kashmir'] = to_polygon(unary_union(list(found.values())), 'Kashmir Division')
        missing = [k for k in MAJOR if k != 'reference_kashmir_region' and k not in geometries]
        if missing:
            raise ValueError('Missing or non-polygon OSM geometry for: ' + ', '.join(missing))
        for name in LABELS:
            ensure_location(geometries[name], name)
        selected, outer = assign_regions(geometries)
        meta = {
            'description': 'Approximate historic Kashmir footprint as a composite of current OSM polygons',
            'boundary_claim': 'NOT a verified exact 1947 cadastral/survey boundary',
            'created_utc': datetime.now(timezone.utc).isoformat(),
            'crs': 'EPSG:4326', 'licence': 'ODbL 1.0',
            'attribution': '© OpenStreetMap contributors',
            'method': 'OSM boundary relations + ten Jammu districts; overlapping disputed geometry normalized by priority',
            'source_relation_ids': MAJOR,
            'notes': [
                'Shaksgam Tract is grouped with GB solely for historic-map user-interface selection, NOT present administration.',
                'The Siachen glacier polygon is added to Ladakh. This is not a determination of the broader Siachen dispute or AGPL.',
                'Kashmir Valley selector means Kashmir Division (ten administrative districts), not only the geographic valley.',
                'Disputed linework and administrative divisions are approximations, and the historic 1947 borders are not universally agreed.',
                'Review geometry and provenance against specialist survey/historic maps before publication.'
            ]
        }
        region_ids = ['ajk', 'gb', 'jammu', 'kashmir', 'ladakh', 'aksai_chin']
        feats = []
        for k in region_ids:
            feats.append(feature(k, LABELS[k], selected[k], selectable=True, disputed=True,
                                 group_includes='Shaksgam' if k == 'gb' else 'Siachen glacier' if k == 'ladakh' else None))
        output_json(out/'jammu_kashmir_six_regions.geojson', feats, meta)
        output_json(out/'jammu_kashmir_outer_outline.geojson', [feature('historical_composite_outline',
                    'Composite outline of the historical Kashmir region', outer,
                    verified_historical=False, selectable=False)], meta)
        overlay = [feature('shaksgam', 'Shaksgam / Trans-Karakoram Tract', geometries['shaksgam'],
                           selectable=False, administered_by='China', status='disputed'),
                   feature('siachen', 'Siachen Glacier', geometries['siachen'],
                           selectable=False, status='disputed')]
        output_json(out/'jammu_kashmir_special_overlays.geojson', overlay, meta)
        if 'reference_kashmir_region' in geometries:
            ref = geometries['reference_kashmir_region']
            difference = outer.symmetric_difference(ref)
            ratio = difference.area / max(outer.area, 0.01)
            print(f"[check] Composite vs OSM region relation 14101768: "
                  f"symmetric difference ~{ratio:.1%} of composite area (unprojected diagnostic).")
            if ratio > 0.05:
                print('[warning] Reference region does not closely match the composited outline. Manual review required!')
        print('[success] Six-region GeoJSON plus outer line and disputed-area overlays generated.')
        print('[important] These polygons are NOT verified exact historical boundaries.')
    except Exception as exc:
        print(f"[error] {exc}", file=sys.stderr)
        raise SystemExit(1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='output', help='Output directory')
    parser.add_argument('--refresh', action='store_true', help='Refresh OSM source downloads')
    parser.add_argument('--endpoint', default='https://overpass.kumi.systems/api/interpreter',
                        help='Overpass interpreter endpoint')
    args = parser.parse_args()
    build(args)

if __name__ == '__main__':
    main()
