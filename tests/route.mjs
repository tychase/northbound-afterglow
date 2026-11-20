import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {routeAt, ROUTE_LENGTH, JUNCTIONS, PROVENANCE} from '../play/route.js';
import {SAMPLES} from '../play/route-data.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const json = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual-expected) <= tolerance,
  `${actual} differs from ${expected} by ${Math.abs(actual-expected)} (limit ${tolerance})`);
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);

// Independent WGS84 ECEF → ENU implementation, not importing builder code.
function project([longitude,latitude]) {
  const e2 = 0.0066943799901413165, a = 6378137;
  const xyz = ([lo,la]) => {
    const l=lo*Math.PI/180, p=la*Math.PI/180, n=a/Math.sqrt(1-e2*Math.sin(p)**2);
    return [n*Math.cos(p)*Math.cos(l),n*Math.cos(p)*Math.sin(l),n*(1-e2)*Math.sin(p)];
  };
  const origin=PROVENANCE.frame.tangentPlaneOriginLonLat;
  const [lo,la]=origin.map(v=>v*Math.PI/180), d=xyz([longitude,latitude]).map((v,i)=>v-xyz(origin)[i]);
  const [ox,oz]=PROVENANCE.frame.worldOriginENUInTangentPlane;
  return {x:-Math.sin(lo)*d[0]+Math.cos(lo)*d[1]-ox,
    z:-Math.sin(la)*Math.cos(lo)*d[0]-Math.sin(la)*Math.sin(lo)*d[1]+Math.cos(la)*d[2]-oz};
}
function nearest(p,line) {
  let best=Infinity;
  for(let i=1;i<line.length;i++) {
    const a=line[i-1],b=line[i],dx=b.x-a.x,dz=b.z-a.z;
    const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));
    best=Math.min(best,Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz));
  }
  return best;
}

const runtimeMetrics={};
test('fixed bounded endpoints, origin and exported contract',()=>{
  assert.equal(typeof ROUTE_LENGTH,'number');
  assert.ok(ROUTE_LENGTH>1400 && ROUTE_LENGTH<1550);
  assert.deepEqual(Object.keys(routeAt(0)).sort(),['heading','x','z']);
  near(routeAt(0).x,0); near(routeAt(0).z,0);
  near(distance(project(PROVENANCE.start.roadsideLonLat),routeAt(0)),0,.001);
  near(distance(project(PROVENANCE.end.roadsideLonLat),routeAt(ROUTE_LENGTH)),0,.001);
  assert.equal(PROVENANCE.start.station,0);
  near(PROVENANCE.end.station,ROUTE_LENGTH);
  assert.match(PROVENANCE.start.address,/4915 S WASHINGTON AVE/);
  assert.match(PROVENANCE.end.address,/4141 S WASHINGTON AVE/);
});

test('all source snapshot bytes and manifest hashes match',()=>{
  const manifest=json('notes/maps/sources/manifest.json');
  for(const [name,meta] of Object.entries(manifest)) {
    const buffer=readFileSync(new URL(`../notes/maps/sources/${name}`,import.meta.url));
    assert.equal(buffer.length,meta.bytes,name);
    assert.equal(createHash('sha256').update(buffer).digest('hex'),meta.sha256,name);
    assert.ok(meta.url.startsWith('https://'));
  }
  assert.match(json('notes/maps/sources/parks-padus-rights.json').description,/public domain/);
});

test('original reference is NB, not center-of-highway or southbound',()=>{
  const roads=json('notes/maps/sources/roads-6.geojson').features;
  const nb=roads.find(f=>f.properties.OID===PROVENANCE.northboundSourceOID).geometry.coordinates;
  const sb=roads.find(f=>f.properties.OID===PROVENANCE.southboundSourceOID).geometry.coordinates;
  const ref=json('notes/us1-reference.geojson').features[0].geometry.coordinates;
  const crop=a=>a.filter(c=>c[1]>28.552 && c[1]<28.568).map(project);
  const nbp=crop(nb), sbp=crop(sb);
  for(const p of crop(ref)) near(nearest(p,nbp),0,.001);
  let minOffset=Infinity,maxOffset=0;
  for(let s=0;s<=ROUTE_LENGTH;s+=2) {
    const p=routeAt(s), d=nearest(p,nbp);
    assert.ok(d>1.1 && d<2.5,`NB lane offset ${d}`);
    assert.ok(nearest(p,sbp)>9,'selected SB carriageway');
    minOffset=Math.min(minOffset,d);maxOffset=Math.max(maxOffset,d);
  }
  runtimeMetrics.laneDistanceToSourceMinMeters=minOffset;
  runtimeMetrics.laneDistanceToSourceMaxMeters=maxOffset;
  near(PROVENANCE.laneModel.rightLaneOffsetFromMappedCarriagewayMeters,1.8288);
});

test('literal metres, continuous northward motion and tangent heading',()=>{
  let minSpeed=Infinity,maxSpeed=0,maxHeadingError=0,maxTurn=0;
  for(let s=.02;s<ROUTE_LENGTH-.02;s+=.25) {
    const a=routeAt(s-.01),p=routeAt(s),b=routeAt(s+.01);
    const speed=distance(a,b)/.02;
    minSpeed=Math.min(minSpeed,speed);maxSpeed=Math.max(maxSpeed,speed);
    assert.ok(speed>.999 && speed<1.001,`metre scale at ${s}: ${speed}`);
    assert.ok(b.z>a.z,`non-northward motion at ${s}`);
    const tangent=Math.atan2(b.x-a.x,b.z-a.z);
    maxHeadingError=Math.max(maxHeadingError,Math.abs(tangent-p.heading));
    near(tangent,p.heading,.0001);
    maxTurn=Math.max(maxTurn,Math.abs(b.heading-a.heading)/.02);
  }
  runtimeMetrics.minMetresPerStationMetre=minSpeed;
  runtimeMetrics.maxMetresPerStationMetre=maxSpeed;
  runtimeMetrics.maximumHeadingDerivativeErrorRadians=maxHeadingError;
  runtimeMetrics.maximumHeadingChangeRadiansPerMetre=maxTurn;
});

