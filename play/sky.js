/* Northbound Afterglow — original dusk painting and world-space exhaust.
 * The painterly plates are generated locally by skyart/author_sky.py.
 * All projection is in logical pixels; the caller owns DPR and the frame clear.
 * Replay is analytical: exhaust is reconstructed from rocketAt(emissionTime),
 * never accumulated in screen space, and never influenced by the audio clock.
 */
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x-a)/(b-a), 0, 1); return t*t*(3-2*t); };
const lerp = (a, b, t) => a+(b-a)*t;
const hash = n => { const x = Math.sin(n*127.1+311.7)*43758.5453; return x-Math.floor(x); };
const PAINT = { az0: -1.35, az1: 2.25, top: 1, bottom: -.035, strip: 16 };
const matte = new Image(), pigment = new Image();
matte.src = new URL('./skyart/dusk-matte.png', import.meta.url).href;
pigment.src = new URL('./skyart/smoke-pigment.png', import.meta.url).href;
// The title is a single held frame. Finish decoding before main.js paints it,
// rather than relying on an animation loop to replace an unfinished backdrop.
await Promise.all([matte.decode().catch(() => {}), pigment.decode().catch(() => {})]);
let backdrop = null, backdropKey = null, litPigment = null;

function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c;
}
function radial(c, x, y, r, stops) {
  const g = c.createRadialGradient(x,y,0,x,y,r);
  for (const [p, color] of stops) g.addColorStop(p,color);
  c.fillStyle = g; c.fillRect(x-r,y-r,r*2,r*2);
}
function anglePoint(P, azimuth, elevation) {
  const a = azimuth-(P.yaw || 0), co = Math.cos(a);
  if (co <= .08) return null;
  return { x:P.w*.5+P.focal*Math.tan(a), y:P.horizon-P.focal*elevation/co };
}
function skyPlate(P) {
  // Camera bob is a translated cached sheet, not a re-bake on every road bump.
  // A heading change reprojects at 16-pixel strips: no horizontal sliding clouds.
  const key = [P.w,P.h,P.focal,P.yaw || 0,Math.round(P.horizon/4)*4];
  if (backdrop && backdropKey && key.every((v,i)=>Math.abs(v-backdropKey[i]) < (i===3 ? .00012 : .01))) return backdrop;
  // A viewport-sized backing store, not an enormous offscreen sky dome.
  // Only four spare pixels are needed because cached horizon bins are 4px.
  const scale=Math.min(1,1600/P.w), margin=4;
  const cw=Math.ceil(P.w*scale),ch=Math.ceil((P.h+margin*2)*scale);
  const c = backdrop && backdrop.width===cw && backdrop.height===ch ? backdrop : canvas(cw,ch);
  const g = c.getContext('2d'); g.setTransform(scale,0,0,scale,0,0);
  const hy = key[4]+margin;
  const wash = g.createLinearGradient(0,hy-P.focal*.75,0,hy+3);
  wash.addColorStop(0,'#263a64'); wash.addColorStop(.48,'#6a7097');
  wash.addColorStop(.8,'#c395a7'); wash.addColorStop(1,'#edaa86');
  g.fillStyle=wash; g.fillRect(0,0,P.w,P.h+margin*2);
  if (matte.complete && matte.naturalWidth) {
    for (let x=0;x<P.w;x+=PAINT.strip) {
      const width=Math.min(PAINT.strip,P.w-x);
      const aa=Math.atan((x-P.w*.5)/P.focal), ab=Math.atan((x+width-P.w*.5)/P.focal);
      const sa=clamp((aa+(P.yaw||0)-PAINT.az0)/(PAINT.az1-PAINT.az0),0,1)*matte.width;
      const sb=clamp((ab+(P.yaw||0)-PAINT.az0)/(PAINT.az1-PAINT.az0),0,1)*matte.width;
      const f=P.focal/Math.cos((aa+ab)*.5);
      if (sb>sa) {
        const top=hy-f*PAINT.top;
        // Portrait lenses may see above the authored sheet. Continue its
        // actual zenith pigment, rather than exposing a mismatched fallback.
        if(top>0)g.drawImage(matte,sa,0,sb-sa,1,x,0,width+.35,top+1);
        g.drawImage(matte,sa,0,sb-sa,matte.height,x,top,width+.35,f*(PAINT.top-PAINT.bottom));
      }
    }
  }
  // Very few stars survive civil twilight; no stars in the peach horizon.
  for (let i=0;i<80;i++) {
    const az=lerp(-1.3,2.2,hash(i+61));
    const el=lerp(.46,1.75,hash(i+720));
    const p=anglePoint({...P,horizon:hy},az,el);
    if (!p || p.x<0 || p.x>P.w || p.y<0 || p.y>c.height/scale) continue;
    const r=.35+hash(i+170)*.45;
    g.globalAlpha=(.15+hash(i+109)*.27)*smooth(.45,.83,el);
    g.fillStyle='#f2e4e1'; g.beginPath(); g.arc(p.x,p.y,r,0,TAU); g.fill();
  }
  // One brighter evening star, not a starfield; fixed to the world sphere.
  const star=anglePoint({...P,horizon:hy},.21,.545);
  if (star) { g.globalAlpha=.45; radial(g,star.x,star.y,3,[[0,'#f1e2d7'],[.22,'#e2d6d2bb'],[1,'#d3cada00']]); }
  g.globalAlpha=1;
  backdrop=c; backdropKey=key;
  backdrop._horizon=hy; backdrop._scale=scale;
  return c;
}

