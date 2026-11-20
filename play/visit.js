// Active geography: stations are metres along the mapped carriageway. Only the
// route adapter converts stations to east/north; camera and acoustics use world metres.
import {routeAt} from './route.js';
import {branchAt,lots,section} from './us1.js';
import {bankAt,DRIVE_START,DRIVE_END,PARKS,parkPavementAt,pierAt,PIER_HEIGHT} from './riverfront.js';
import {rocketAt as scenicRocket,C} from './sim.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(n,b)),smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)},ease=(k,dt)=>1-Math.exp(-k*dt),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const up=k=>k.has('ArrowUp')||k.has('KeyW'), down=k=>k.has('ArrowDown')||k.has('KeyS');
// NASA's published 39A reference projected into the game's east/north
// frame. The hardware, trajectory and countdown remain fictional.
export function rocketAt(age) {
  const p = scenicRocket(age);
  return {x:18792.4 + p.x - 2840, y:p.y, z:6115.1 + p.z - 4980};
}
export function hear(s){if(s.t<0||s.t>240)return null;const {x,z}=s.listener,y=(s.listener.y||0)+(s.onFoot?1.65:1.32);
 const distance=a=>{const p=rocketAt(a);return Math.hypot(p.x-x,p.y-y,p.z-z)};
 if(s.t<distance(0)/C)return null;let a=0,b=s.t;for(let i=0;i<18;i++){const m=(a+b)/2;if(m+distance(m)/C>s.t)b=m;else a=m}
 const age=(a+b)/2,p=rocketAt(age),d=distance(age),dx=p.x-x,dz=p.z-z,dy=p.y-y,horiz=Math.hypot(dx,dz),radial=(distance(age+.025)-d)/.025;
 return {...p,age,distance:d,pan:Math.sin(Math.atan2(dx,dz)-s.yaw)*horiz/d,elev:Math.atan2(dy,horiz),rate:(1+(s.velX*dx+s.velZ*dz)/d/C)/(1+radial/C)};
}
const routeYaw = station => routeAt(station).heading;

export function canDrive(x, z) {
  if (z < DRIVE_START || z > DRIVE_END) return false;
  if (parkPavementAt(x, z) || branchAt(x, z)) return true;
  const {w, mw, me, open} = section(z);
  return x >= w && x <= 2.59 && (open || x <= mw || x >= me);
}

export function canWalk(x, z) {
  if (z < DRIVE_START || z > DRIVE_END) return false;
  if (pierAt(x, z)) return true;
  if (x > bankAt(z) - .65 || (x < section(z).w - 4 && !branchAt(x, z))) return false;
  return !lots.some(([left, start, width, depth]) =>
    x > left-.25 && x < left+width+.25 && z > start-.25 && z < start+depth+.25);
}

function positions(s) {
  const ca = routeAt(s.carZ, s.carX), wa = routeAt(s.walkZ, s.walkX);
  s.car = {...ca, heading: ca.heading + s.carBearing, distance: s.wheelTravel};
  s.person = {...wa, y: pierAt(s.walkX, s.walkZ) ? PIER_HEIGHT : 0,
    heading: s.walkHeading, stride: s.stride, speed: s.walkSpeed};
  s.x = s.onFoot ? s.walkX : s.carX;
  s.z = s.onFoot ? s.walkZ : s.carZ;
  s.listener = s.onFoot ? s.person : s.car;
}

export function freshVisit(prefs={}) {
  const {bay: [carX, carZ], heading: carBearing} = PARKS[0];
  const s = {speed:0, carX, carZ, carBearing, wheelTravel:0, distance:0,
    walkX:carX-.35, walkZ:carZ-1.65, walkHeading:routeYaw(carZ)+.55, walkSpeed:0,
    stride:0, steer:0, velX:0, velZ:0, door:0, doorTimer:0, onFoot:true, cabin:false,
    time:0, elapsed:0, began:null, t:-8, ignition:8, looking:false, look:0,
    yaw:routeYaw(carZ), pitch:0, windowOpen:false, windowAmount:0, muted:false,
    music:true, volume:.65, reduced:false, firstHeard:null, heard:null, mark:null,
    rocketAt, braking:false, ...prefs};
  positions(s);
  s.camBack=5.8;s.eye=2.1;s.camAimX=s.listener.x;s.camAimZ=s.listener.z;
  return s;
}

