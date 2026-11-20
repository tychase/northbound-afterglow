#!/usr/bin/env python3
"""Build bounded, offline US 1 route data from the checked-in federal snapshots.
Run: python notes/maps/build-route.py [--check]. Standard library only.
--check compares bytes without writing. No network is used by this builder.
"""
import argparse
import bisect
import hashlib
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SOURCE = HERE / 'sources'
NORTH_OID = '1104689770051'
SOUTH_OID = '1104691845668'
LANE_WIDTH = 3.6576  # 12 ft; lane-level modelling assumption, not TIGER attribute
LANE_OFFSET = LANE_WIDTH / 2
SAMPLE_STEP = 0.75
CORNER_CUT = 8.0
A = 6378137.0
E2 = 6.6943799901413165e-3


def load(name):
    return json.loads((SOURCE / name).read_text())


def add(a, b):
    return [a[0] + b[0], a[1] + b[1]]


def sub(a, b):
    return [a[0] - b[0], a[1] - b[1]]


def mul(a, k):
    return [a[0] * k, a[1] * k]


def norm(a):
    return math.hypot(*a)


def unit(a):
    return mul(a, 1 / norm(a))


def lerp(a, b, t):
    return add(a, mul(sub(b, a), t))


def ecef(ll):
    lon, lat = map(math.radians, ll)
    n = A / math.sqrt(1 - E2 * math.sin(lat)**2)
    return [n * math.cos(lat) * math.cos(lon), n * math.cos(lat) * math.sin(lon), n * (1-E2) * math.sin(lat)]


class Frame:
    def __init__(self, ll):
        self.ll = ll
        self.origin = ecef(ll)
        lon, lat = map(math.radians, ll)
        self.east = [-math.sin(lon), math.cos(lon), 0]
        self.north = [-math.sin(lat)*math.cos(lon), -math.sin(lat)*math.sin(lon), math.cos(lat)]

    def project(self, ll):
        delta = [a-b for a, b in zip(ecef(ll), self.origin)]
        return [sum(a*b for a, b in zip(delta, axis)) for axis in [self.east, self.north]]

    def inverse(self, xy):
        ll = self.ll[:]
        for _ in range(5):
            p = self.project(ll)
            err = sub(xy, p)
            dx = mul(sub(self.project([ll[0]+1e-6, ll[1]]), p), 1e6)
            dy = mul(sub(self.project([ll[0], ll[1]+1e-6]), p), 1e6)
            determinant = dx[0]*dy[1]-dx[1]*dy[0]
            ll[0] += (err[0]*dy[1]-err[1]*dy[0])/determinant
            ll[1] += (dx[0]*err[1]-dx[1]*err[0])/determinant
        return ll


def utm17(ll):
    """WGS84 / UTM zone 17N (EPSG:32617), reference coordinates only.
    Snyder transverse Mercator series; gameplay uses true-east/north ENU,
    not grid directions or Web Mercator metres.
    """
    lon, lat = map(math.radians, ll)
    ep = E2/(1-E2)
    n = A / math.sqrt(1-E2*math.sin(lat)**2)
    t, c = math.tan(lat)**2, ep*math.cos(lat)**2
    aa = math.cos(lat)*(lon-math.radians(-81))
    m = A*((1-E2/4-3*E2**2/64-5*E2**3/256)*lat
           -(3*E2/8+3*E2**2/32+45*E2**3/1024)*math.sin(2*lat)
           +(15*E2**2/256+45*E2**3/1024)*math.sin(4*lat)
           -35*E2**3/3072*math.sin(6*lat))
    east = 500000 + .9996*n*(aa+(1-t+c)*aa**3/6+(5-18*t+t*t+72*c-58*ep)*aa**5/120)
    north = .9996*(m+n*math.tan(lat)*(aa*aa/2+(5-t+9*c+4*c*c)*aa**4/24+(61-58*t+t*t+600*c-330*ep)*aa**6/720))
    return {'crs': 'EPSG:32617', 'easting': round(east, 3), 'northing': round(north, 3)}


def stations(points):
    result = [0.0]
    for a, b in zip(points, points[1:]):
        result.append(result[-1]+norm(sub(b, a)))
    return result


def nearest(p, line):
    cumulative = stations(line)
    best = None
    for i, (a, b) in enumerate(zip(line, line[1:])):
        d = sub(b, a)
        t = max(0, min(1, sum(x*y for x, y in zip(sub(p, a), d))/sum(v*v for v in d)))
        q = lerp(a, b, t)
        item = (norm(sub(p, q)), cumulative[i]+t*norm(d), q, i, t)
        if best is None or item[0] < best[0]:
            best = item
    if best is None:
        raise ValueError('A source line must contain at least two distinct points')
    return best