function shore(c,P,s,pad) {
  const {w,h,horizon:hy}=P;
  // A subdued underpainting. The road/water renderer owns the foreground.
  const base=c.createLinearGradient(0,hy,0,h);
  base.addColorStop(0,'#6d6b7e'); base.addColorStop(.12,'#485563'); base.addColorStop(1,'#263b43');
  c.fillStyle=base; c.fillRect(0,hy,w,Math.max(0,h-hy));
  // Flat coast, not mountains: the far pine canopy is only 1–6 logical pixels.
  for (let layer=0;layer<2;layer++) {
    c.beginPath(); c.moveTo(-4,hy+5);
    for (let x=-4;x<=w+8;x+=4) {
      const a=Math.atan((x-w*.5)/P.focal)+(P.yaw||0);
      const n=Math.sin(a*431+layer*8)*.16+Math.sin(a*129)*.29+Math.sin(a*37)*.35;
      const hill=.0018+(layer? .0014:.0025)*(n+.86);
      c.lineTo(x,hy-P.focal*hill/Math.cos(a-(P.yaw||0))+(layer?1.5:0));
    }
    c.lineTo(w+8,hy+5); c.closePath();
    c.fillStyle=layer?'#4c5664':'#8b7d8c'; c.fill();
  }
  if (!pad) return;
  // An invented distant gantry and service building, deliberately not a logo
  // or an identifiable real launch complex. Its scale is world-space metres.
  const launch=s.rocketAt(0);
  const top=P.project(launch.x-58,78,launch.z+30);
  const foot=P.project(launch.x-58,0,launch.z+30);
  const roof=P.project(launch.x+95,16,launch.z+70);
  if (top && foot) {
    const rw=clamp(top.k*9,.7,2.6), tw=clamp(top.k*25,2.5,7);
    c.strokeStyle='#7c727e'; c.lineWidth=rw;
    c.beginPath(); c.moveTo(top.x,foot.y); c.lineTo(top.x,top.y); c.lineTo(top.x+tw*.55,top.y);
    c.moveTo(top.x+tw,foot.y); c.lineTo(top.x+tw,top.y+rw); c.stroke();
    c.globalAlpha=.7; c.lineWidth=.6;
    for(let j=1;j<4;j++) { const y=lerp(top.y,foot.y,j/4); c.beginPath(); c.moveTo(top.x,y-2); c.lineTo(top.x+tw,y+2); c.stroke(); }
    c.globalAlpha=1;
  }
  if (roof) { c.fillStyle='#706e7b'; c.fillRect(roof.x,roof.y,Math.max(3,roof.k*72),Math.max(1,roof.k*16)); }
  // Minute shore lamps, not glowing beads along a repeated dotted coast.
  for (const [dx,dz] of [[-160,150],[115,80],[480,200]]) {
    const p=P.project(launch.x+dx,5,launch.z+dz);
    if(p && p.x>=0 && p.x<=w) {c.fillStyle='#e4b48ab0'; c.fillRect(p.x,p.y,1.2,.8);}
  }
}

