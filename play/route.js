/* US 1 northbound: Kennedy Point roadside → Rotary Riverfront roadside.
 * Source/rights, literal geographic origins and modelling limits: PROVENANCE
 * and notes/maps/README.md. No runtime network, site/pad coordinates or loop.
 */
import { SAMPLES, ROUTE_LENGTH, JUNCTIONS, PROVENANCE } from './route-data.js';
export { ROUTE_LENGTH, JUNCTIONS, PROVENANCE };

/**
 * @param {number} stationMeters Arc distance along the NB right-lane model.
 * @param {number} lateralMeters Positive is right of traffic, not world east.
 * @returns {{x:number,z:number,heading:number}} East/north metres; heading is
 * radians clockwise from north. lateral=0 is the modelled right lane, NOT
 * the highway center or the northbound carriageway center.
 *
 * Outside [0, ROUTE_LENGTH], continue the endpoint tangent for scenery only.
 * These extensions have no claim to mapped roads or legal driving access.
 */
export function routeAt(stationMeters, lateralMeters = 0) {
  if (!Number.isFinite(stationMeters) || !Number.isFinite(lateralMeters)) {
    throw new TypeError('routeAt requires finite station/lateral metres');
  }
  let x, z, heading;
  const last = SAMPLES.length - 1;
  if (stationMeters <= 0 || stationMeters >= ROUTE_LENGTH) {
    const row = SAMPLES[stationMeters <= 0 ? 0 : last];
    const distance = stationMeters - row[0];
    heading = row[3];
    x = row[1] + Math.sin(heading) * distance;
    z = row[2] + Math.cos(heading) * distance;
  } else {
    let lo = 0, hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1;
      if (SAMPLES[mid][0] <= stationMeters) lo = mid;
      else hi = mid;
    }
    const a = SAMPLES[lo], b = SAMPLES[hi];
    const span = b[0] - a[0], t = (stationMeters - a[0]) / span;
    const t2 = t*t, t3 = t2*t;
    // Sub-metre Hermite interpolation preserves endpoint tangents, avoiding
    // polygonal camera-yaw jumps. Its arc/chord discrepancy is tested below
    // 0.1%; station is measured on the generated right-lane sample polyline.
    const h00 = 2*t3-3*t2+1, h10 = t3-2*t2+t;
    const h01 = -2*t3+3*t2, h11 = t3-t2;
    const ax = Math.sin(a[3])*span, az = Math.cos(a[3])*span;
    const bx = Math.sin(b[3])*span, bz = Math.cos(b[3])*span;
    x = h00*a[1] + h10*ax + h01*b[1] + h11*bx;
    z = h00*a[2] + h10*az + h01*b[2] + h11*bz;
    const d00 = 6*t2-6*t, d10 = 3*t2-4*t+1;
    const d01 = -d00, d11 = 3*t2-2*t;
    heading = Math.atan2(d00*a[1]+d10*ax+d01*b[1]+d11*bx,
                         d00*a[2]+d10*az+d01*b[2]+d11*bz);
  }
  return {x: x + Math.cos(heading)*lateralMeters,
          z: z - Math.sin(heading)*lateralMeters,
          heading};
}