def polygon_centroid(ring):
    area = x = z = 0.0
    for a, b in zip(ring, ring[1:] + ring[:1]):
        cross = a[0]*b[1]-b[0]*a[1]
        area += cross
        x += (a[0]+b[0])*cross
        z += (a[1]+b[1])*cross
    assert abs(area) > 1
    return [x/(3*area), z/(3*area)]


def smooth(points):
    """Straight lines plus bounded quadratic fillets, not a free spline.
    Cut at most 8 m from each mapped corner. Analytic normals are continuous.
    """
    parts = []
    cursor = points[0]
    for i in range(1, len(points)-1):
        a, p, b = points[i-1:i+2]
        d = min(CORNER_CUT, .2*norm(sub(p, a)), .2*norm(sub(b, p)))
        entry, exit = sub(p, mul(unit(sub(p, a)), d)), add(p, mul(unit(sub(b, p)), d))
        parts.append(('line', cursor, entry))
        parts.append(('curve', entry, p, exit))
        cursor = exit
    parts.append(('line', cursor, points[-1]))
    samples = []
    for part in parts:
        if part[0] == 'line':
            _, a, b = part
            length = norm(sub(b, a))
            if length < 1e-8:
                continue
            count = math.ceil(length/SAMPLE_STEP)
            for j in range(count):
                samples.append((lerp(a, b, j/count), unit(sub(b, a))))
        else:
            _, a, p, b = part
            count = math.ceil((norm(sub(p, a))+norm(sub(b, p)))/SAMPLE_STEP)
            for j in range(count):
                t = j/count
                point = add(add(mul(a, (1-t)**2), mul(p, 2*t*(1-t))), mul(b, t*t))
                tangent = unit(add(mul(sub(p, a), 1-t), mul(sub(b, p), t)))
                samples.append((point, tangent))
    samples.append((points[-1], unit(sub(points[-1], points[-2]))))
    return samples


def clip_branch(points, limit=120):
    output = [points[0]]
    distance = 0
    for a, b in zip(points, points[1:]):
        length = norm(sub(b, a))
        if distance+length >= limit:
            output.append(lerp(a, b, (limit-distance)/length))
            break
        output.append(b)
        distance += length
    return output


def rounded(obj):
    if isinstance(obj, float):
        return round(obj, 8)
    if isinstance(obj, list):
        return [rounded(v) for v in obj]
    if isinstance(obj, dict):
        return {k: rounded(v) for k, v in obj.items()}
    return obj