function lightPigment() {
  if (litPigment || !pigment.naturalWidth) return litPigment;
  litPigment=canvas(pigment.width,pigment.height);
  const c=litPigment.getContext('2d'); c.drawImage(pigment,0,0);
  c.globalCompositeOperation='source-atop'; c.fillStyle='rgba(255,219,186,.39)'; c.fillRect(0,0,litPigment.width,litPigment.height);
  return litPigment;
}
function stamp(c,img,index,x,y,rx,ry,angle,alpha) {
  if(!img || rx<.25 || ry<.25 || alpha<.001) return;
  c.save(); c.globalAlpha=alpha; c.translate(x,y); c.rotate(angle);
  const cell=160, col=index%4, row=Math.floor(index/4)%3;
  c.drawImage(img,col*cell,row*cell,cell,cell,-rx,-ry,rx*2,ry*2); c.restore();
}

function smokeNodes(P,s,t) {
  const nodes=[], step=.36;
  const total=Math.ceil(t/step);
  // Regular emission IDs keep every eddy's identity during the whole flight.
  // Only the final incomplete segment moves; there is no reseeding per frame.
  for(let i=0;i<=total;i++) {
    const emitted=Math.min(t,i*step), age=Math.max(0,t-emitted), p=s.rocketAt(emitted);
    const freedom=smooth(4,145,p.y);
    const shear=Math.sin(p.y*.0058+.35)*.80+Math.sin(p.y*.0018-1.2)*.55;
    const spread=Math.pow(age,.92);
    const wind=(2.5+Math.min(8,p.y*.0036))*age;
    const billow=Math.sin(emitted*1.7+age*.045)*Math.pow(age,.72)*1.25;
    const x=p.x+freedom*(wind+shear*spread*5.8+billow);
    const z=p.z+freedom*(age*1.5+Math.sin(p.y*.004)*spread*3.0);
    const y=p.y+Math.pow(age,.87)*2.0*(.55+.45*freedom);
    const q=P.project(x,y,z);
    if(!q || !Number.isFinite(q.x+q.y)) continue;
    const k=q.k || P.focal/q.depth;
    const radius=(5.8+Math.pow(age,.82)*4.8)*(1+Math.sin(emitted*1.11)*.12);
    const r=clamp(radius*k,.8,P.w*.05);
    nodes.push({x:q.x,y:q.y,r,age,emitted,id:i,alt:p.y,alpha:clamp(.70-age*.0042,.24,.70)});
  }
  return nodes;
}
function ribbon(c,nodes,factor,fill,offset=0) {
  if(nodes.length<2) return;
  c.beginPath();
  for(let side=1;side>=-1;side-=2) {
    for(let j=0;j<nodes.length;j++) {
      const i=side===1?j:nodes.length-1-j, p=nodes[i];
      const a=nodes[Math.max(0,i-1)], b=nodes[Math.min(nodes.length-1,i+1)];
      const length=Math.hypot(b.x-a.x,b.y-a.y)||1;
      const nx=-(b.y-a.y)/length, ny=(b.x-a.x)/length;
      const width=p.r*factor*(1+Math.sin(p.emitted*.79)*.10);
      const x=p.x+nx*(width*side+p.r*offset), y=p.y+ny*(width*side+p.r*offset);
      if(j===0 && side===1)c.moveTo(x,y); else c.lineTo(x,y);
    }
  }
  c.closePath(); c.fillStyle=fill; c.fill();
}
function trail(c,P,s,t) {
  if(t<=.02) return;
  const nodes=smokeNodes(P,s,t);
  if(nodes.length<2) return;
  const first=nodes[0], last=nodes[nodes.length-1];
  // The connected body is essential: atlas tufts shade a continuous plume,
  // not a chain of individual round particles. Detail overlaps well inside it.
  const light=c.createLinearGradient(first.x,first.y,last.x,last.y-1);
  light.addColorStop(0,'rgba(164,131,147,.22)');
  light.addColorStop(.5,'rgba(205,174,180,.31)');
  light.addColorStop(1,'rgba(255,214,172,.66)');
  ribbon(c,nodes,1.12,'rgba(180,150,169,.075)');
  ribbon(c,nodes,.73,light);
  const lit=lightPigment() || pigment;
  let prev=null;
  for(let i=0;i<nodes.length;i++) {
    const p=nodes[i];
    if(p.x < -p.r*3 || p.x>P.w+p.r*3 || p.y < -p.r*3 || p.y>P.horizon+p.r*2) {prev=p;continue;}
    const before=nodes[Math.max(0,i-1)], after=nodes[Math.min(nodes.length-1,i+1)];
    const angle=Math.atan2(after.y-before.y,after.x-before.x)+Math.PI*.5;
    // Early samples are nearly on top of one another at the launch pad.
    // Spatial thinning avoids a solid opaque knot without deleting history.
    if(prev && Math.hypot(p.x-prev.x,p.y-prev.y)<Math.max(1.1,p.r*.37) && i<nodes.length-1)continue;
    const variant=(p.id*7+3)%12;
    const warm=smooth(90,1200,p.alt);
    const image=warm>.15 ? lit : pigment;
    const rx=p.r*(1.05+.10*Math.sin(p.emitted*2.1));
    const ry=p.r*(1.35+.12*Math.sin(p.emitted*1.6));
    if(pigment.naturalWidth) stamp(c,image,variant,p.x,p.y,rx,ry,angle,p.alpha*.72);
    prev=p;
  }
  // A handful of old shear eddies roll away from the body and fold back.
  // Dense, low-opacity pigment keeps these wisps connected rather than beads.
  if(pigment.naturalWidth)for(let i=8;i<nodes.length-2;i+=16) {
    const p=nodes[i], growth=smooth(8,35,p.age);
    if(growth<.04 || p.y<0 || p.y>P.horizon+8 || p.x<0 || p.x>P.w)continue;
    const next=nodes[i+1],prev=nodes[i-1],heading=Math.atan2(next.y-prev.y,next.x-prev.x);
    const side=(i/8)%4===1?1:-1, r=p.r*growth*.75;
    for(let j=0;j<11;j++) {
      const v=j/10, a=heading+side*(v*4.7-1.3);
      const curl=r*(.45+.55*Math.sin(v*Math.PI));
      const x=p.x+Math.cos(a)*curl-Math.sin(heading)*r*side*.7;
      const y=p.y+Math.sin(a)*curl+Math.cos(heading)*r*side*.7;
      stamp(c,lit,(i+j*3)%12,x,y,p.r*.38,p.r*.32,a,.07*growth*(1-v*.5));
    }
  }
  // Torn sunward filaments follow the same advected backbone. Their edges
  // remain soft because this is translucent pigment, not a white vector line.
  ribbon(c,nodes,.13,'rgba(255,208,176,.09)',-.53);
}

