"""Generate landing-page previews from the same geometry as the editor."""
import json
import math
from pathlib import Path
from shapely.geometry import shape


def build(output, assets):
    colors = ['#d7e6d7', '#b9d1c3', '#e5b875', '#78a799', '#44796b', '#ead8b8']
    for kind, filename in [('regions', 'jammu_kashmir_six_regions'),
                           ('districts', 'jammu_kashmir_districts'),
                           ('provinces', 'jammu_kashmir_provinces')]:
        data = json.loads((Path(output) / (filename + '.geojson')).read_text(encoding='utf-8'))
        geoms = [shape(f['geometry']).simplify(.006, preserve_topology=True) for f in data['features']]
        def project(p):
            return p[0], math.log(math.tan(math.pi / 4 + p[1] * math.pi / 360)) * 180 / math.pi
        bounds = [g.bounds for g in geoms]
        x0, x1 = min(b[0] for b in bounds), max(b[2] for b in bounds)
        y0, y1 = project((0, min(b[1] for b in bounds)))[1], project((0, max(b[3] for b in bounds)))[1]
        scale = min(580 / (x1 - x0), 430 / (y1 - y0))
        def point(p):
            x, y = project(p)
            return 30 + (580 - scale * (x1 - x0)) / 2 + (x - x0) * scale, 25 + (430 - scale * (y1 - y0)) / 2 + (y1 - y) * scale
        parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480"><title>Kashmir ' + kind + ' preview</title>']
        for i, geom in enumerate(geoms):
            paths = []
            for polygon in (geom.geoms if geom.geom_type == 'MultiPolygon' else [geom]):
                for ring in [polygon.exterior, *polygon.interiors]:
                    paths.append('M' + 'L'.join('%.2f,%.2f' % point(c) for c in ring.coords) + 'Z')
            parts.append('<path d="' + ''.join(paths) + '" fill="' + colors[i % len(colors)] + '" stroke="#fffdf7" stroke-width="1.25" fill-rule="evenodd"/>')
        parts.append('</svg>')
        (Path(assets) / (kind + '.svg')).write_text(''.join(parts), encoding='utf-8')