function carPoint(x, z, angle, right, forward) {
  const co = Math.cos(angle), si = Math.sin(angle);
  return [x + right * co + forward * si, z - right * si + forward * co];
}

const driverDoor = s => carPoint(s.carX, s.carZ, s.carBearing, -1.55, .35);
export function doorDistance(s) {
  const [x, z] = driverDoor(s);
  return Math.hypot(s.walkX-x, s.walkZ-z);
}

export function interact(s) {
  if (s.doorTimer > .84) return 'Wait for the door.';
  if (s.onFoot) {
    if (doorDistance(s) > 2.15) return 'Walk up to the driver’s side.';
    s.onFoot = false;
  } else {
    if (Math.abs(s.speed) > .1) return 'Brake to a full stop first.';
    const [x, z] = driverDoor(s);
    if (!canWalk(x, z)) return 'Leave room by the driver’s door.';
    s.speed = 0;
    s.onFoot = true;
    s.walkX = x;
    s.walkZ = z;
    s.walkHeading = s.car.heading;
  }
  s.walkSpeed = 0;
  s.cabin = false;
  s.looking = false;
  s.doorTimer = 1.15;
  positions(s);
  s.heard = hear(s);
  return s.onFoot ? 'On foot · the car stays here.' : 'In the wagon · W to drive, X to reverse.';
}

export function startEvent(s){if(s.began===null){s.began=s.elapsed;s.time=0;s.t=-s.ignition}}

function walk(s, keys, dt, lr) {
  const fb = Number(up(keys))-Number(down(keys)), len = Math.hypot(lr, fb);
  if (!len) { s.walkSpeed = 0; return; }
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3.8 : 2.05;
  const rel = wrap(s.yaw-routeYaw(s.walkZ));
  const dz = (fb*Math.cos(rel)-lr*Math.sin(rel))*speed*dt/len;
  const dx = (fb*Math.sin(rel)+lr*Math.cos(rel))*speed*dt/len;
  const allow = (x, z) => {
    if (!canWalk(x, z)) return false;
    const right = x-s.carX, forward = z-s.carZ;
    return Math.abs(right*Math.cos(s.carBearing)-forward*Math.sin(s.carBearing)) > 1.22
      || Math.abs(right*Math.sin(s.carBearing)+forward*Math.cos(s.carBearing)) > 2.60;
  };
  const oldX = s.walkX, oldZ = s.walkZ;
  if (allow(oldX, oldZ + dz)) s.walkZ += dz;
  if (allow(oldX + dx, s.walkZ)) s.walkX += dx;
  const distance = Math.hypot(s.walkX-oldX, s.walkZ-oldZ);
  s.stride += distance;
  s.walkSpeed = distance/dt;
  if(distance > .00005) {
    const facing = routeYaw(s.walkZ)+Math.atan2(s.walkX-oldX,s.walkZ-oldZ);
    s.walkHeading += wrap(facing-s.walkHeading)*ease(14, dt);
  }
}