function padCloud(c,P,s,t,pad) {
  if(t<0 || !pad) return;
  const p=s.rocketAt(0), lit=lightPigment() || pigment;
  const strength=smooth(0,2.1,t);
  const linger=Math.exp(-Math.max(0,t-40)/75);
  if(pigment.naturalWidth) for(let i=0;i<19;i++) {
    const side=i%2?-1:1, distance=(12+hash(i+14)*90)*Math.min(1,t/7);
    const age=Math.max(0,t-i*.13);
    const worldX=p.x+side*distance*(1+age*.009)+age*1.1;
    const worldZ=p.z+Math.sin(i*2.4)*48;
    const worldY=7+(12+hash(i+17)*40)*smooth(0,8,t);
    const q=P.project(worldX,worldY,worldZ); if(!q)continue;
    const r=(22+hash(i+89)*35+Math.sqrt(age)*2.3)*(q.k||P.focal/q.depth);
    stamp(c,t<13?lit:pigment,(i*5)%12,q.x,q.y,r*1.38,r*.66,Math.sin(i)*.28,.28*strength*linger);
  }
  // Light rises at ignition, then loses its grip on the ground as the source climbs.
  const launchPulse=smooth(0,.8,t)*Math.exp(-t*.15);
  if(launchPulse>.003) {
    c.save(); c.globalCompositeOperation='screen';
    const radius=clamp((pad.k||.15)*360,22,80);
    c.globalAlpha=launchPulse;
    radial(c,pad.x,pad.y-3,radius,[[0,'#ffc36b70'],[.18,'#f8955140'],[.55,'#d9783e12'],[1,'#be674800']]);
    c.restore();
  }
}

