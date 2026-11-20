/* Northbound Afterglow — mapped US 1 / public riverfront scenery.
 * route.js owns the cartographic alignment, stationing and named junctions.
 * Here x means lateral metres (0 = right NB lane centre), z means station;
 * ONLY the projection boundary converts these to absolute east/north metres.
 * Lane widths, vegetation and shoreline are aerial interpretations.
 * Park pavement is shared with the traversal model in riverfront.js.
 * No invented businesses, cross streets, causeway, sky or plume overlay.
 */
import {routeAt, ROUTE_LENGTH} from './route.js';
import {westAt,section,streets as CROSSINGS,lots,layers,frontage,signal} from './us1.js';

import {bankAt as shore,PARKS,PIER,PIER_HEIGHT,parkPavementAt} from './riverfront.js';

const C = {
  asphalt: '#3b414b', asphaltFar: '#746c76', tire: '#303741',
  shell: '#a49286', curb: '#c1aaa0', walk: '#897f79',
  grass: '#414f49', grassLight: '#626950', ground: '#4a5350',
  white: '#d1c5ad', yellow: '#d1a15b', river: '#8b8b9b',
  dark: '#243637', foliage: '#314a41', lightLeaf: '#64735a',
  warmLeaf: '#928264', fog: '#a79296'
};
const ROAD = {left:-16.45, right:2.25, near:.35, far:1500};
const TAU = Math.PI * 2;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const mod = (a,b) => ((a%b)+b)%b;
function rng(seed) { let a=seed|0; return () => { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function hash(n) { let a=Math.imul(n^0x6ac690c5,0x45d9f3b); a=Math.imul(a^(a>>>16),0x45d9f3b); return ((a^(a>>>16))>>>0)/4294967296; }
function canvas(w,h) { const a=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h}); return [a,a.getContext('2d')]; }
function polygon(g,p,col) { if(p.length<3)return; g.fillStyle=col; g.beginPath();g.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)g.lineTo(p[i][0],p[i][1]);g.closePath();g.fill(); }
function line(g,p,col,width=1) { g.strokeStyle=col;g.lineWidth=width;g.beginPath();g.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)g.lineTo(p[i][0],p[i][1]);g.stroke(); }
function ellipse(g,x,y,rx,ry,c,rot=0) {g.fillStyle=c;g.beginPath();g.ellipse(x,y,Math.max(.05,rx),Math.max(.05,ry),rot,0,TAU);g.fill();}
function label(g,text,x,y,size,col,font='sans-serif',align='center') {g.font=`${size}px ${font}`;g.textAlign=align;g.fillStyle=col;g.fillText(text,x,y);}
function tooth(g,w,h,r,amount=850,alpha=.07) {g.save();g.globalAlpha=alpha;for(let i=0;i<amount;i++){const x=r()*w,y=r()*h;g.fillStyle=r()>.5?'#f8d2a0':'#142f38';g.fillRect(x,y,1+r()*9,.5+r()*2);}g.restore();}

function cachedMips(image) {
  const levels=[image];let prev=image;
  while(prev.width>48&&prev.height>48){const [next,g]=canvas(Math.ceil(prev.width/2),Math.ceil(prev.height/2));g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(prev,0,0,next.width,next.height);levels.push(next);prev=next;}
  image.mips=levels;return image;
}
function mip(image,w,h){const levels=image.mips;if(!levels)return image;let best=image;for(let i=1;i<levels.length;i++){if(levels[i].width<w*.85||levels[i].height<h*.85)break;best=levels[i];}return best;}

