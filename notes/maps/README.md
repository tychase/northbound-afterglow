# Kennedy Point → Rotary Riverfront: bounded US 1 alignment

**Delivered route length: 1480.69140238 m.** This is a real, bounded horizontal map alignment, not an invented straight road, compressed drive, route to a launch pad, or navigation product. Runtime has no network dependencies.

Source: **U.S. Census Bureau** TIGERweb transportation geometry, January 1, 2026; **U.S. Geological Survey** PAD-US park polygons; Census address geocoder. Retrieved 2026-11-19. Full URLs, retrieval timestamps, response sizes and SHA-256 hashes are in `sources/manifest.json`.

**TIGER/Line® is a registered trademark of the U.S. Census Bureau.** The trademark describes the nature of the source data, not this game's name or ownership. This independent game is not a Census Bureau product or endorsement. Government data is supplied without positional/attribute-accuracy warranty.

## Runtime contract

```js
import { routeAt, ROUTE_LENGTH, JUNCTIONS, PROVENANCE } from './route.js';
const spawn = routeAt(0);                 // {x:0, z:0, heading:...}
const finish = routeAt(ROUTE_LENGTH);
const right = routeAt(500, 3.6);          // 3.6 m right of northbound traffic
```

- `x` is true local east and `z` true local north, in actual horizontal metres. Station is distance **along the modelled northbound right lane**; it is not world `z` and is not latitude multiplied by a scale factor.
- `heading` is radians clockwise from north, `atan2(dx,dz)`.
- `lateral=0` is the **modelled right-lane center**. Positive lateral uses `(cos(heading), -sin(heading))`, so it remains perpendicular/right on the northwest bend.
- Values outside `[0, ROUTE_LENGTH]` continue the corresponding endpoint tangent, without looping or continuing a fabricated mapped route. Those positions are scenery extrapolations only.
- Invalid/nonfinite coordinates throw `TypeError`.
- `JUNCTIONS` gives name, measured station, geographical approach side, aliases, source OIDs, actual mapped junction position, source lon/lat, lane-relative offset, branch heading and a **120 m clipped mapped street-centerline geometry** in world `[x,z]` coordinates. These are not surveyed pavement/curb outlines or permissions to turn.

Renderer/simulation integration belongs to the parent task. This module does not change those consumers, spawn the live car, or verify a rendered drive.

## Which US 1 line is actually mapped?

The finest-scale Census transportation layers return **two distinct US Hwy 1 carriageway lines**, not one highway centerline:

| Role | TIGERweb OID | Interpretation |
|---|---|---|
| Selected | `1104689770051` | Eastern, northbound carriageway centerline |
| Cross-check | `1104691845668` | Western, southbound carriageway centerline |
| Existing reference alias | `1104323491203` | `S Washington Ave`, coincident with selected line in this drive |

`notes/us1-reference.geojson` is unchanged. Its corridor vertices match the selected northbound geometry within 0.001 m numerical tolerance (measured maximum rounds to 0.0 m). The other carriageway stays west and is **10.33413973–17.36893432 m** away over the bounded drive. This is a source-to-source check, **not** millimetre real-world accuracy.

Both source arrays happen to run southward in storage. The builder reverses the selected trace. Direction is identified by the eastern member of a normal right-hand-traffic highway pair, not by source coordinate order or a fictional direction field: this service has **no one-way/direction or lane-width attributes**.

### Right-lane translation

The selected geometry is a **carriageway centerline, not a lane centerline**. The model assumes two through lanes northbound, each 12 ft / **3.6576 m**, and shifts **+1.8288 m** to the right of the mapped northbound center. It does **not** add a median plus half the whole highway width, which would double-count the mapped carriageway separation.

FDOT project `454217-1`, sequence 1, lists a divided section from Cheney Hwy to Alhambra St with four lanes and 24 ft pavement each direction; the factual excerpt is retained in `sources/corroboration.json`. This supports the nominal model, not lane-level mapping. Its extension south of Cheney is explicitly assumed. Lane edges, turn pockets, tapering, median openings, signal timing and intersection curb radii remain unverified. Do not use the existing renderer's scenic total-road-width assumptions as geographic evidence.

## Literal origin and station anchors

All lon/lat arrays are **[longitude, latitude]** in degrees. Geometry is transformed from WGS84 ellipsoid ECEF to an east/north tangent plane (ellipsoid height set to zero). This avoids the substantial local scale distortion of using raw Web Mercator coordinates as metres.