function rocket(c,P,s,t) {
  if(t<0)return;
  const pos=s.rocketAt(t), p=P.project(pos.x,pos.y,pos.z);
  if(!p || p.x < -80 || p.x>P.w+80 || p.y < -80 || p.y>P.h+80)return;
  const old=s.rocketAt(Math.max(0,t-.18)), q=P.project(old.x,old.y,old.z);
  let vx=q?p.x-q.x:0, vy=q?p.y-q.y:-1;
  if(Math.hypot(vx,vy)<.01){vx=0;vy=-1;}
  const a=Math.atan2(vy,vx)+Math.PI*.5;
  const k=p.k || P.focal/p.depth;
  const ignition=smooth(0,.48,t), pulse=s.reduced?1:1+.045*Math.sin(t*13)+.023*Math.sin(t*29.1);
  const size=clamp(k*17,1.4,3.6)*pulse, length=clamp(k*105,9,23)*pulse;
  c.save(); c.globalCompositeOperation='screen'; c.globalAlpha=ignition;
  const glow=clamp(k*225,20,47)*pulse;
  radial(c,p.x,p.y+size,glow,[[0,'#fff3cd90'],[.10,'#ffd08070'],[.28,'#ffad4c28'],[.62,'#ed885b0c'],[1,'#dc784d00']]);
  c.restore();
  c.save(); c.translate(p.x,p.y); c.rotate(a); c.globalAlpha=ignition;
  // Tiny hull, white throat, ragged fluid flame — no triangular rocket icon.
  const flame=c.createLinearGradient(0,-size,0,length);
  flame.addColorStop(0,'#fffbe9'); flame.addColorStop(.16,'#fff3be');
  flame.addColorStop(.46,'#ffc574'); flame.addColorStop(.77,'#ee9251b0'); flame.addColorStop(1,'#df7c4b00');
  c.fillStyle=flame; c.beginPath(); c.moveTo(-size*.52,-size*.15);
  c.bezierCurveTo(-size*1.12,length*.24,-size*.58,length*.52,-size*.27,length*.73);
  c.bezierCurveTo(size*.30,length*.53,-size*.06,length*.88,size*.15,length);
  c.bezierCurveTo(size*.42,length*.57,size*.94,length*.21,size*.45,-size*.15); c.closePath(); c.fill();
  c.fillStyle='#fffbe9'; c.beginPath(); c.ellipse(0,size*.10,size*.43,size*.95,0,0,TAU); c.fill();
  c.globalAlpha=.75; c.fillStyle='#d8d8d7';
  c.beginPath();c.ellipse(0,-size*1.2,size*.24,size*.85,0,0,TAU);c.fill();
  c.restore();
}

export function drawSky(ctx,P,s) {
  if(!P || P.w<=0 || P.h<=0)return;
  ctx.save();
  ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
  const plate=skyPlate(P);
  const skyHeight=Math.min(P.h,Math.max(0,P.horizon+1));
  if(skyHeight>0)ctx.drawImage(plate,0,(plate._horizon-P.horizon)*plate._scale,plate.width,skyHeight*plate._scale,0,0,P.w,skyHeight);
  // A slow cooling of the evening, separate from fast flame exposure. A wash
  // this restrained preserves the painted cloud contrast and peach horizon.
  const night=clamp(((s.time||0)-30)/160,0,.28);
  if(night>0) {ctx.fillStyle=`rgba(21,35,70,${night*.30})`;ctx.fillRect(0,0,P.w,P.horizon);}
  const source=typeof s.rocketAt==='function'?s.rocketAt(0):null;
  const pad=source?P.project(source.x,source.y,source.z):null;
  shore(ctx,P,s,pad);
  if(source) {
    const t=Number.isFinite(s.t)?s.t:(s.time||0)-(s.ignition||8);
    // A visit can last indefinitely. End the visual event without an ever-growing trail.
    if(t<143){const fade=1-smooth(100,143,t);if(fade>.001){
      if(fade<1){ctx.save();ctx.filter=`opacity(${fade})`}
      padCloud(ctx,P,s,t,pad);trail(ctx,P,s,t);rocket(ctx,P,s,t);if(fade<1)ctx.restore();
    }}
  }
  ctx.restore();
}