let ART=null;
function makePalm(seed) {
  const [a,g]=canvas(440,650),r=rng(seed);const bx=216,by=638,tx=206+(r()-.5)*70,ty=146+r()*40;
  const lean=(bx+tx)*.5-22;
  g.lineCap='round';g.strokeStyle='#303d39';g.lineWidth=19;g.beginPath();g.moveTo(bx,by);g.quadraticCurveTo(lean,by*.62,tx,ty);g.stroke();
  g.strokeStyle='#7f7562';g.lineWidth=9;g.beginPath();g.moveTo(bx-4,by);g.quadraticCurveTo(lean-5,by*.62,tx-3,ty);g.stroke();
  for(let i=0;i<32;i++){const t=i/32,y=by+(ty-by)*t,x=(1-t)*(1-t)*bx+2*t*(1-t)*lean+t*t*tx;line(g,[[x-8,y],[x+6,y-4]],i%3?'#3c4840':'#b09771',1.8);}
  // Retained boots and a rough crown, then individual arching fronds.
  for(let i=0;i<19;i++){const ang=r()*TAU,rr=10+r()*19;polygon(g,[[tx,ty-2],[tx+Math.cos(ang)*rr,ty+Math.sin(ang)*rr+29],[tx+Math.cos(ang+.3)*rr,ty+4]],'#514e3b');}
  for(let k=0;k<14;k++){
    const ang=-Math.PI+.20+k/13*(Math.PI*1.83),len=100+r()*95;
    const ex=tx+Math.cos(ang)*len,ey=ty+Math.sin(ang)*len*.64+30;
    const cx=tx+(ex-tx)*.59,cy=ty+(ey-ty)*.56-43-r()*20;
    g.strokeStyle=k%4===0?'#8e8c67':'#5c6d50';g.lineWidth=3;g.beginPath();g.moveTo(tx,ty);g.quadraticCurveTo(cx,cy,ex,ey);g.stroke();
    for(let j=1;j<15;j++){
      const t=j/15,px=(1-t)*(1-t)*tx+2*t*(1-t)*cx+t*t*ex,py=(1-t)*(1-t)*ty+2*t*(1-t)*cy+t*t*ey;
      const dx=2*(1-t)*(cx-tx)+2*t*(ex-cx),dy=2*(1-t)*(cy-ty)+2*t*(ey-cy),ll=Math.hypot(dx,dy);const q=(Math.sin(t*Math.PI)*21+5)*(1+r()*.4);
      for(const side of [-1,1]){
        const lx=px-dy/ll*q*side+dx/ll*12,ly=py+dx/ll*q*side+dy/ll*12+8;
        polygon(g,[[px-dx/ll*4,py-dy/ll*4],[lx,ly],[px+dx/ll*12,py+dy/ll*12]],['#263e37','#3d5741','#60714e','#81906a'][(k+j+Number(side>0))%4]);
      }
    }
  }
  // Sabal fans give the native palm its folded, sculptural silhouette.
  for(let j=0;j<7;j++){
    const ang=-Math.PI+j*.47,dist=48+r()*35,x=tx+Math.cos(ang)*dist,y=ty+Math.sin(ang)*dist*.8;
    for(let k=0;k<9;k++){const q=ang-.82+k*.205,len=35+r()*18;polygon(g,[[x,y],[x+Math.cos(q)*len,y+Math.sin(q)*len],[x+Math.cos(q+.11)*(len-4),y+Math.sin(q+.11)*(len-4)]],['#354d3c','#57704b','#78805c'][k%3]);}
  }
  return {image:a,w:8.1,h:12.0,anchor:.49};
}
function makeTree(kind,seed) {
  const oak=kind==='oak',[a,g]=canvas(oak?700:510,760),r=rng(seed);
  const root=oak?350:255,top=oak?205:93;g.lineCap='round';
  const trunk=[root,748,root-9,top];
  g.strokeStyle='#303a38';g.lineWidth=oak?28:15;g.beginPath();g.moveTo(root,748);g.bezierCurveTo(root-10,560,root+20,360,root-8,top);g.stroke();
  g.strokeStyle='#8b7966';g.lineWidth=oak?6:4;g.beginPath();g.moveTo(root-9,742);g.bezierCurveTo(root-14,540,root+9,350,root-12,top);g.stroke();
  const crowns=[];
  if(oak){
    for(let b=0;b<12;b++){
      const side=b%2?1:-1,len=95+r()*205,x=root+side*len,y=270+r()*220;
      const sy=615-r()*135,rx=root+(r()-.5)*28;
      g.strokeStyle=b%3?'#34413a':'#656b55';g.lineWidth=8+r()*13;g.beginPath();g.moveTo(rx,sy);g.bezierCurveTo(root+side*len*.22,sy-15-r()*45,x-side*len*.31,y+80,x,y);g.stroke();
      g.strokeStyle='#8c8870';g.lineWidth=1.7;g.beginPath();g.moveTo(rx-4,sy-3);g.bezierCurveTo(root+side*len*.22-4,sy-40,x-side*len*.31-4,y+76,x-3,y-1);g.stroke();
      crowns.push([x,y,65+r()*48,43+r()*33]);
    }
    crowns.push([340,238,138,75],[235,318,133,74],[461,335,126,77]);
  }else{
    for(let b=0;b<13;b++){
      const y=top+65+b*29,side=b%2?1:-1,len=(58+Math.sin(b/13*Math.PI)*125)*(0.7+r()*.35);
      line(g,[[root-6,y+67],[root+side*len*.55,y+8],[root+side*len,y]],'#435043',4.5);
      crowns.push([root+side*len*.68,y,45+r()*43,17+r()*13]);
    }
    crowns.push([root-7,top,77,38],[root-20,top+45,109,26]);
  }
  // Large joined masses first: textured brush edges, not floating circles.
  for(let n=0;n<crowns.length;n++){
    const [x,y,rx,ry]=crowns[n];const outline=[];
    for(let i=0;i<30;i++){const ang=i/30*TAU,rr=.84+r()*.22;outline.push([x+Math.cos(ang)*rx*rr,y+Math.sin(ang)*ry*rr]);}
    polygon(g,outline,n%3?'#2c433a':'#314b40');
    for(let i=0;i<(oak?82:50);i++){
      const ang=r()*TAU,dist=Math.sqrt(r()),xx=x+Math.cos(ang)*rx*dist,yy=y+Math.sin(ang)*ry*dist;
      const lit=(xx-x)/rx*.4+(yy-y)/ry;const col=lit<-.38?['#586a50','#657257','#7c7e5b'][i%3]:['#3b5542','#2d463b','#496047'][i%3];
      const w=4+r()*(oak?18:15),h=2+r()*5;polygon(g,[[xx-w,yy],[xx-w*.2,yy-h],[xx+w,yy-h*.6],[xx+w*.7,yy+h],[xx-w*.5,yy+h*.6]],col);
    }
    if(oak && n%2===0){
      g.strokeStyle='#738071';g.lineWidth=.85;g.globalAlpha=.53;
      for(let i=0;i<8;i++){const mx=x+(r()-.5)*rx,my=y+ry*.6;g.beginPath();g.moveTo(mx,my);g.quadraticCurveTo(mx-5,my+17,mx-2,my+27+r()*37);g.stroke();}g.globalAlpha=1;
    }
  }
  return {image:a,w:oak?21:11.2,h:oak?15:20.5,anchor:.5};
}
function makeScrub(seed) {
  const [a,g]=canvas(320,130),r=rng(seed);
  for(let i=0;i<65;i++){const x=25+r()*270,y=93+r()*28,len=22+r()*74,ang=-2.9+r()*2.6;polygon(g,[[x-3,y],[x+Math.cos(ang)*len,y+Math.sin(ang)*len],[x+4,y]],['#35483c','#4d6146','#7c7e54','#536b4d'][i%4]);}
  return {image:a,w:5.5,h:2.1,anchor:.5};
}
function makeAsphalt(seed) {
  const [a,g]=canvas(384,768),r=rng(seed);g.fillStyle=C.asphalt;g.fillRect(0,0,384,768);
  const d=g.getImageData(0,0,384,768);for(let i=0;i<d.data.length;i+=4){const v=(r()-.5)*17;d.data[i]=60+v;d.data[i+1]=65+v;d.data[i+2]=75+v;d.data[i+3]=255;}g.putImageData(d,0,0);
  for(let i=0;i<390;i++){const x=r()*384,y=r()*768,w=3+r()*38;g.fillStyle=i%2?'rgba(182,169,158,.035)':'rgba(10,22,33,.06)';g.fillRect(x,y,w,1+r()*10);}
  // Broad wheel polish, never bright speckle, and a quiet resurfacing seam.
  for(const x of [21,53,94,126,166,198,239,271,312,344]){const q=g.createLinearGradient(x-9,0,x+9,0);q.addColorStop(0,'#333d4500');q.addColorStop(.5,'#202c3933');q.addColorStop(1,'#333d4500');g.fillStyle=q;g.fillRect(x-9,0,18,768);}
  return a;
}
// Street widths and grades come from the aerial interpretation.
const parkNear=(z,pad=32)=>PARKS.some(p=>Math.abs(z-p.station)<pad);
const crossingAt=(z,side,pad=0)=>CROSSINGS.find(j=>Math.abs(z-j.station)<j.halfWidth+pad&&(!side||j.side===side||j.side==='both'));
function roadsideClear(x,z,pad=0){
  if(x>ROAD.right&&parkNear(z,36+pad))return true;
  return !!crossingAt(z,x>0?'east':'west',7+pad);
}
function openness(z){return .5+.5*Math.sin(z*.0062-.7);}
const withinLot=(x,z,pad)=>lots.some(([a,b,w,d])=>x>=a-pad&&x<=a+w+pad&&z>=b-pad&&z<=b+d+pad);
const TREES=[];
{
  const r=rng(28931);
  for(let z=-120;z<ROUTE_LENGTH+160;z+=17+r()*16){
    for(const west of [true,false]){
      if(!west&&(parkNear(z,58)||openness(z)>.66))continue;
      const x=west?-25-r()*32:9+r()*15;
      // Clear the complete canopy, not just the trunk, from access mouths.
      if(roadsideClear(x,z,14)||withinLot(x,z,10)||x>shore(z)-5||west&&x>westAt(z)-8)continue;
      const type=west?(r()<.53?'pine':r()<.6?'oak':'palm'):(r()<.8?'palm':'oak');
      TREES.push({type,x,z,variant:Math.floor(r()*3),scale:.7+r()*.40});
      if(west&&r()<.72)TREES.push({type:'pine',x:-58-r()*35,z:z+4,variant:Math.floor(r()*3),scale:.83+r()*.3});
      if(r()<.55)TREES.push({type:'scrub',x:west?-20-r()*8:8+r()*7,z:z-3,variant:Math.floor(r()*3),scale:.8+r()*.6});
    }
  }
}
const SIGNS=PARKS.map((p,i)=>({x:p.sign[0],z:p.sign[1],type:`park${i}`,h:2.9,w:4.8,park:p}));
for(const z of [72,ROUTE_LENGTH*.42,ROUTE_LENGTH*.78]){
  if(!roadsideClear(4.9,z,2))SIGNS.push({x:4.9,z,type:'route',h:4.2,w:1.35});
}
for(const [i,j] of CROSSINGS.entries()){
  for(const side of ['west','east']){
    if(j.side!==side&&j.side!=='both')continue;
    const x=side==='west'?westAt(j.station)-3.5:parkNear(j.station-j.halfWidth-2.2,36)?24:5.8;
    // On the named road's actual side; never invent a matching opposite arm.
    SIGNS.push({x,z:j.station-j.halfWidth-2.2,type:`street${i}`,h:3.25,w:clamp(j.name.length*.16+1,2.7,5.2),junction:j,side});
  }
}
function makeSign(kind,record){
  if(kind==='route'){
    const [a,g]=canvas(300,420);
    g.fillStyle='#53665d';g.fillRect(45,6,210,74);g.strokeStyle='#d4cbb2';g.lineWidth=3;g.strokeRect(50,11,200,64);label(g,'NORTH',150,57,33,'#e7dbc2');
    g.beginPath();g.moveTo(42,98);g.quadraticCurveTo(150,123,258,98);g.lineTo(250,176);g.quadraticCurveTo(262,275,150,330);g.quadraticCurveTo(38,275,50,176);g.closePath();g.fillStyle='#dfd4b7';g.fill();g.strokeStyle='#364944';g.lineWidth=6;g.stroke();
    label(g,'U S',150,169,30,'#344242');label(g,'1',150,282,112,'#344242','Georgia');return a;
  }
  if(kind==='street'){
    const [a,g]=canvas(720,126);g.fillStyle='#315951';g.fillRect(4,4,712,118);g.strokeStyle='#c0c9ae';g.lineWidth=4;g.strokeRect(10,10,700,106);
    const text=record.name;g.font='46px sans-serif';const size=Math.min(46,46*650/Math.max(1,g.measureText(text).width));label(g,text,360,82,size,'#e7dfc7');return a;
  }
  const [a,g]=canvas(720,360);g.fillStyle='#3d594c';g.fillRect(5,5,710,350);g.strokeStyle='#c1b38f';g.lineWidth=5;g.strokeRect(14,14,692,332);
  label(g,record.name.replace(/ Park$/,'').toUpperCase(),360,91,record.station===0?46:39,'#e8d6b4','Georgia');
  label(g,'P A R K',360,151,37,'#e8d6b4','Georgia');line(g,[[100,178],[620,178]],'#9caa8d',2);
  label(g,'PUBLIC RIVERFRONT',360,226,27,'#d2d1b5');label(g,'PARKING  /  RIVER VIEW',360,277,24,'#c1cbb3');
  label(g,'ACCESS LAYOUT IS ARTIST-INTERPRETED',360,321,15,'#9eb29d');return a;
}
function prepareArt(){
  if(ART)return ART;const start=typeof performance!=='undefined'?performance.now():0;
  const palms=[],pines=[],oaks=[],scrubs=[];
  for(let i=0;i<3;i++){palms.push(makePalm(230+i*19));pines.push(makeTree('pine',310+i*17));oaks.push(makeTree('oak',510+i*31));scrubs.push(makeScrub(710+i*13));}
  const [glow,gg]=canvas(96,96),gr=gg.createRadialGradient(48,48,0,48,48,48);gr.addColorStop(0,'#ffdeb6aa');gr.addColorStop(.13,'#edb48055');gr.addColorStop(.45,'#edb48013');gr.addColorStop(1,'#edb48000');gg.fillStyle=gr;gg.fillRect(0,0,96,96);
  const signs={route:makeSign('route')};PARKS.forEach((p,i)=>signs[`park${i}`]=makeSign('park',p));CROSSINGS.forEach((j,i)=>signs[`street${i}`]=makeSign('street',j));
  for(const sprite of [...palms,...pines,...oaks,...scrubs])cachedMips(sprite.image);Object.values(signs).forEach(cachedMips);
  ART={palms,pines,oaks,scrubs,asphalt:cachedMips(makeAsphalt(101)),glow,signs};
  drawRoad.stats={cacheMs:typeof performance!=='undefined'?+(performance.now()-start).toFixed(2):0,cachedImages:14+Object.keys(signs).length,buildings:lots.length,junctions:CROSSINGS.length,routeLength:ROUTE_LENGTH,mapped:true,drawn:0};return ART;
}