test('positive lateral is right of actual traffic including the NW bend',()=>{
  for(let s=-100;s<ROUTE_LENGTH+100;s+=7) {
    const p=routeAt(s),r=routeAt(s,3.6),l=routeAt(s,-3.6);
    near(distance(p,r),3.6); near(distance(p,l),3.6);
    near((r.x-p.x)*Math.sin(p.heading)+(r.z-p.z)*Math.cos(p.heading),0);
    near((r.x-p.x)*Math.cos(p.heading)-(r.z-p.z)*Math.sin(p.heading),3.6);
    assert.ok(r.x>p.x);
    near(r.heading,p.heading);
  }
});

test('all six real named crossings, aliases, measured branch geometry and sides',()=>{
  assert.deepEqual(JUNCTIONS.map(j=>j.name),['Cheney Hwy','Birch St','Pritchard St','Coquina Ave','Knox McRae Dr','Delespine Ave']);
  assert.ok(JUNCTIONS[0].aliases.includes('State Hwy 50'));
  const inputs=[...json('notes/maps/sources/roads-6.geojson').features,...json('notes/maps/sources/roads-8.geojson').features];
  JUNCTIONS.forEach((j,i)=>{
    assert.ok(j.station>0&&j.station<ROUTE_LENGTH);
    if(i) assert.ok(j.station>JUNCTIONS[i-1].station);
    assert.equal(j.side,'west');
    assert.ok(j.sourceOIDs.every(id=>inputs.some(f=>f.properties.OID===id)));
    near(j.sourceConnectionGapMeters,0,.001);
    assert.ok(j.lateralMeters<0);
    near(distance(j.mappedPosition,project(j.sourceLonLat)),0,.001);
    near(distance(j.mappedPosition,routeAt(j.station,j.lateralMeters)),0,.025);
    assert.ok(j.geometry.length>=2);
    assert.ok(j.geometry.at(-1)[0]<j.geometry[0][0]);
    const length=j.geometry.slice(1).reduce((d,p,n)=>d+Math.hypot(p[0]-j.geometry[n][0],p[1]-j.geometry[n][1]),0);
    near(length,120,.001);
  });
});

test('sampling and Hermite joins have no positional or heading jumps',()=>{
  near(SAMPLES[0][0],0); near(SAMPLES.at(-1)[0],ROUTE_LENGTH);
  for(let i=1;i<SAMPLES.length;i++) {
    const s=SAMPLES[i][0];
    assert.ok(s>SAMPLES[i-1][0]);
    assert.ok(s-SAMPLES[i-1][0]<.76);
    const a=routeAt(s-1e-5),b=routeAt(s+1e-5);
    assert.ok(distance(a,b)<.000021);
    near(a.heading,b.heading,.00001);
    near(routeAt(s).x,SAMPLES[i][1],1e-6);
    near(routeAt(s).z,SAMPLES[i][2],1e-6);
  }
});

test('scenery extensions are endpoint tangents, never a loop',()=>{
  for(const [endpoint,direction] of [[0,-1],[ROUTE_LENGTH,1]]) {
    const p=routeAt(endpoint);
    for(const d of [1,20,500]) {
      const q=routeAt(endpoint+direction*d);
      near(distance(p,q),d);near(q.heading,p.heading);
      near(q.x,p.x+direction*d*Math.sin(p.heading));
      near(q.z,p.z+direction*d*Math.cos(p.heading));
    }
  }
});

test('invalid input fails explicitly',()=>{
  for(const value of [NaN,Infinity,-Infinity,'12',undefined,null]) {
    assert.throws(()=>routeAt(value),TypeError);
  }
  for(const value of [NaN,Infinity,'0',null]) assert.throws(()=>routeAt(0,value),TypeError);
});

test('offline builder reproduces all generated bytes',()=>{
  const output=execFileSync('python',['-B','notes/maps/build-route.py','--check'],{cwd:root,encoding:'utf8'});
  assert.equal(JSON.parse(output).mode,'checked byte-identical');
});

test('source consistency report is quantitative, with disclosed anchor limits',()=>{
  const r=json('notes/maps/validation.json');
  assert.equal(r.pass,true);assert.equal(r.junctionCount,JUNCTIONS.length);assert.equal(r.sampleCount,SAMPLES.length);
  near(r.routeLengthMeters,ROUTE_LENGTH);
  assert.ok(r.smoothingMaxDeviationFromMappedCenterlineMeters<.6);
  assert.ok(r.carriagewaySeparationMinMeters>8&&r.carriagewaySeparationMaxMeters<25);
  assert.ok(r.rotaryAddressToChosenEndAlongRouteMeters>50);
  assert.match(PROVENANCE.start.mapping,/not mapped entrance/);
  assert.match(PROVENANCE.end.mapping,/not a verified driveway/);
  console.log('RUNTIME QUANTITATIVE VALIDATION',JSON.stringify(runtimeMetrics));
});