Tangent-plane reference: **[-80.79630063, 28.55337384]**, the Census Kennedy address match. Game world origin is translated **east -4.34608498 m, north -1.33779565 m** within that plane, onto the right-lane model. The translation preserves east/north orientation. `PROVENANCE.frame` records every value.

| Anchor | Station m | World east x m | World north z m | Longitude | Latitude | UTM 17N easting m | UTM 17N northing m |
|---|---:|---:|---:|---:|---:|---:|---:|
| Kennedy roadside / game origin | 0 | 0 | 0 | -80.79634504 | 28.55336177 | 519920.671 | 3158520.489 |
| Rotary roadside / end | 1480.69140238 | -181.91205899 | 1449.97068823 | -80.79820428 | 28.56644476 | 519736.367 | 3159969.576 |

UTM coordinates are **EPSG:32617 / WGS84 UTM zone 17N**, supplied as geographic reference values using Snyder's transverse-Mercator series. Gameplay does **not** use UTM grid heading, grid distance or grid-north rotation. The many printed decimals support repeatable construction; they do not imply surveyed accuracy. TIGER's NAD83-derived map geometry, its WGS84 service output, and PAD-US source accuracy have not been field-qualified.

### Kennedy: mapped versus approximate

- County-confirmed identity/address: **Kennedy Point Park, 4915 S. Washington Ave, Titusville, FL 32780**.
- Census exact address match: **[-80.79630063, 28.55337384]**, TLID **93928718**. This is **address-range interpolation**, not a rooftop or driveway survey.
- `station=0` is its nearest projection onto the northbound right-lane model, a **4.54732359 m** snap.
- USGS PAD-US separately identifies Kennedy Point Park, source PAID **1271900-0006**, with a park polygon at this location. This corroborates the park rather than silently accepting any address match.
- Spawn is **on US 1 opposite the park**. The driveway, parking area, exact entry/exit kerb and a turn out of the park are **not mapped by this module**.

### Rotary: mapped versus approximate

- County-confirmed identity/address: **Rotary Riverfront Park, 4141 S. Washington Ave, Titusville, FL 32780**.
- Census exact address match: **[-80.79822593, 28.56564528]**, TLID **93892383**. This lands near the southern park extent, not the primary park frontage.
- USGS PAD-US source PAID **1271900-0010** contains **two polygon components**. The builder chooses the component nearest the 4141 address (the southern/main component), computes its area centroid **[-80.79795164, 28.56643916]**, and projects that point to the lane.
- The chosen end is **88.49709182 m farther along the lane** than simply ending at the Census address projection. The park centroid is **24.72623814 m** off the modelled lane.
- This produces a road endpoint opposite the main mapped park, just past Delespine Ave. It is **not a verified entrance center, turn maneuver, or parking destination**. Both game spawn and game exit are roadside approximations tied to verified park geography.

## Real cross streets (northbound order)

| Source name | Station m | Approach side |
|---|---:|---|
| Cheney Hwy | 481.202 | west |
| Birch St | 679.107 | west |
| Pritchard St | 889.600 | west |
| Coquina Ave | 1081.035 | west |
| Knox McRae Dr | 1275.598 | west |
| Delespine Ave | 1474.646 | west |

Cheney is also represented as **State Hwy 50** and **Orlando Rd** in the Census data; those aliases are preserved and deduplicated, not rendered as separate intersections. Every listed cross-street endpoint has **0.0 m source topological gap** to the northbound source line. Lane-relative offsets differ slightly from -1.8288 m because the road corners are gently rounded while the junction positions retain the raw mapped vertices.

The builder searches all returned named local/secondary endpoint connections, rather than merely placing this table by hand. It also asserts the expected six names to detect source refresh changes. The bounded source query returns 0 primary, 12 secondary and 50 local features (including aliases). No source transfer limit was reached. Riveredge Dr connects **112.18145961 m south** of station zero; Parker Dr connects at **1666.66088565 m**, beyond the end. They are recorded as excluded rather than brought into the drive. Unnamed/private driveway completeness is **not claimed**. A private park entrance does not become a made-up named cross street.

## Sources and verified reuse rights