// Transform first, then clip in WORLD space. Interpolating station/lateral at
// the clip plane is wrong at a bend, and s.x/s.z are not world coordinates.
function frame(ctx,P,s){
  const actor=routeAt(s.z,s.x),cameraX=P.worldX??actor.x,cameraZ=P.worldZ??actor.z;
  const yaw=P.yaw??s.yaw??actor.heading,cs=Math.cos(yaw),sn=Math.sin(yaw),cache=new Map();
  const point=(x,z)=>{let row=cache.get(z);if(!row){row=new Map();cache.set(z,row);}let p=row.get(x);if(!p){p=routeAt(z,x);row.set(x,p);}return p;};
  const depthWorld=(x,z)=>P.depth?P.depth(x,z):(x-cameraX)*sn+(z-cameraZ)*cs;
  const projectWorld=(x,y,z)=>{const d=depthWorld(x,z);if(d<ROAD.near-1e-7)return null;const p=P.project(x,y,z);return p?{...p,depth:d,k:p.k??P.focal/d}:null;};
  return {ctx,P,s,cameraX,cameraZ,depthWorld,projectWorld,point,
    world:(x,y,z)=>{const p=point(x,z);return[p.x,y,p.z];},
    depth:(x,z)=>{const p=point(x,z);return depthWorld(p.x,p.z);},
    project:(x,y,z)=>{const p=point(x,z);return projectWorld(p.x,y,p.z);},drawn:0};
}
function clippedWorld(F,pts){
  const out=[];for(let i=0;i<pts.length;i++){
    const a=pts[i],b=pts[(i+1)%pts.length],da=F.depthWorld(a[0],a[2])-ROAD.near,db=F.depthWorld(b[0],b[2])-ROAD.near;
    if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]);}
  }return out;
}
function faceWorld(F,pts,col){
  const clipped=clippedWorld(F,pts);if(clipped.length<3)return;
  const p=clipped.map(a=>F.projectWorld(...a));if(p.some(a=>!a))return;
  if(p.every(a=>a.x<0)||p.every(a=>a.x>F.P.w)||p.every(a=>a.y<0)||p.every(a=>a.y>F.P.h))return;
  polygon(F.ctx,p.map(a=>[a.x,a.y]),col);
  // Shared tessellation edges need a subpixel seam cover in Canvas2D;
  // otherwise the base colour leaks through as a false grid across the river.
  if(pts.every(a=>a[1]<.03)&&col!==C.white&&col!==C.yellow){F.ctx.strokeStyle=col;F.ctx.lineWidth=.65;F.ctx.stroke();}
}
function face(F,pts,col){faceWorld(F,pts.map(a=>F.world(...a)),col);}
function ground(F,x1,x2,z1,z2,col,y=0){
  // No road/verge/paint ribbon may bridge a mapped bend as one giant quad.
  for(let z=z1;z<z2-1e-7;z+=12){const end=Math.min(z+12,z2);face(F,[[x1,y,z],[x2,y,z],[x2,y,end],[x1,y,end]],col);}
}
function worldLine(F,pts,col,width=1){
  const g=F.ctx,w=pts.map(a=>F.world(...a));g.strokeStyle=col;g.lineWidth=width;g.beginPath();
  for(let i=0;i<w.length-1;i++){
    let a=w[i],b=w[i+1];const da=F.depthWorld(a[0],a[2])-ROAD.near,db=F.depthWorld(b[0],b[2])-ROAD.near;
    if(da<0&&db<0)continue;
    if((da<0)!==(db<0)){const t=da/(da-db),c=a.map((v,k)=>v+(b[k]-v)*t);if(da<0)a=c;else b=c;}
    const p=F.projectWorld(...a),q=F.projectWorld(...b);if(p&&q){g.moveTo(p.x,p.y);g.lineTo(q.x,q.y);}
  }g.stroke();
}
function textureTriangle(g,img,src,dst){
  const [a,b,c]=src,[p,q,r]=dst;const den=a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1]);if(Math.abs(den)<.01)return;
  const A=(p.x*(b[1]-c[1])+q.x*(c[1]-a[1])+r.x*(a[1]-b[1]))/den;
  const B=(p.y*(b[1]-c[1])+q.y*(c[1]-a[1])+r.y*(a[1]-b[1]))/den;
  const Cc=(p.x*(c[0]-b[0])+q.x*(a[0]-c[0])+r.x*(b[0]-a[0]))/den;
  const D=(p.y*(c[0]-b[0])+q.y*(a[0]-c[0])+r.y*(b[0]-a[0]))/den;
  const E=(p.x*(b[0]*c[1]-c[0]*b[1])+q.x*(c[0]*a[1]-a[0]*c[1])+r.x*(a[0]*b[1]-b[0]*a[1]))/den;
  const H=(p.y*(b[0]*c[1]-c[0]*b[1])+q.y*(c[0]*a[1]-a[0]*c[1])+r.y*(a[0]*b[1]-b[0]*a[1]))/den;
  g.save();g.beginPath();g.moveTo(p.x,p.y);g.lineTo(q.x,q.y);g.lineTo(r.x,r.y);g.closePath();g.clip();g.transform(A,B,Cc,D,E,H);g.drawImage(img,0,0);g.restore();
}
function texturedFace(F,pts,img,div=4,alpha=1){
  // Subdivide the aggregate patch in both axes on oblique river glances.
  const projected=pts.map(p=>F.project(...p));
  if(projected.every(Boolean)){
    const ww=Math.max(...projected.map(p=>p.x))-Math.min(...projected.map(p=>p.x)),hh=Math.max(...projected.map(p=>p.y))-Math.min(...projected.map(p=>p.y));
    if(ww<.5||hh<.5)return;img=mip(img,ww,hh);
  }
  const g=F.ctx,old=g.globalAlpha;g.globalAlpha=old*alpha;
  const at=(u,v)=>{const a=pts[0],b=pts[1],c=pts[2],d=pts[3];return[a[0]*(1-u)*(1-v)+b[0]*u*(1-v)+c[0]*u*v+d[0]*(1-u)*v,a[1]*(1-u)*(1-v)+b[1]*u*(1-v)+c[1]*u*v+d[1]*(1-u)*v,a[2]*(1-u)*(1-v)+b[2]*u*(1-v)+c[2]*u*v+d[2]*(1-u)*v];};
  for(let j=0;j<2;j++)for(let i=0;i<div;i++){
    const u=i/div,U=(i+1)/div,v=j/2,V=(j+1)/2;
    const w=[at(u,v),at(U,v),at(U,V),at(u,V)];if(w.some(p=>F.depth(p[0],p[2])<ROAD.near))continue;
    const p=w.map(a=>F.project(...a));if(p.some(a=>!a))continue;
    if(p.every(a=>a.x<0)||p.every(a=>a.x>F.P.w)||p.every(a=>a.y<0)||p.every(a=>a.y>F.P.h))continue;
    const uv=[[u*img.width,v*img.height],[U*img.width,v*img.height],[U*img.width,V*img.height],[u*img.width,V*img.height]];
    textureTriangle(g,img,[uv[0],uv[1],uv[2]],[p[0],p[1],p[2]]);textureTriangle(g,img,[uv[0],uv[2],uv[3]],[p[0],p[2],p[3]]);
  }g.globalAlpha=old;
}
// Only the distant river uses east/north axes directly. Near shore follows
// station-based samples from the aerial. No causeway is drawn.
const RIVER=(()=>{
  const points=[];for(let z=-500;z<ROUTE_LENGTH+700;z+=100)points.push(routeAt(z));
  return {east:Math.max(...points.map(p=>p.x))+140,south:Math.min(...points.map(p=>p.z))-16000,north:Math.max(...points.map(p=>p.z))+16000};
})();
function groundPass(F){
  const {ctx:g,P,s}=F,z=s.z,us=layers(F,helpers);
  // All broad fills are strictly below the parent's horizon. Sky and launch
  // retain their pixels; only real foreground silhouettes may occlude them.
  if(P.horizon>=P.h)return;
  g.save();g.beginPath();g.rect(0,Math.max(0,P.horizon),P.w,P.h-Math.max(0,P.horizon));g.clip();
  const base=g.createLinearGradient(0,P.horizon,0,P.h);base.addColorStop(0,'#77767b');base.addColorStop(.1,'#56625b');base.addColorStop(1,'#474c46');g.fillStyle=base;g.fillRect(0,P.horizon,P.w,P.h-P.horizon);
  const water=g.createLinearGradient(0,P.horizon,0,P.horizon+P.h*.36);water.addColorStop(0,'#b29aa4');water.addColorStop(.12,'#96949f');water.addColorStop(.42,'#7a8796');water.addColorStop(1,'#557582');
  faceWorld(F,[[RIVER.east,-.48,RIVER.south],[RIVER.east+22000,-.48,RIVER.south],[RIVER.east+22000,-.48,RIVER.north],[RIVER.east,-.48,RIVER.north]],water);
  const lo=Math.max(-500,Math.floor((z-ROAD.far)/12)*12),hi=Math.min(ROUTE_LENGTH+700,z+ROAD.far);
  const cuts=[lo,hi];for(let zz=lo+12;zz<hi;zz+=12)cuts.push(zz);
  // Include exact mouth edges: a tessellation cell must never bridge an opening.
  for(const p of PARKS)for(const [x,z] of p.pavement)if(x<12&&z>lo&&z<hi)cuts.push(z);
  for(const j of CROSSINGS)for(const d of [-17,-13,-10,-8,-5.8,-3.5,j.halfWidth,5.8,8,13,16])if(j.station+d>lo&&j.station+d<hi)cuts.push(j.station+d);
  cuts.sort((a,b)=>a-b);const segments=[];
  for(let i=1;i<cuts.length;i++)if(cuts[i]-cuts[i-1]>.00001){const a=cuts[i-1],b=cuts[i];segments.push({a,b,m:(a+b)/2,d:F.depth(-6,(a+b)/2)});}
  segments.sort((a,b)=>b.d-a.d);
  // Paint every water cell BEFORE any land; an east-looking camera must not
  // have a distant bank/water quad painted over its nearby parking apron.
  for(const {a,b} of segments){
    const A=F.world(shore(a),-.48,a),B=F.world(shore(b),-.48,b);
    faceWorld(F,[A,[RIVER.east,-.48,A[2]],[RIVER.east,-.48,B[2]],B],water);
  }
  // Ripples are truly east/west, not a giant curved texture tied to station.
  g.lineCap='butt';for(let i=0;i<170;i++){
    const n=Math.floor((z-600)/17)+i,zz=n*17+hash(n+7)*12;
    const q=F.point(shore(zz)+4+hash(n+21)*750,zz),len=5+hash(n+44)*65;
    const p=F.projectWorld(q.x,-.44,q.z),r=F.projectWorld(q.x+len,-.44,q.z);
    if(!p||!r||p.y<P.horizon||p.y>P.h||Math.min(p.x,r.x)>P.w||Math.max(p.x,r.x)<0)continue;
    g.globalAlpha=.13+hash(n+3)*.19;line(g,[[p.x,p.y],[r.x,r.y]],n%3?'#cbb2a6':'#506a7d',clamp(70/F.depthWorld(q.x,q.z),.55,1.7));
  }g.globalAlpha=1;
  // Low bank faces precede ALL level ground, not just their own road cell.
  // This prevents sawtooth overdraw at a grazing/east-facing park viewpoint.
  for(const {a,b} of segments){const A=shore(a),B=shore(b);face(F,[[A-.7,0,a],[A,-.48,a],[B,-.48,b],[B-.7,0,b]],'#aba08c');}
  const roadGrad=g.createLinearGradient(0,P.horizon,0,P.h);roadGrad.addColorStop(0,C.asphaltFar);roadGrad.addColorStop(.13,'#51535f');roadGrad.addColorStop(.55,C.asphalt);roadGrad.addColorStop(1,'#343c46');
  for(const {a,b,m} of segments){
    if(Math.max(F.depth(-180,a),F.depth(shore(a),a),F.depth(-180,b),F.depth(shore(b),b))<ROAD.near)continue;
    const A=shore(a),B=shore(b);
    ground(F,-180,2.65,a,b,'#45554b');
    face(F,[[ROAD.right,0,a],[A-.7,0,a],[B-.7,0,b],[ROAD.right,0,b]],'#4b5b4e');
    us.cover(a,b,roadGrad,parkPavementAt(2.55,m));
  }
  for(const park of PARKS){
    if(Math.abs(park.station-z)>750)continue;
    face(F,park.pavement.map(([x,station])=>[x,.012,station]),'#747271');
  }
  if(Math.abs(1438-z)<700){
    const [a,b,c,d]=PIER;
    const path=[[24,1436],[29,1449],[34,1467],[46,1480],[53,1492],[45,1503]];
    for(let i=1;i<path.length;i++){
      const [x1,z1]=path[i-1],[x2,z2]=path[i];
      const length=Math.hypot(x2-x1,z2-z1),dx=(z2-z1)/length,dz=-(x2-x1)/length;
      face(F,[[x1-dx,.017,z1-dz],[x1+dx,.017,z1+dz],
        [x2+dx,.017,z2+dz],[x2-dx,.017,z2-dz]],'#a99a84');
    }
    face(F,[a,b,c,d].map(([x,station])=>[x,PIER_HEIGHT,station]),'#a19484');
    for(const [p,q] of [[a,b],[d,c],[b,c]]){
      face(F,[[p[0],.22,p[1]],[q[0],.22,q[1]],
        [q[0],PIER_HEIGHT,q[1]],[p[0],PIER_HEIGHT,p[1]]],'#776b62');
      worldLine(F,[[p[0],1.38,p[1]],[q[0],1.38,q[1]]],'#b6a18a',1.25);
    }
    for(const [p,q] of [[a,b],[d,c]])for(let i=0;i<=38;i++){
      const x=p[0]+(q[0]-p[0])*i/38, station=p[1]+(q[1]-p[1])*i/38;
      worldLine(F,[[x,-.47,station],[x,1.38,station]],'#897d6d',1);
    }
  }
  us.lotGround();us.branches();
  // Median and paint follow ground aggregate, never underneath it.
  // Quiet world-locked aggregate near the eye, with the same bent alignment.
  for(let zz=Math.floor((z-125)/8)*8;zz<z+125;zz+=8){
    const d=Math.abs(F.depth(-5,zz+4));if(d>130)continue;
    texturedFace(F,[[ROAD.left,.002,zz+8],[ROAD.right,.002,zz+8],[ROAD.right,.002,zz],[ROAD.left,.002,zz]],ART.asphalt,d<35?3:1,clamp((130-d)/110,0,.43));
  }
  for(const {a,b,d} of segments)if(d>-12&&d<850)us.median(a,b);
  for(let zz=Math.floor((z-540)/12)*12;zz<z+680;zz+=12){
    const d=F.depth(-4,zz);if(d<-8||d>680||section(zz+1.55).open)continue;
    for(const x of [-1.83,westAt(zz)+4.05])ground(F,x-.082,x+.082,zz,zz+3.15,'#e0d6bf',.021);
    const q=section(zz);if(q.pocket>2.7){ground(F,-5.58,-5.44,zz,zz+11.98,'#d5cbb7',.021);if(q.pocket>5.7)ground(F,-8.58,-8.44,zz,zz+3.15,'#d5cbb7',.021)}
  }us.paint();
  for(const [x,a,b] of [[26,16,22],[29,16,22],[32,16,22]]){
    if(Math.abs(z-19)>160)break;
    ground(F,x-.04,x+.04,a,b,'#bdb5a1',.019);
  }
  if(Math.abs(z-1495)<160){
    for(let station=1499;station<1509;station+=2.6){
      ground(F,33,39,station,station+.08,'#c3b8a2',.019);
    }
  }
  for(let n=Math.floor((z-110)/8);n*8<z+200;n++){
    const zz=n*8+hash(n+181)*4;if(roadsideClear(6,zz,8))continue;
    const bank=shore(zz),x=5+hash(n+235)*(bank-10),w=.5+hash(n+32)*2;
    if(parkPavementAt(x,zz))continue;
    face(F,[[x,.018,zz],[x+w,.018,zz+.8],[x+w*1.5,.018,zz+4],[x-.3,.018,zz+5.2]],n%3?'#52634f':'#65705a');
  }
  for(let n=Math.floor((z-100)/21);n*21<z+100;n++){
    if(hash(n+802)>.6)continue;const zz=n*21,x=-15.7+hash(n+98)*17.2;
    worldLine(F,[[x,.025,zz],[x+.35,.025,zz+1.1],[x+.18,.025,zz+2],[x+.8,.025,zz+3.5]],'#29363c',clamp(28/Math.max(4,F.depth(x,zz)),.5,2));
  }
  g.restore();
}
function tree(F,t){
  const p=F.project(t.x,0,t.z);if(!p)return;
  const set=t.type==='palm'?ART.palms:t.type==='oak'?ART.oaks:t.type==='pine'?ART.pines:ART.scrubs,art=set[t.variant];
  const k=p.k,w=art.w*t.scale*k,h=art.h*t.scale*k,x=p.x-w*art.anchor,y=p.y-h;
  if(x>F.P.w+4||x+w<-4||y>F.P.h||p.y<0)return;
  const q=F.point(t.x,t.z),d=Math.hypot(q.x-F.cameraX,q.z-F.cameraZ);
  F.ctx.globalAlpha=clamp((1250-d)/350,0,1);F.ctx.drawImage(mip(art.image,w,h),x,y,w,h);F.ctx.globalAlpha=1;F.drawn++;
}
function lamp(F,x,z){
  const p=F.project(x,0,z);if(!p)return;const k=p.k,east=x>0,head=x+(east?-2.5:2.5);
  if(p.x<-150||p.x>F.P.w+150)return;
  worldLine(F,[[x,0,z],[x,7.5,z],[x+(east?-.28:.28),8.2,z],[head,8.6,z]],'#36474a',clamp(k*.105,.7,10));
  worldLine(F,[[x-.06,.1,z],[x-.06,7.45,z],[x+(east?-.32:.23),8.22,z],[head,8.64,z]],'#968d79',clamp(k*.026,.35,2));
  const q=F.project(head,8.56,z);if(q){const size=clamp(k*.5,2,30);F.ctx.drawImage(ART.glow,q.x-size,q.y-size,size*2,size*2);ellipse(F.ctx,q.x,q.y,clamp(k*.29,1,15),clamp(k*.07,.65,4),'#f2ce9e');}F.drawn++;
}
function sign(F,a){
  const p=F.project(a.x,0,a.z);if(!p)return;const k=p.k,w=a.w*k;
  const img=ART.signs[a.type],h=a.type==='route'?a.h*.67*k:w*img.height/img.width;
  if(p.x+w<0||p.x-w>F.P.w)return;
  const posts=a.park?[-a.w*.34,a.w*.34]:[0];
  for(const dx of posts)worldLine(F,[[a.x+dx,0,a.z],[a.x+dx,a.h-.1,a.z]],a.park?'#857d65':'#7b8378',clamp(k*.085,.7,7));
  F.ctx.drawImage(mip(img,w,h),p.x-w/2,p.y-a.h*k,w,h);F.drawn++;
}
function box(F,x,y,z,w,h,d,cols){
  // Visible faces use the actual camera WORLD position (walking/looking back
  // is not the same as sorting by station). Small faces are depth-sorted too.
  const q=routeAt(z+d/2,x+w/2),dx=F.cameraX-q.x,dz=F.cameraZ-q.z;
  const east=dx*Math.cos(q.heading)-dz*Math.sin(q.heading)>0,north=dx*Math.sin(q.heading)+dz*Math.cos(q.heading)>0;
  const xx=east?x+w:x,zz=north?z+d:z,faces=[
    {p:[[x,y,zz],[x+w,y,zz],[x+w,y+h,zz],[x,y+h,zz]],c:cols[0]},
    {p:[[xx,y,z],[xx,y,z+d],[xx,y+h,z+d],[xx,y+h,z]],c:cols[1]}
  ];
  if((F.P.eye??1.55)>y+h)faces.push({p:[[x,y+h,z],[x+w,y+h,z],[x+w,y+h,z+d],[x,y+h,z+d]],c:cols[2]});
  faces.sort((a,b)=>b.p.reduce((v,p)=>v+F.depth(p[0],p[2]),0)-a.p.reduce((v,p)=>v+F.depth(p[0],p[2]),0));for(const f of faces)face(F,f.p,f.c);
}
function bench(F,x,z){
  // Furniture stays beyond the broad accessible apron, facing the river.
  box(F,x,0,z,.14,.48,.22,['#414f47','#34463f','#6d7660']);box(F,x,0,z+1.6,.14,.48,.22,['#414f47','#34463f','#6d7660']);
  box(F,x-.12,.46,z-.1,.65,.1,2.1,['#9d8c6b','#716e58','#b09c77']);
  box(F,x-.12,.56,z-.1,.1,.38,2.1,['#9c8b6b','#716e58','#b29d78']);F.drawn++;
}
function utility(F,z){
  const x=westAt(z)-5.6,depth=F.depth(x,z);if(depth<3||depth>480)return;const k=F.P.focal/depth;
  worldLine(F,[[x,0,z],[x,10.4,z]],'#635d50',clamp(k*.14,.8,12));worldLine(F,[[x-1.25,9.5,z],[x+1.25,9.5,z]],'#6d6c5a',clamp(k*.09,.6,6));
  for(const dx of [-.9,.9]){const pts=[];for(let n=0;n<=8;n++){const t=n/8;pts.push([x+dx,9.65-Math.sin(t*Math.PI)*.8,z+92*t]);}worldLine(F,pts,'#4a565477',clamp(k*.012,.3,1));}
}

