// A scenic, not flight-engineering, trajectory. Units: metres and seconds.
export const C = 343, END = 96;
const clamp=(v,l,h)=>Math.min(h,Math.max(l,v));
export function rocketAt(t) {
 const a=Math.max(0,t);
 // Broad eastward arc, receding from the moving road. Smooth bounded velocity.
 const rise=a-10*(1-Math.exp(-a/10)), arc=a-23*(1-Math.exp(-a/23));
 return {x:2840+49*arc,y:4+82*rise,z:4980+50*arc};
}
export function heardAt(s) {
 const range=a=>{const p=rocketAt(a);return Math.hypot(p.x-s.x,p.y-1.55,p.z-s.z)};
 if(s.t<0 || s.t<range(0)/C)return null;
 let lo=0,hi=s.t;
 for(let i=0;i<15;i++){const m=(hi+lo)*.5;if(m+range(m)/C>s.t)hi=m;else lo=m}
 const age=(lo+hi)*.5, p=rocketAt(age), dx=p.x-s.x, dz=p.z-s.z, d=range(age), dy=p.y-1.55;
 const dr=(range(age+.025)-d)/.025;
 return {...p,age,distance:d,pan:clamp(Math.sin(Math.atan2(dx,dz)-s.yaw)*Math.hypot(dx,dz)/d,-1,1),elev:Math.atan2(dy,Math.hypot(dx,dz)),rate:(1+(s.speed*dz/d)/C)/(1+dr/C)};
}
export function fresh(opts={}){return {time:0,t:-8,ignition:8,x:0,z:0,speed:17.5,steer:0,vx:0,yaw:.065,pitch:0,look:0,looking:false,windowOpen:false,windowAmount:0,music:true,muted:false,volume:.65,reduced:false,heard:null,firstHeard:null,mark:null,rocketAt,...opts}}
export function tick(s,k,dt){
 const exp=(n)=>1-Math.exp(-n*dt);
 s.time+=dt;s.t=s.time-s.ignition;
 // Cruise holds the chosen speed. A stopped car only moves again under throttle.
 const throttle=k.has('ArrowUp')||k.has('KeyW'),brake=k.has('ArrowDown')||k.has('KeyS');
 s.speed=clamp(s.speed+dt*(brake?-8.4:throttle?3.9*(1-s.speed/40):0),0,32);
 const lr=Number(k.has('ArrowRight')||k.has('KeyD'))-Number(k.has('ArrowLeft')||k.has('KeyA'));
 s.steer+=(lr-s.steer)*exp(6); s.vx+=(s.steer*Math.min(2.6,s.speed*.23)-s.vx)*exp(5);
 s.x=clamp(s.x+s.vx*dt,-3.1,1.5);s.z+=s.speed*dt;
 s.look+=((s.looking?1:0)-s.look)*exp(s.reduced?18:4.3);s.windowAmount+=((s.windowOpen?1:0)-s.windowAmount)*exp(4);
 const p=rocketAt(s.t),az=Math.atan2(p.x-s.x,p.z-s.z),el=Math.atan2(p.y-1.55,Math.hypot(p.x-s.x,p.z-s.z));
 s.yaw=.065+(az-.065)*s.look+s.steer*.022;s.pitch=s.look*Math.min(.48,el*.76);
 s.heard=heardAt(s);if(s.heard && s.firstHeard===null)s.firstHeard=s.time;
}
export function projection(w,h,s){const focal=Math.min(w*.70,h*1.55),b=s.reduced?0:Math.sin(s.z*.84)*Math.min(1,s.speed/8)*.45; const horizon=h*.49+focal*Math.tan(s.pitch)+b,si=Math.sin(s.yaw),co=Math.cos(s.yaw);
 return {w,h,yaw:s.yaw,horizon,focal,project(X,Y,Z){const x=X-s.x,z=Z-s.z,depth=z*co+x*si;if(depth<.22)return null;const k=focal/depth;return{x:w*.5+(x*co-z*si)*k,y:horizon-(Y-1.55)*k,depth,k}}};}