- `sources/roads-{2,6,8}.geojson` and corresponding metadata: raw Census REST responses. URLs and exact bbox/query parameters are in the manifest and fetcher. Census states: **“Copyright protection is not available for any work of the United States Government (Title 17 U.S.C., Section 105). Thus, you are free to reproduce census materials as you see fit.”** Full original `sources/census-rights.pdf`, chapter 1, retains citation/trademark/disclaimer wording.
- `sources/geocode-{kennedy,rotary}.json`: raw Census geocoder responses, benchmark `Public_AR_Current`, including exact matched addresses, interpolated coordinates, ranges, sides and TLIDs.
- `sources/parks-padus.geojson`: raw USGS-linked **PAD-US Manager Name** service response. The served metadata names **PADUS4_1ManagerName**; individual park source dates are **2023/05/15**, aggregated from TPL ParkServe into PAD-US. Do not call them a 2026 park survey.
- `sources/parks-padus-rights.json`: exact official service-item metadata, with **“PAD-US dataset which is in the public domain”** and no-warranty terms. Official USGS web-services page links this exact item `d1c464bac63d44bc88a4a059dc69d259`. USGS PAD-US 4 data release also identifies CC0: <https://doi.org/10.5066/P96WBCHS>. The service-item statement is the direct reuse evidence for the current 4.1-served snapshot.
- `sources/corroboration.json`: explicitly marked, manually transcribed **factual excerpts**, not full source documents. County names/addresses, the FDOT lane-width table and the USGS official link are recorded separately from the geometry data.

No Google/OSM/commercial basemap geometry, aerial imagery, third-party artwork or restricted Brevard GIS layer is shipped. In particular, the county GIS hub says data/maps may not be resold without prior consent: an “open data” label was **not** treated as a license. The inconsistent tourism Kennedy address was rejected. The legacy USGS host returned 502; the official USGS-linked hosted service supplied both parks.

## Reproduce and verify (no server)

From the repository root, using Python 3 standard library and Node:

```sh
python -B notes/maps/build-route.py          # offline; writes only generated route outputs
python -B notes/maps/build-route.py --check  # offline; byte-for-byte comparison, no writes
node --test tests/route.mjs                  # 11 tests, includes offline reproducibility check
```

Outputs: `play/route-data.js`, `notes/maps/route.geojson`, `notes/maps/validation.json`.
The builder verifies the checked-in raw-source manifest hashes before constructing anything. The unchanged original reference is also hash-recorded. It clips the long source routes to the bounded corridor; `route.geojson` contains only this drive and its short named branches, not statewide roads or sites.

An **explicit, optional source refresh** is separate from the offline build:

```sh
python -B notes/maps/fetch-sources.py --refresh
python -B notes/maps/build-route.py
node --test tests/route.mjs
```

Current APIs can change. A refresh replaces snapshots and their manifest; review differences, bounds, naming and permissions before accepting new outputs. The factual corroboration excerpt is not automatically rewritten. Reproducibility is guaranteed against the checked-in source bytes, not promised against a future live API.

## Quantitative validation and remaining limits

`validation.json` records the full numerical report; `runtime-test.txt` records the real Node run.

- **2000 samples**, maximum interval **0.74905506 m**; **6** named street junctions.
- Bounded 8 m corner-cut quadratic fillets, not unconstrained splines; maximum sampled deviation from mapped carriageway centerline **0.3211435 m**.
- Modelled lane distance to the raw NB line **1.72218985–2.14389554 m** after corner rounding. Absolute physical lane-center error is unknown.
- Independent JS tests compare shipped coordinates with independently projected federal source geometry, verify snapshot hashes, lane selection, full street list, geometry and measured branch lengths, finite input handling, right-hand lateral sign, forward progress, endpoint tangent extrapolation and positional/heading continuity at all joins.
- The tested finite-difference travel scale was **0.9999999468–1.0000034286 metres per station metre**, a maximum observed error of **0.00034286%**. Cubic Hermite reconstruction between sub-metre samples therefore does not materially alter actual scale.
- Heading range is **-19.30527559° to +4.66647712°**, preserving the real northwest reach and turn toward north. The world is not rotated to make the entire route a straight `z` axis.
- **11/11 Node tests pass**, including byte-identical offline regeneration. No browser, server, authentication or publishing was involved.

These tests establish source fidelity and implementation consistency, **not** surveyed accuracy, current construction state, legal turn access, exact park driveways, vertical terrain, or a rendered/controller-integrated playthrough. Those remain outside this bounded map-data deliverable.
