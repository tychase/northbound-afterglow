// Active geography: stations are metres along the mapped carriageway. Only the
// route adapter converts stations to east/north; camera and acoustics use world metres.
import {routeAt,ROUTE_LENGTH} from './route.js';
import {rocketAt as scenicRocket,C} from './sim.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(n,b)),smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)},ease=(k,dt)=>1-Math.exp(-k*dt),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const origin=routeAt(0,0), up=k=>k.has('ArrowUp')||k.has('KeyW'), down=k=>k.has('ArrowDown')||k.has('KeyS');
export function rocketAt(age){const p=scenicRocket(age);return {x:p.x+origin.x,y:p.y,z:p.z+origin.z}} // fictional distant event, not a surveyed pad
export function hear(s){if(s.t<0||s.t>240)return null;const {x,z}=s.listener,y=s.onFoot?1.65:1.32;
 const distance=a=>{const p=rocketAt(a);return Math.hypot(p.x-x,p.y-y,p.z-z)};
 if(s.t<distance(0)/C)return null;let a=0,b=s.t;for(let i=0;i<18;i++){const m=(a+b)/2;if(m+distance(m)/C>s.t)b=m;else a=m}
 const age=(a+b)/2,p=rocketAt(age),d=distance(age),dx=p.x-x,dz=p.z-z,dy=p.y-y,horiz=Math.hypot(dx,dz),radial=(distance(age+.025)-d)/.025;
 return {...p,age,distance:d,pan:Math.sin(Math.atan2(dx,dz)-s.yaw)*horiz/d,elev:Math.atan2(dy,horiz),rate:(1+(s.velX*dx+s.velZ*dz)/d/C)/(1+radial/C)};
}
const routeYaw=(z,l=0)=>routeAt(z,l).heading;
function positions(s){const ca=routeAt(s.carZ,s.carX),wa=routeAt(s.walkZ,s.walkX);s.car={...ca,heading:ca.heading+s.slip,distance:s.carZ};s.person={...wa,heading:s.walkHeading,stride:s.stride,speed:s.walkSpeed};s.x=s.onFoot?s.walkX:s.carX;s.z=s.onFoot?s.walkZ:s.carZ;s.listener=s.onFoot?s.person:s.car}
export function freshVisit(prefs={}){const s={speed:0,carZ:0,carX:8,walkZ:-.45,walkX:6.15,walkHeading:routeYaw(0)+.55,walkSpeed:0,stride:0,steer:0,slip:0,lane:0,vx:0,velX:0,velZ:0,door:0,doorTimer:0,onFoot:true,cabin:false,time:0,elapsed:0,began:null,t:-8,ignition:8,arrived:false,departed:false,looking:false,look:0,yaw:routeYaw(0),pitch:0,windowOpen:false,windowAmount:0,muted:false,music:true,volume:.65,reduced:false,firstHeard:null,heard:null,mark:null,rocketAt,braking:false,...prefs};positions(s);s.camBack=5.8;s.eye=2.1;s.camAimX=s.listener.x;s.camAimZ=s.listener.z;return s}
export const doorDistance=s=>Math.hypot(s.walkX-(s.carX-1.45),s.walkZ-(s.carZ+.35));
export function interact(s){if(s.doorTimer>.84)return 'Wait for the door.';if(s.onFoot){if(doorDistance(s)>2.25||s.walkX>s.carX)return 'Walk up to the driver’s side.';s.onFoot=false;s.walkSpeed=0;s.cabin=false}else{if(s.speed>.1)return 'Brake to a full stop first.';s.speed=0;s.onFoot=true;s.walkX=s.carX-1.65;s.walkZ=s.carZ+.35;s.walkHeading=s.car.heading;s.walkSpeed=0;s.cabin=false} s.looking=false;s.doorTimer=1.15;positions(s);s.heard=hear(s);return s.onFoot?'On foot · the car stays here.':'In the wagon · hold ↑ or W to drive.'}
export function startEvent(s){if(s.began===null){s.began=s.elapsed;s.time=0;s.t=-s.ignition}}
function walk(s,k,dt,lr){const fb=Number(up(k))-Number(down(k)),len=Math.hypot(lr,fb),speed=(k.has('ShiftLeft')||k.has('ShiftRight')?3.8:2.05);let vz=0,vx=0;
 if(len){const rel=wrap(s.yaw-routeYaw(s.walkZ));vz=(fb*Math.cos(rel)-lr*Math.sin(rel))*speed/len;vx=(fb*Math.sin(rel)+lr*Math.cos(rel))*speed/len}
 const oldX=s.walkX,oldZ=s.walkZ;const nearPark=z=>Math.min(Math.abs(z),Math.abs(ROUTE_LENGTH-z))<16;
 const allow=(x,z)=>z>=-10&&z<=ROUTE_LENGTH+10&&x>=-5.45&&x<=(nearPark(z)?16:4.55)&&!(Math.abs(x-s.carX)<1.26&&Math.abs(z-s.carZ)<2.62);
 const nz=oldZ+vz*dt;if(allow(oldX,nz))s.walkZ=nz;const nx=oldX+vx*dt;if(allow(nx,s.walkZ))s.walkX=nx;
 const dist=Math.hypot(s.walkX-oldX,s.walkZ-oldZ);s.stride+=dist;s.walkSpeed=dist/dt;if(dist>.00005)s.walkHeading+=wrap(routeYaw(s.walkZ)+Math.atan2(s.walkX-oldX,s.walkZ-oldZ)-s.walkHeading)*ease(14,dt);
}
function drive(s,k,dt,lr){s.braking=!!down(k);s.steer+=(lr-s.steer)*ease(7,dt);const remaining=ROUTE_LENGTH-s.carZ;
 if(!s.arrived){s.speed=clamp(s.speed+dt*(down(k)?-9:up(k)?4.4*(1-s.speed/34):0),0,28);if(remaining<42){s.speed=Math.min(s.speed,Math.sqrt(2*3.8*Math.max(0,remaining)));s.braking=true}
 s.carZ=Math.min(ROUTE_LENGTH,s.carZ+s.speed*dt);if(s.carZ>1){s.departed=true;startEvent(s)}
 if(ROUTE_LENGTH-s.carZ<.025&&s.departed){s.carZ=ROUTE_LENGTH;s.speed=0;s.arrived=true}}
 const fade=smooth(s.carZ/23)*smooth((ROUTE_LENGTH-s.carZ)/23);s.vx+=(s.steer*Math.min(2.45,s.speed*.20)-s.vx)*ease(5,dt);s.lane=clamp(s.lane+s.vx*dt,-3.1,1.1);const oldX=s.carX;s.carX=8*(1-fade)+s.lane*fade;
 s.slip+=(Math.atan2(s.carX-oldX,Math.max(.04,s.speed*dt))-s.slip)*ease(5,dt);
}
export function step(s,k,dt){if(!(dt>0))return;s.elapsed+=dt;const old=s.listener,lr=Number(k.has('ArrowRight')||k.has('KeyD'))-Number(k.has('ArrowLeft')||k.has('KeyA'));
 if(s.onFoot){s.braking=false;walk(s,k,dt,lr)}else drive(s,k,dt,lr);positions(s);s.velX=(s.listener.x-old.x)/dt;s.velZ=(s.listener.z-old.z)/dt;
 s.time=s.began===null?0:s.elapsed-s.began;s.t=s.time-s.ignition;s.doorTimer=Math.max(0,s.doorTimer-dt);s.door=Math.sin(Math.PI*clamp(s.doorTimer/1.15,0,1));s.look+=((s.looking?1:0)-s.look)*ease(s.reduced?16:4.3,dt);s.windowAmount+=((s.windowOpen?1:0)-s.windowAmount)*ease(4,dt);
 const p=rocketAt(Math.min(s.t,105)),dx=p.x-s.listener.x,dz=p.z-s.listener.z,bearing=Math.atan2(dx,dz),el=Math.atan2(p.y-1.55,Math.hypot(dx,dz));
 const road=routeYaw(s.z)+(s.onFoot?.08:s.slip*.38);s.yaw=road+wrap(bearing-road)*s.look;s.pitch=(s.cabin?.76:.44)*s.look*Math.min(.75,el);
 const cockpit=s.cabin&&!s.onFoot,back=cockpit?0:s.onFoot?5.8:10.0;s.camBack+=(back-s.camBack)*ease(7,dt);s.eye+=((cockpit?1.55:s.onFoot?2.1:3.62)-s.eye)*ease(7,dt);
 // Camera changes framing, not the listener. Track fast enough to avoid crowding the car when braking.
 s.camAimX=s.listener.x;s.camAimZ=s.listener.z;s.heard=hear(s);if(s.heard&&s.firstHeard===null)s.firstHeard=s.time;
}
export function projection(w,h,s){const focal=Math.min(Math.max(w*.70,h*.54),h*1.45),si=Math.sin(s.yaw),co=Math.cos(s.yaw),shoulder=s.cabin?0:s.onFoot?-.42:-.38,worldX=s.camAimX-si*s.camBack+co*shoulder,worldZ=s.camAimZ-co*s.camBack-si*shoulder,eye=s.eye,bob=s.reduced?0:s.cabin?Math.sin(s.carZ*.84)*.3:0,horizon=h*(s.cabin?.49:.39)+focal*Math.tan(s.pitch)+bob;
 const depth=(X,Z)=>(X-worldX)*si+(Z-worldZ)*co;return {w,h,yaw:s.yaw,horizon,focal,worldX,worldZ,eye,depth,project(X,Y,Z){const dep=depth(X,Z);if(dep<.22)return null;const k=focal/dep;return {x:w*.5+((X-worldX)*co-(Z-worldZ)*si)*k,y:horizon-(Y-eye)*k,depth:dep,k}}}}
