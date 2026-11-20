// Visual traces of the checked-in 2023 USDA orthophoto, in [lateral, station]
// metres. Access, pavement edges and shoreline are approximate.
export const PARKS = [
  {
    name: 'Kennedy Point Park', station: 20, sign: [15, 8],
    bay: [24, 19], heading: -Math.PI / 2,
    pavement: [
      [2.2, 14], [10, 13], [17, 15], [23, 15], [23, 2],
      [19, -2], [19, -32], [29, -35], [33, -19], [52, -24],
      [61, -30], [80, -34], [88, -32], [74, -21], [69, -7],
      [67, 15], [63, 25], [56, 30], [16, 29], [10, 25], [2.2, 25],
    ],
  },
  {
    name: 'Rotary Riverfront Park', station: 1506, sign: [13, 1498],
    pavement: [
      [2.2, 1501], [13, 1501], [19, 1497], [43, 1497], [46, 1500],
      [46, 1508], [40, 1511], [15, 1511], [10, 1510], [2.2, 1510],
    ],
  },
];

// Shoreline offsets read along the perpendicular to the road, including the
// marina basin and the narrow headland at Rotary. Values between picks interpolate.
const shore = [
  [-90, 67], [-60, 76], [-44, 108], [-33, 94], [-20, 81], [0, 75],
  [19, 71], [24, 68], [38, 65], [54, 66], [70, 66], [89, 66], [110, 66],
  [125, 66], [248, 65], [312, 58], [342, 46], [354, 24], [420, 22],
  [480, 24], [550, 19], [625, 19], [683, 36], [720, 29], [780, 39],
  [860, 30], [940, 26], [985, 40], [1030, 66], [1085, 56], [1145, 30],
  [1260, 29], [1355, 25], [1390, 20], [1410, 24], [1438, 24], [1455, 27],
  [1468, 33], [1480, 45], [1489, 59], [1498, 63], [1510, 56],
  [1525, 51], [1550, 49],
];

export function bankAt(station) {
  const i = shore.findIndex(([end]) => end >= station);
  if (i === -1) return shore.at(-1)[1];
  if (i === 0) return shore[0][1];
  const [start, near] = shore[i - 1], [end, far] = shore[i];
  return near + (far - near) * (station - start) / (end - start);
}

// Brevard County lists the pier as 750 × 8 ft. The attachment and angle
// come from the aerial; the bay end extends beyond the aerial crop.
export const PIER = [[22, 1435], [251, 1441], [251, 1443.44], [22, 1437.44]];
export const PIER_HEIGHT = .42;
export const DRIVE_START = -55;
export const DRIVE_END = 1530;

export function insidePolygon(x, z, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, az] = polygon[j], [bx, bz] = polygon[i];
    if ((az > z) !== (bz > z) && x < ax + (bx - ax) * (z - az) / (bz - az)) {
      inside = !inside;
    }
  }
  return inside;
}

export const parkPavementAt = (x, z) => PARKS.some(park =>
  Math.abs(park.station - z) < 65 && insidePolygon(x, z, park.pavement));
export const pierAt = (x, z) => x >= 22 && x < 251 && z >= 1435 && z < 1444
  && insidePolygon(x, z, PIER);
