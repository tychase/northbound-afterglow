#!/usr/bin/env python3
"""Explicit opt-in source refresh; offline route builds never call the network.
All generated/snapshotted files stay inside notes/maps. Python standard library.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json

HERE = Path(__file__).resolve().parent
BASE = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb'
BBOX = '-80.805,28.551,-80.792,28.569'
QUERY = dict(f='geojson', where='1=1', geometry=BBOX,
             geometryType='esriGeometryEnvelope', inSR='4326', outSR='4326',
             outFields='*', spatialRel='esriSpatialRelIntersects',
             returnGeometry='true', resultRecordCount='100000')
SOURCES = {}
for layer in (2, 6, 8):
    url = f'{BASE}/Transportation/MapServer/{layer}'
    SOURCES[f'roads-{layer}.geojson'] = url + '/query?' + urlencode(QUERY)
    SOURCES[f'roads-{layer}-metadata.json'] = url + '?f=pjson'
SOURCES['physical-metadata.json'] = BASE + '/tigerWMS_PhysicalFeatures/MapServer?f=pjson'
for key, number in [('kennedy', '4915'), ('rotary', '4141')]:
    SOURCES[f'geocode-{key}.json'] = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?' + urlencode(dict(address=f'{number} S Washington Ave, Titusville, FL 32780', benchmark='Public_AR_Current', format='json'))
SOURCES['census-rights.pdf'] = 'https://www2.census.gov/geo/pdfs/maps-data/data/tiger/tgrshp2026/TGRSHP2026_TechDoc_Ch1.pdf'
PADUS = 'https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Manager_Name_PADUS/FeatureServer'
SOURCES['parks-padus.geojson'] = PADUS + '/0/query?' + urlencode({**QUERY, 'resultRecordCount': '1000'})
SOURCES['parks-padus-metadata.json'] = PADUS + '?f=pjson'
SOURCES['parks-padus-rights.json'] = 'https://www.arcgis.com/sharing/rest/content/items/d1c464bac63d44bc88a4a059dc69d259?f=json'


def fetch(item):
    name, url = item
    with urlopen(Request(url, headers={'User-Agent': 'NorthboundAfterglow-geography-audit/1.0'}), timeout=75) as response:
        raw = response.read()
        content_type = response.headers.get('Content-Type')
    if not name.endswith('.pdf'):
        data = json.loads(raw)
        if 'error' in data or data.get('exceededTransferLimit'):
            raise RuntimeError(f'Incomplete/error response: {name}: {data}')
    else:
        assert raw.startswith(b'%PDF-'), name
    (HERE / 'sources' / name).write_bytes(raw)
    return name, dict(url=url, retrievedUTC=datetime.now(timezone.utc).isoformat(),
                      sha256=sha256(raw).hexdigest(), bytes=len(raw), contentType=content_type)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true', required=True,
                        help='Explicitly re-fetch current sources; may change results.')
    parser.parse_args()
    (HERE / 'sources').mkdir(parents=True, exist_ok=True)
    manifest = dict(ThreadPoolExecutor(max_workers=5).map(fetch, SOURCES.items()))
    (HERE / 'sources' / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({k: {'bytes': v['bytes'], 'sha256': v['sha256']} for k, v in manifest.items()}, indent=2))
