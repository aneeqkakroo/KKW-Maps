"""Generate a portable, single-file map and its derived GeoJSON layers."""
import json
from urllib.parse import quote
from pathlib import Path
from shapely.geometry import shape, LineString, Polygon
from shapely.ops import unary_union, linemerge
from build_kashmir_geojson import feature, output_json, to_polygon

ROOT = Path(__file__).resolve().parents[1]
EDITOR = ROOT / "src/editor"


def fill_province_seams(geometries, excluded):
    """Fill only small enclosed seams, protecting other provinces and exclusions.

    This display-layer repair does not alter source region/district boundaries.
    The threshold is in square degrees, not a physical-area measurement.
    """
    repaired, repairs = [], []
    for index, geom in enumerate(geometries):
        protected = unary_union([excluded] + [g for j, g in enumerate(geometries) if j != index])
        parts = list(geom.geoms) if geom.geom_type == 'MultiPolygon' else [geom]
        additions = []
        for part in parts:
            for ring in part.interiors:
                hole = Polygon(ring)
                if hole.area <= 0.0001:
                    available = hole.difference(protected)
                    if not available.is_empty and available.area > 0:
                        additions.append(available)
        repaired.append(to_polygon(unary_union([geom] + additions), 'province seam repair'))
        repairs.append({'filled_seam_count': len(additions),
                        'filled_area_degrees_squared': sum(g.area for g in additions)})
    return repaired, repairs