def build():
    manifest = load('manifest.json')
    for name, meta in manifest.items():
        raw = (SOURCE/name).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == meta['sha256'], f'Changed snapshot: {name}'
        assert len(raw) == meta['bytes']
    geo = {k: load(f'geocode-{k}.json')['result']['addressMatches'][0] for k in ['kennedy', 'rotary']}
    geocodes = {k: [g['coordinates']['x'], g['coordinates']['y']] for k, g in geo.items()}
    frame = Frame(geocodes['kennedy'])
    secondary = load('roads-6.geojson')['features']
    local = load('roads-8.geojson')['features']
    by_oid = {f['properties']['OID']: f for f in secondary}

    def crop(feature):
        points = [frame.project(c) for c in feature['geometry']['coordinates'] if 28.551 < c[1] < 28.569]
        if points[0][1] > points[-1][1]:
            points.reverse()
        assert all(a[1] < b[1] for a, b in zip(points, points[1:])), 'Unexpected fold in northbound corridor'
        return points

    north, south = crop(by_oid[NORTH_OID]), crop(by_oid[SOUTH_OID])
    parks = {f['properties']['Unit_Nm']: f for f in load('parks-padus.geojson')['features']}
    park_info = {}
    for key, name in [('kennedy', 'Kennedy Point Park'), ('rotary', 'Rotary Riverfront Park')]:
        f = parks[name]
        polygons = f['geometry']['coordinates'] if f['geometry']['type'] == 'MultiPolygon' else [f['geometry']['coordinates']]
        rings = [[frame.project(c) for c in poly[0]] for poly in polygons]
        chosen = min(range(len(rings)), key=lambda i: nearest(frame.project(geocodes[key]), rings[i])[0])
        centroid = polygon_centroid(rings[chosen])
        park_info[key] = {'name': name, 'sourcePAID': f['properties']['Source_PAID'],
                          'sourceDate': f['properties']['Src_Date'], 'componentIndex': chosen,
                          'componentCentroid': frame.inverse(centroid), 'componentCentroidENU': centroid,
                          'polygonComponents': len(polygons)}
    smoothed = smooth(north)
    lane = [add(p, mul([t[1], -t[0]], LANE_OFFSET)) for p, t in smoothed]
    headings = [math.atan2(t[0], t[1]) for p, t in smoothed]
    cum = stations(lane)
    start = nearest(frame.project(geocodes['kennedy']), lane)
    end = nearest(park_info['rotary']['componentCentroidENU'], lane)
    s0, s1 = start[1], end[1]
    length = s1-s0
    assert 1300 < length < 1700

    def sample(s):
        i = max(0, min(len(lane)-2, bisect.bisect_right(cum, s)-1))
        t = (s-cum[i])/(cum[i+1]-cum[i])
        return lerp(lane[i], lane[i+1], t), headings[i]+t*(headings[i+1]-headings[i])

    origin = sample(s0)[0]
    origin_ll = frame.inverse(origin)
    selected_s = [s0] + [s for s in cum if s0 < s < s1] + [s1]
    samples = []
    for s in selected_s:
        p, h = sample(s)
        samples.append([s-s0, *sub(p, origin), h])

    # Detect ALL named road endpoints topologically touching the NB trace;
    # exclude route aliases. This does not fabricate driveway junctions.
    aliases = {'Orlando Rd': 'Cheney Hwy', 'State Hwy 50': 'Cheney Hwy'}
    groups = {}
    excluded = []
    for f in secondary+local:
        props = f['properties']
        name = props['NAME']
        if not name or name in ['US Hwy 1', 'State Hwy 5', 'S Washington Ave']:
            continue
        path = [frame.project(c) for c in f['geometry']['coordinates']]
        for is_last in [False, True]:
            branch = list(reversed(path)) if is_last else path
            connection = nearest(branch[0], north)
            if connection[0] > .25:
                continue
            projected = nearest(branch[0], lane)
            station = projected[1]-s0
            if not 0 <= station <= length:
                excluded.append({'name': name, 'station': station, 'reason': 'outside bounded drive'})
                continue
            canonical = aliases.get(name, name)
            group_key = (canonical, round(station))
            group = groups.setdefault(group_key, {'name': canonical, 'station': station, 'candidates': [], 'aliases': set(), 'oids': set()})
            group['aliases'].add(name)
            group['oids'].add(props['OID'])
            group['candidates'].append((norm(sub(branch[-1], branch[0])), branch, connection[0]))
    junctions = []
    for group in groups.values():
        _, branch, gap = max(group['candidates'], key=lambda v: v[0])
        clipped = clip_branch(branch)
        p = nearest(branch[0], lane)[2]
        _, h = sample(s0+group['station'])
        lateral = sum(v*w for v, w in zip(sub(branch[0], p), [math.cos(h), -math.sin(h)]))
        side = 'west' if clipped[-1][0] < clipped[0][0] else 'east'
        geometry = [sub(p, origin) for p in clipped]
        junctions.append({'name': group['name'], 'station': group['station'], 'side': side,
                          'aliases': sorted(group['aliases']- {group['name']}),
                          'sourceOIDs': sorted(group['oids']), 'sourceConnectionGapMeters': gap,
                          'lateralMeters': lateral, 'mappedPosition': dict(zip(['x', 'z'], geometry[0])),
                          'sourceLonLat': frame.inverse(branch[0]),
                          'branchHeading': math.atan2(geometry[-1][0]-geometry[0][0], geometry[-1][1]-geometry[0][1]),
                          'geometry': geometry, 'geometryMeaning': 'mapped street centerline, clipped to 120 m from NB carriageway; not curb/turn-lane geometry'})
    junctions.sort(key=lambda j: j['station'])
    assert [j['name'] for j in junctions] == ['Cheney Hwy', 'Birch St', 'Pritchard St', 'Coquina Ave', 'Knox McRae Dr', 'Delespine Ave']
    # Independent source audit: original reference must coincide with NB,
    # while the second federal line must remain west of it throughout.
    reference = json.loads((ROOT/'notes/us1-reference.geojson').read_text())
    ref_ll = reference['features'][0]['geometry']['coordinates']
    reference_points = [frame.project(c) for c in ref_ll if 28.552 < c[1] < 28.568]
    ref_error = max(nearest(p, north)[0] for p in reference_points)
    separations = []
    lane_offsets = []
    smooth_errors = []
    for (p, t), q in zip(smoothed, lane):
        if start[2][1] <= q[1] <= end[2][1]:
            sb = nearest(p, south)
            assert sb[2][0] < p[0]
            separations.append(sb[0])
            smooth_errors.append(nearest(p, north)[0])
            lane_offsets.append(nearest(q, north)[0])
    assert ref_error < .001
    assert min(separations) > 8 and max(separations) < 25
    assert max(smooth_errors) < .6
    assert max(abs(d-LANE_OFFSET) for d in lane_offsets) < .6
    provenance = {
        'summary': 'US 1 / S Washington Ave, Kennedy Point Park to Rotary Riverfront Park, Titusville, Florida. Federal mapped northbound carriageway; approximate lane center and roadside park anchors, not surveyed driveways.',
        'sources': {'roads': 'U.S. Census Bureau TIGERweb Transportation layers 2/6/8; January 1, 2026 geometry',
                    'parks': 'USGS PAD-US Manager Name (served layer PADUS4_1ManagerName); park records sourced 2023/05/15',
                    'addresses': 'U.S. Census Bureau Geocoder Public_AR_Current; both exact address matches',
                    'manifest': 'notes/maps/sources/manifest.json'},
        'rights': 'U.S. Census Bureau government work, 17 USC 105; USGS PAD-US item explicitly public domain. No commercial basemap, imagery, or county restricted GIS geometry used.',
        'trademarkNotice': 'TIGER/Line® is a registered trademark of the U.S. Census Bureau; this independent game is not a Census Bureau product or endorsement.',
        'northboundSourceOID': NORTH_OID, 'southboundSourceOID': SOUTH_OID,
        'carriageway': 'Eastern member of two separately mapped US Hwy 1 carriageways; northbound identified from right-hand traffic, not coordinate storage order. Source has no direction or lane-count attributes.',
        'frame': {'axes': 'east=x, north=z, WGS84 ellipsoid local ENU metres, altitude=0; no Web Mercator scaling',
                  'heading': 'radians clockwise from true north; atan2(dx,dz)',
                  'tangentPlaneOriginLonLat': frame.ll, 'worldOriginENUInTangentPlane': origin,
                  'worldOriginLonLat': origin_ll, 'worldOriginUTM17N': utm17(origin_ll),
                  'worldOriginLocal': {'x': 0, 'z': 0}},
        'stationing': '0 at Kennedy address projected to modelled NB right lane; ROUTE_LENGTH at projection of Rotary main/southern PAD-US component centroid. Arc length of right-lane sample polyline, not latitude difference.',
        'laneModel': {'northboundThroughLanes': 2, 'laneWidthMeters': LANE_WIDTH,
                      'rightLaneOffsetFromMappedCarriagewayMeters': LANE_OFFSET,
                      'basis': '12 ft nominal lane, consistent with FDOT 454217-1 sequence 1 estimate: 4 lanes, 24 ft pavement each direction. Not a survey; lane widths, turn pockets, median openings and road edges are not in TIGER.',
                      'offsetRule': 'positive right = (cos(heading), -sin(heading)); only half one lane width from NB carriageway center, not half total highway width'},
        'smoothing': {'method': 'quadratic corner fillets; no free spline', 'maximumCornerCutMeters': CORNER_CUT,
                      'sampleStepMaximumMeters': SAMPLE_STEP},
        'start': {'name': park_info['kennedy']['name'], 'address': geo['kennedy']['matchedAddress'], 'station': 0,
                  'addressGeocodeLonLat': geocodes['kennedy'], 'addressGeocodeTLID': geo['kennedy']['tigerLine']['tigerLineId'],
                  'roadsideLonLat': origin_ll, 'UTM17N': utm17(origin_ll),
                  'geocodeSnapMeters': start[0], 'mapping': 'address-range interpolation snapped to modelled right lane opposite mapped Kennedy park; not mapped entrance or parking position'},
        'end': {'name': park_info['rotary']['name'], 'address': geo['rotary']['matchedAddress'], 'station': length,
                'addressGeocodeLonLat': geocodes['rotary'], 'addressGeocodeTLID': geo['rotary']['tigerLine']['tigerLineId'],
                'parkComponentCentroidLonLat': park_info['rotary']['componentCentroid'],
                'roadsideLonLat': frame.inverse(sample(s1)[0]), 'UTM17N': utm17(frame.inverse(sample(s1)[0])),
                'mapping': 'roadside opposite centroid of southern PAD-US park component (component nearest matched 4141 address), not a verified driveway turn',
                'addressStation': nearest(frame.project(geocodes['rotary']), lane)[1]-s0,
                'parkCentroidSnapMeters': end[0]},
        'parks': park_info,
        'junctionScope': 'All named TIGER road endpoints attached to NB carriageway within the bounded drive. Excludes unsigned/private driveways, turn-lane outlines and signal timing. Side is geographic approach side, not permission to turn.',
        'sceneryExtrapolation': 'Constant endpoint tangent outside [0, ROUTE_LENGTH]; no looping or invented continued mapped route.',
        'limitations': ['TIGER and PAD-US are map/general-reference data, not engineering surveys or navigation.',
                        'The lane offset is modelled, not lane-level mapped accuracy.',
                        'Park boundaries/centroids do not identify driveway centers. Spawn and exit stay on US 1.',
                        'No signals, curb radii, lane tapers, or access restrictions are inferred from street lines.',
                        'Only horizontal geography is modelled; altitude is not measured.']
    }
    report = {
        'routeLengthMeters': length, 'sampleCount': len(samples), 'junctionCount': len(junctions),
        'junctions': [{k:j[k] for k in ['name', 'station', 'side', 'lateralMeters', 'sourceConnectionGapMeters']} for j in junctions],
        'inputFeatureCounts': {str(n): len(load(f'roads-{n}.geojson')['features']) for n in [2, 6, 8]},
        'referenceMaximumErrorToNorthboundMeters': ref_error,
        'referenceSha256': hashlib.sha256((ROOT/'notes/us1-reference.geojson').read_bytes()).hexdigest(),
        'carriagewaySeparationMinMeters': min(separations), 'carriagewaySeparationMaxMeters': max(separations),
        'smoothingMaxDeviationFromMappedCenterlineMeters': max(smooth_errors),
        'rightLaneDistanceToMappedCenterlineMinMeters': min(lane_offsets),
        'rightLaneDistanceToMappedCenterlineMaxMeters': max(lane_offsets),
        'kennedyAddressSnapMeters': start[0],
        'rotaryAddressToChosenEndAlongRouteMeters': length-provenance['end']['addressStation'],
        'maximumSampleSpacingMeters': max(b[0]-a[0] for a,b in zip(samples,samples[1:])),
        'netEastMeters': samples[-1][1], 'netNorthMeters': samples[-1][2],
        'headingMinimumDegrees': min(p[3] for p in samples)*180/math.pi,
        'headingMaximumDegrees': max(p[3] for p in samples)*180/math.pi,
        'excludedOutOfRouteConnections': excluded,
        'pass': True,
        'meaning': 'Numerical/source consistency only; no claim of surveyed positional accuracy or rendered gameplay verification.'
    }
    features = [dict(type='Feature', properties={'name': 'Northbound right-lane model', 'lengthMeters': length},
                     geometry={'type': 'LineString', 'coordinates': [frame.inverse(add([p[1], p[2]], origin)) for p in samples]})]
    for j in junctions:
        features.append(dict(type='Feature', properties={'name': j['name'], 'station': j['station'], 'side': j['side']},
                             geometry={'type': 'LineString', 'coordinates': [frame.inverse(add(p, origin)) for p in j['geometry']]}))
    text = '// GENERATED by notes/maps/build-route.py; federal public-domain source attribution in PROVENANCE.\n'
    text += 'export const ROUTE_LENGTH = ' + json.dumps(rounded(length)) + ';\n'
    text += 'export const PROVENANCE = ' + json.dumps(rounded(provenance), indent=2, ensure_ascii=False) + ';\n'
    text += 'export const JUNCTIONS = ' + json.dumps(rounded(junctions), indent=2) + ';\n'
    text += '// [station metres, east x metres, north z metres, heading radians]\nexport const SAMPLES = [\n'
    text += ',\n'.join(json.dumps(rounded(row), separators=(',', ':')) for row in samples) + '\n];\n'
    return {ROOT/'play/route-data.js': text,
            HERE/'validation.json': json.dumps(rounded(report), indent=2)+'\n',
            HERE/'route.geojson': json.dumps(rounded({'type': 'FeatureCollection', 'features': features}), separators=(',', ':'))+'\n'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    outputs = build()
    for path, content in outputs.items():
        if args.check:
            assert path.read_text() == content, f'Stale generated output: {path.relative_to(ROOT)}'
        else:
            path.write_text(content)
    report = json.loads(outputs[HERE/'validation.json'])
    print(json.dumps({'mode': 'checked byte-identical' if args.check else 'built',
                      'routeLengthMeters': report['routeLengthMeters'], 'sampleCount': report['sampleCount'],
                      'junctions': report['junctions'], 'pass': report['pass']}, indent=2))
