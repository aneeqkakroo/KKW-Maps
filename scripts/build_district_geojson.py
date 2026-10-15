#!/usr/bin/env python3
"""Build traceable district layers from cached OSM data and six-region masks."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import osm2geojson
from shapely.geometry import shape
from shapely.ops import unary_union
from build_kashmir_geojson import (JAMMU_DISTRICTS, KASHMIR_DISTRICTS,
                                   feature, output_json, to_polygon)


def build(output):
    out = Path(output)
    # Select whole objects from the newest snapshot, never splice member lists.
    objects, provenance = {}, {}
    sources = []
    for path in sorted((out / 'source-cache').glob('*.json')):
        data = json.loads(path.read_text(encoding='utf-8'))
        timestamp = data.get('osm3s', {}).get('timestamp_osm_base', '')
        if not timestamp:
            continue
        sources.append({'file': path.name, 'timestamp': timestamp})
        for obj in data.get('elements', []):
            key = (obj['type'], obj['id'])
            if key not in objects or timestamp > provenance[key]['timestamp']:
                objects[key] = obj
                provenance[key] = {'file': path.name, 'timestamp': timestamp}
    relations = {i: obj for (kind, i), obj in objects.items() if kind == 'relation'}

    def descendants(root, level):
        found, visited = set(), set()
        def visit(identifier):
            if identifier in visited:
                return
            visited.add(identifier)
            obj = relations.get(identifier, {})
            tags = obj.get('tags', {})
            if tags.get('boundary') == 'administrative' and tags.get('admin_level') == level:
                found.add(identifier)
                return
            for member in obj.get('members', []):
                if member['type'] == 'relation' and member.get('role') == 'subarea':
                    visit(member['ref'])
        visit(root)
        return found

    groups = {
        'ajk': descendants(3780130, '6'),
        'gb': descendants(357995, '6'),
        'jammu': set(JAMMU_DISTRICTS.values()),
        'kashmir': set(KASHMIR_DISTRICTS.values()),
        'ladakh': descendants(5515045, '5'),
        'aksai_chin': set(),
    }
    wanted = set().union(*groups.values())
    # Keep subareas visible: default filtering suppresses relations used by parents.
    converted = osm2geojson.json2shapes({'elements': list(objects.values())},
                                       filter_used_refs=False, raise_on_failure=False)
    geometries = {}
    for item in converted:
        props = item.get('properties', {})
        if props.get('type') == 'relation' and props.get('id') in wanted:
            geometries[props['id']] = to_polygon(item['shape'], str(props['id']))
    regions = json.loads((out / 'jammu_kashmir_six_regions.geojson').read_text(encoding='utf-8'))
    masks = {f['properties']['id']: shape(f['geometry']) for f in regions['features']}
    labels = {f['properties']['id']: f['properties']['name'] for f in regions['features']}
    meta = {
        'created_utc': datetime.now(timezone.utc).isoformat(),
        'source': 'OpenStreetMap', 'licence': 'ODbL 1.0',
        'attribution': '© OpenStreetMap contributors', 'crs': 'EPSG:4326',
        'source_snapshots': sources,
        'method': 'District relations clipped to existing six-region selection masks; source boundaries otherwise retained.',
        'complete_current_district_inventory': False,
        'limitations': [
            'Cached snapshots are not a verified current administrative inventory.',
            'Ladakh cache has six districts; Changthang boundary is missing. Leh may retain pre-split territory.',
            'No county boundaries are available for Aksai Chin or Shaksgam in these caches.',
            'Region clipping follows the existing disputed-area display grouping, not a sovereignty determination.',
            'Coverage fractions use planar degree-squared area as a diagnostic, not surveyed land area.',
        ],
    }
    districts, gaps, report = [], [], {}
    for region, ids in groups.items():
        entries, missing = [], []
        for identifier in sorted(ids):
            if identifier not in geometries:
                missing.append(identifier)
                continue
            original = geometries[identifier]
            clipped = original.intersection(masks[region])
            if clipped.is_empty or clipped.area == 0:
                missing.append(identifier)
                continue
            clipped = to_polygon(clipped, str(identifier))
            tags = relations[identifier]['tags']
            name = tags.get('name:en', tags.get('name', str(identifier)))
            entries.append(feature(f'{region}-{identifier}', name, clipped,
                region_id=region, region_name=labels[region], feature_kind='district',
                osm_relation_id=identifier, source_url=f'https://www.openstreetmap.org/relation/{identifier}',
                source_snapshot=provenance[('relation', identifier)],
                admin_level=tags.get('admin_level'), wikidata=tags.get('wikidata'),
                clipped_to_region=not clipped.equals(original)))
        union = unary_union([shape(f['geometry']) for f in entries])
        uncovered = masks[region].difference(union)
        overlap = sum(shape(f['geometry']).area for f in entries) - union.area
        report[region] = {'district_count': len(entries), 'missing_relation_ids': missing,
                          'uncovered_fraction': min(1.0, max(0.0, uncovered.area / masks[region].area)),
                          'overlap_degrees_squared': max(0, overlap),
                          'names': [f['properties']['name'] for f in entries]}
        if not uncovered.is_empty and uncovered.area > 0:
            gaps.append(feature(f'{region}-unresolved', f'{labels[region]}: district coverage unavailable',
                to_polygon(uncovered, region), region_id=region, feature_kind='coverage_gap'))
        districts.extend(entries)
        output_json(out / f'districts_{region}.geojson', entries, meta)
    meta['coverage'] = report
    output_json(out / 'jammu_kashmir_districts.geojson', districts, meta)
    output_json(out / 'jammu_kashmir_district_gaps.geojson', gaps, meta)
    (out / 'district_coverage_report.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps(report, indent=2))
    from build_map_preview import build as build_preview
    build_preview(out)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='output')
    build(parser.parse_args().output)
