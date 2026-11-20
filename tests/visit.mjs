import assert from 'node:assert/strict';
import {freshVisit,step,interact,projection,doorDistance,startEvent,canDrive,canWalk} from '../play/visit.js';
import {routeAt,ROUTE_LENGTH} from '../play/route.js';
import {PARKS,PIER_HEIGHT,parkPavementAt} from '../play/riverfront.js';
import {branchAt,section} from '../play/us1.js';

function frames(state,n,...controls) {
  const keys=new Set(controls);
  for(let i=0;i<n;i++)step(state,keys,1/60);
}
function until(state,predicate,max,...controls) {
  const keys=new Set(controls);
  for(let i=0;i<max&&!predicate(state);i++)step(state,keys,1/60);
  assert(predicate(state),JSON.stringify({x:state.carX,z:state.carZ,speed:state.speed,angle:state.carBearing}));
}

const s=freshVisit(), parked={...s.car};
assert(s.onFoot && parkPavementAt(s.carX,s.carZ) && doorDistance(s)<2.15);
frames(s,175,'KeyS');
assert(s.person.stride>5.5);
assert.deepEqual(s.car,parked);
interact(s);
assert(s.onFoot,'cannot board from a distance');
frames(s,173,'KeyW');
interact(s);
assert(!s.onFoot);

until(s,s=>s.speed>=4,120,'KeyW');
until(s,s=>s.carX<=5.1,320);
assert.equal(s.began,null,'the countdown waits for departure');
until(s,s=>s.carBearing>=-.071,155,'KeyD');
until(s,s=>s.carZ>35,300);
assert(s.began!==null && Math.abs(s.carX)<1);
const mapped=routeAt(s.carZ,s.carX);
assert(Math.hypot(mapped.x-s.car.x,mapped.z-s.car.z)<1e-6);
interact(s);
assert(!s.onFoot,'cannot exit while moving');

until(s,s=>s.carZ>=1460,5000,'KeyW');
until(s,s=>s.speed<=4,200,'KeyS');
assert(s.carZ>ROUTE_LENGTH,'crossing the old finish station does not park the car');
until(s,s=>s.carZ>=1499.5,400);
until(s,s=>s.carBearing>=1.49,180,'KeyD');
until(s,s=>s.carX>=28,600);
until(s,s=>s.speed===0,90,'KeyS');
assert(parkPavementAt(s.carX,s.carZ));
assert(s.heard && s.firstHeard-s.ignition>55);
assert(Math.abs(s.heard.age+s.heard.distance/343-s.t)<.002);
interact(s);
assert(s.onFoot && doorDistance(s)<.02);
const rotaryCar={...s.car};
frames(s,80,'KeyW');
assert.deepEqual(s.car,rotaryCar);
frames(s,79,'KeyS');
interact(s);
assert(!s.onFoot);
until(s,s=>s.carX<26,160,'KeyX');
assert(s.speed<0);
interact(s);
assert(!s.onFoot,'cannot exit while reversing');
until(s,s=>s.speed===0,90,'KeyS');
assert(projection(1440,810,s).project(s.car.x,1,s.car.z)?.depth>2);

const sideStreet=freshVisit({onFoot:false,carX:-1,carZ:884.2,carBearing:0,speed:4});
until(sideStreet,s=>s.carBearing<=-1.49,180,'KeyA');
until(sideStreet,s=>s.carX<-45,900);
assert.equal(branchAt(sideStreet.carX,sideStreet.carZ)?.name,'Pritchard St');

const median=section(240);
assert(!canDrive((median.mw+median.me)/2,240));
assert(!canDrive(10,450));
assert(!canDrive(100,1438));
assert(!canWalk(80,1420));
assert(!canWalk(200,1450));
const pier=freshVisit({walkX:23,walkZ:1436});
frames(pier,190,'KeyD');
assert(pier.walkX>28 && pier.person.y===PIER_HEIGHT);

const stationary=freshVisit();
startEvent(stationary);
frames(stationary,60*67);
assert(stationary.onFoot && stationary.heard && stationary.firstHeard-stationary.ignition>55);
assert.equal(PARKS.length,2);
console.log('PASS · park departure and arrival, real turns, manual parking, reverse, side street, pier and launch audio');