const WHEELS = [[-.82, -1.64], [.82, -1.64], [-.82, 1.64], [.82, 1.64]];
function drive(s, keys, dt, lr) {
  const throttle = up(keys), reverse = keys.has('KeyX');
  s.braking = down(keys);
  s.steer += (lr-s.steer)*ease(10, dt);
  if (s.braking || (throttle && s.speed < 0) || (reverse && s.speed > 0)) {
    s.speed = Math.sign(s.speed) * Math.max(0, Math.abs(s.speed)-10*dt);
  } else if (throttle) {
    s.speed = Math.min(28,s.speed+dt*4.4*(1-s.speed/34));
  } else if (reverse) {
    s.speed = Math.max(-5,s.speed-3*dt);
  } else if (s.speed < 0) {
    s.speed = Math.min(0,s.speed+2.2*dt);
  }
  if (!s.speed) return;

  const onHighway = s.carX >= section(s.carZ).me && s.carX <= 1.5;
  if (onHighway && !lr && Math.abs(s.carBearing) < .13) {
    s.carBearing *= 1-ease(3,dt);
  }
  const distance = s.speed*dt;
  const yawDelta = distance*s.steer/(4.3+.055*s.speed*s.speed);
  const angle = wrap(s.carBearing+yawDelta);
  const [x, z] = carPoint(s.carX,s.carZ,s.carBearing+yawDelta/2,0,distance);
  const fits = canDrive(x, z) && WHEELS.every(([right, forward]) =>
    canDrive(...carPoint(x, z, angle, right, forward)));
  if (fits) {
    s.carX = x;
    s.carZ = z;
    s.carBearing = angle;
    s.wheelTravel += distance;
    s.distance += Math.abs(distance);
    if (!parkPavementAt(x, z)) startEvent(s);
  } else {
    s.speed = 0;
  }
}
export function step(s,k,dt){if(!(dt>0))return;s.elapsed+=dt;const old=s.listener,lr=Number(k.has('ArrowRight')||k.has('KeyD'))-Number(k.has('ArrowLeft')||k.has('KeyA'));
 if(s.onFoot){s.braking=false;walk(s,k,dt,lr)}else drive(s,k,dt,lr);positions(s);s.velX=(s.listener.x-old.x)/dt;s.velZ=(s.listener.z-old.z)/dt;
 s.time=s.began===null?0:s.elapsed-s.began;s.t=s.time-s.ignition;s.doorTimer=Math.max(0,s.doorTimer-dt);s.door=Math.sin(Math.PI*clamp(s.doorTimer/1.15,0,1));s.look+=((s.looking?1:0)-s.look)*ease(s.reduced?16:4.3,dt);s.windowAmount+=((s.windowOpen?1:0)-s.windowAmount)*ease(4,dt);
 const p=rocketAt(Math.min(s.t,105)),dx=p.x-s.listener.x,dz=p.z-s.listener.z,bearing=Math.atan2(dx,dz),el=Math.atan2(p.y-1.55-(s.listener.y||0),Math.hypot(dx,dz));
 const facing=s.onFoot?routeYaw(s.z)+.08:s.car.heading;s.yaw=facing+wrap(bearing-facing)*s.look;s.pitch=(s.cabin?.76:.44)*s.look*Math.min(.75,el);
 const cockpit=s.cabin&&!s.onFoot,back=cockpit?0:s.onFoot?5.8:10.0;s.camBack+=(back-s.camBack)*ease(7,dt);s.eye+=((cockpit?1.55:s.onFoot?2.1+s.person.y:3.62)-s.eye)*ease(7,dt);
 // Camera changes framing, not the listener. Track fast enough to avoid crowding the car when braking.
 s.camAimX=s.listener.x;s.camAimZ=s.listener.z;s.heard=hear(s);if(s.heard&&s.firstHeard===null)s.firstHeard=s.time;
}
export function projection(w,h,s){const focal=Math.min(Math.max(w*.70,h*.54),h*1.45),si=Math.sin(s.yaw),co=Math.cos(s.yaw),shoulder=s.cabin?0:s.onFoot?-.42:-.38,worldX=s.camAimX-si*s.camBack+co*shoulder,worldZ=s.camAimZ-co*s.camBack-si*shoulder,eye=s.eye,bob=s.reduced?0:s.cabin?Math.sin(s.wheelTravel*.84)*.3:0,horizon=h*(s.cabin?.49:.39)+focal*Math.tan(s.pitch)+bob;
 const depth=(X,Z)=>(X-worldX)*si+(Z-worldZ)*co;return {w,h,yaw:s.yaw,horizon,focal,worldX,worldZ,eye,depth,project(X,Y,Z){const dep=depth(X,Z);if(dep<.22)return null;const k=focal/dep;return {x:w*.5+((X-worldX)*co-(Z-worldZ)*si)*k,y:horizon-(Y-eye)*k,depth:dep,k}}}}