const helpers={face,ground,worldLine,box,ellipse};
/** Paint roadway / river / nearby props. Does not mutate P or s.
 * Caller owns sky, launch, actors, cabin, simulation, DPI and animation loop.
 */
export function drawRoad(ctx,P,s){
  prepareArt();if(!(P.w>0&&P.h>0))return;ctx.save();ctx.lineJoin='round';ctx.imageSmoothingEnabled=true;
  const F=frame(ctx,P,s);groundPass(F);const queue=[];
  const add=(kind,data,x,z,far)=>{const q=F.point(x,z),d=F.depthWorld(q.x,q.z);if(d>ROAD.near&&Math.hypot(q.x-F.cameraX,q.z-F.cameraZ)<far)queue.push({d,kind,data});};
  for(const t of TREES)add('tree',t,t.x,t.z,1250);
  for(const a of SIGNS)add('sign',a,a.x,a.z,750);
  // Symmetric station windows preserve scenery when the walker looks south.
  for(let z=Math.floor((s.z-950)/78)*78+27;z<s.z+950;z+=78){
    if(z<-140||z>ROUTE_LENGTH+160)continue;
    for(const x of [5.6,westAt(z)-3.6])if(!roadsideClear(x,z,3))add('lamp',[x,z],x,z,900);
  }
  for(let z=Math.floor((s.z-560)/92)*92+19;z<s.z+560;z+=92){
    if(z<-140||z>ROUTE_LENGTH+160||roadsideClear(-22,z,4))continue;add('utility',z,-22,z,520);
  }
  for(const p of PARKS)for(const dz of [-25,24])add('bench',[23.8,p.station+dz],23.8,p.station+dz,260);
  for(const j of CROSSINGS)if(j.signal)add('signal',j,-6,j.station,680);
  for(const r of lots)add('front',r,r[0]+r[2]/2,r[1]+r[3]/2,620);
  // All props share one camera-depth ordering, never a station-only pass.
  queue.sort((a,b)=>b.d-a.d);
  for(const o of queue){if(o.kind==='signal')signal(F,helpers,o.data);else if(o.kind==='front')frontage(F,helpers,o.data);else if(o.kind==='tree')tree(F,o.data);else if(o.kind==='sign')sign(F,o.data);else if(o.kind==='lamp')lamp(F,...o.data);else if(o.kind==='bench')bench(F,...o.data);else utility(F,o.data);}
  ctx.restore();drawRoad.stats.drawn=F.drawn;
}
if(typeof document!=='undefined'||typeof OffscreenCanvas!=='undefined')queueMicrotask(prepareArt);