def build(output='output'):
    out = Path(output)
    def read(name):
        return json.loads((out / (name + '.geojson')).read_text(encoding='utf-8'))
    regions = read('jammu_kashmir_six_regions')
    districts = read('jammu_kashmir_districts')
    output_json(out / 'districts_jk.geojson',
                [f for f in districts['features'] if f['properties']['region_id'] in ('jammu', 'kashmir')],
                districts.get('metadata', {}))
    masks = {f['id']: shape(f['geometry']) for f in regions['features']}
    valley_ajk = {8191414, 8191217, 8192278}  # Muzaffarabad, Neelam, Hattian Bala
    ajk_districts = [f for f in districts['features'] if f['properties']['region_id'] == 'ajk']
    assert valley_ajk <= {f['properties']['osm_relation_id'] for f in ajk_districts}
    north = [f for f in ajk_districts if f['properties']['osm_relation_id'] in valley_ajk]
    rest = [f for f in ajk_districts if f['properties']['osm_relation_id'] not in valley_ajk]
    definitions = [
        ('kashmir_province', 'Kashmir Province', [masks['kashmir']] + [shape(f['geometry']) for f in north],
         ['Kashmir Division (Valley approximation)'] + [f['properties']['name'] for f in north]),
        ('jammu_province', 'Jammu Province', [masks['jammu']] + [shape(f['geometry']) for f in rest],
         ['Jammu Division'] + [f['properties']['name'] for f in rest]),
        ('frontier_province', 'Frontier Province', [masks['ladakh'], masks['gb'], masks['aksai_chin']], ['Ladakh', 'Gilgit-Baltistan', 'Aksai Chin']),
    ]
    province_meta = {'source': 'OpenStreetMap; user-defined aggregation', 'licence': 'ODbL 1.0',
                     'notes': ['Requested pre-partition grouping using modern boundaries, not a verified historical survey.',
                               'Kashmir Division approximates Kashmir Valley.',
                               'Frontier inherits the existing GB/Shaksgam and Ladakh/Siachen display grouping, not present control.',
                               'Aksai Chin is included in Frontier Province by the requested map grouping.',
                               'Small enclosed source seams are filled in this province display layer only; other provinces are protected.',
                               'Any remaining non-enclosed coverage gaps are unassigned.']}
    raw_provinces = [to_polygon(unary_union(geoms), i) for i, _, geoms, _ in definitions]
    repaired, repairs = fill_province_seams(raw_provinces, Polygon())
    provinces = [feature(i, name, geom, members=members, feature_kind='province', seam_repair=repair)
                 for (i, name, _, members), geom, repair in zip(definitions, repaired, repairs)]
    output_json(out / 'jammu_kashmir_provinces.geojson', provinces, province_meta)
    unassigned = unary_union(list(masks.values())).difference(unary_union([shape(f['geometry']) for f in provinces]))
    output_json(out / 'jammu_kashmir_province_unassigned.geojson',
                [] if unassigned.is_empty else [feature('unassigned', 'Not assigned to a province', to_polygon(unassigned, 'unassigned'))], province_meta)

    raw = json.loads((out / 'source-cache/loc-relation.json').read_text(encoding='utf-8'))
    objects = {(e['type'], e['id']): e for e in raw['elements']}
    relation = objects['relation', 4609727]
    lines, ids = [], []
    for member in relation['members']:
        if member['type'] != 'way':
            continue
        way = objects['way', member['ref']]
        lines.append(LineString([(objects['node', n]['lon'], objects['node', n]['lat']) for n in way['nodes']]))
        ids.append(way['id'])
    loc = linemerge(unary_union(lines))
    assert loc.is_valid and loc.geom_type in ('LineString', 'MultiLineString')
    output_json(out / 'jammu_kashmir_loc.geojson',
                [feature('loc', 'Line of Control · India–Pakistan', loc,
                         source_url='https://www.openstreetmap.org/relation/4609727',
                         osm_relation_id=4609727, source_way_ids=ids)],
                {'source': 'OpenStreetMap relation 4609727', 'licence': 'ODbL 1.0',
                 'relation_version': relation.get('version'), 'relation_timestamp': relation.get('timestamp'),
                 'notes': ['Source-mapped demarcation, not a surveyed or live military-control boundary.',
                           'Source discontinuities are retained; AGPL and India–China LAC are not added.']})
    shaksgam = next(f for f in read('jammu_kashmir_special_overlays')['features'] if f['id'] == 'shaksgam')
    context = {'type': 'FeatureCollection', 'features': [
        feature('context-aksai-chin', 'Aksai Chin', masks['aksai_chin'], region_id='aksai_chin', feature_kind='geographic_area'),
        feature('context-shaksgam', 'Shaksgam Valley', shape(shaksgam['geometry']), region_id='gb', feature_kind='geographic_area')],
        'metadata': {'note': 'Named geographic areas for district-view context, not administrative districts.'}}
    bundle = {'regions': regions, 'districts': districts, 'context': context, 'gaps': read('jammu_kashmir_district_gaps'),
              'provinces': read('jammu_kashmir_provinces'), 'unassigned': read('jammu_kashmir_province_unassigned'),
              'loc': read('jammu_kashmir_loc')}
    template = (EDITOR / 'map.template.html').read_text(encoding='utf-8')
    for collection in bundle.values():
        for item in collection['features']:
            geom = shape(item['geometry'])
            if geom.geom_type in ('Polygon', 'MultiPolygon'):
                item['properties']['label_point'] = list(geom.representative_point().coords)[0]
    replacements = {
        'CHINAR_FAVICON': 'data:image/svg+xml,' + quote((ROOT / 'assets/chinar.svg').read_text(encoding='utf-8'), safe=''),
        '/* MAP_DATA */': 'window.MAP_DATA=' + json.dumps(bundle, ensure_ascii=True, separators=(',', ':')).replace('<', '\\u003c') + ';',
    }
    for token, value in replacements.items():
        template = template.replace(token, value)
    for token, filename in [('/* EDITOR_CSS */', 'map-editor.css'), ('/* EDITOR_CORE */', 'map-editor-core.js'), ('/* EDITOR_JS */', 'map-editor.js')]:
        template = template.replace(token, (EDITOR / filename).read_text(encoding='utf-8'))
    (ROOT / 'districts.html').write_text(template, encoding='utf-8')
    from build_thumbnails import build as build_thumbnails
    build_thumbnails(out, ROOT / 'assets')
    print('Saved standalone districts.html')


if __name__ == '__main__':
    build()
