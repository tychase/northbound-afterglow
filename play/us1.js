// Ground-level interpretation of the 2023 NAIP orthophoto, northern Titusville drive.
// Exact axes/stations: Census; dimensions below are visual estimates in metres, not traffic plans.
import {JUNCTIONS,routeAt} from './route.js';
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function sample(keys,z){let i=1;while(i<keys.length-1&&z>keys[i][0])i++;const a=keys[i-1],b=keys[i],t=clamp((z-a[0])/(b[0]-a[0]),0,1);return a[1]+(b[1]-a[1])*t}
// Western outer edge varies independently from the NB driver's lane. Long planted median
// tapers into side-by-side left-turn pockets south of 50 rather than a continuous TWLTL.
const edge=[[-200,-17],[0,-18.0],[110,-21.7],[268,-23.8],[390,-23.1],[460,-23],[520,-22.7],[660,-21.0],[800,-20.3],[920,-20],[1080,-20],[1240,-21.8],[1330,-21.4],[1480,-21.4],[1700,-21.4]];
const shoreKey=[[-100,48],[5,69],[125,66],[210,66],[248,65],[312,58],[342,46],[354,24],[420,22],[480,24],[550,19],[625,19],[683,36],[720,29],[780,39],[860,30],[940,26],[985,40],[1030,66],[1085,56],[1145,30],[1260,29],[1355,25],[1430,23],[1462,42],[1492,58],[1550,54]];
export const bankAt=z=>sample(shoreKey,z),westAt=z=>sample(edge,z);
export const streets=JUNCTIONS.map((j,i)=>{const plane=routeAt(j.station);const co=Math.cos(plane.heading),si=Math.sin(plane.heading);const pts=j.geometry.map(([x,z])=>[(x-plane.x)*co-(z-plane.z)*si,j.station+(x-plane.x)*si+(z-plane.z)*co]);return {...j,i,pts,halfWidth:[11.4,3.6,3.2,3.6,5.9,3.5][i],signal:i===0||i===4,spread:i===0?8:i===4?5:3.3}});
function branchZ(j,x){const k=j.pts;let i=1;while(i<k.length-1&&x<k[i][0])i++;const a=k[i-1],b=k[i];return a[1]+(b[1]-a[1])*clamp((x-a[0])/(b[0]-a[0]),0,1)}
const medianOpen=z=>streets.find(j=>Math.abs(z-j.station)<(j.signal?13:5.8));
function pocket(z){for(const j of streets){const d=j.station-z;if(d>0&&d<(j.i===0?151:j.i===4?82:48)){const l=j.i===0?151:j.i===4?82:48;return clamp((l-d)/23,0,1)*(j.i===0?6.5:2.95)}}return 0}
export function section(z){const w=westAt(z),mw=w+8.1,me=Math.max(mw+.38,-5.75-pocket(z));return {w,mw,me,pocket:pocket(z),open:!!medianOpen(z)}}
const lots=[// x min, station near, lateral width, length, eave height, style. Approximate visible footprints; elevations original, unbranded.
 [13,158,24,35,4.2,2],[26,241,20,72,10.8,3],[-94,251,56,22,5.1,0],[-91,322,51,19,4.4,1],[-79,382,31,19,4.8,0],[-92,504,29,27,5.4,1],[-69,555,25,48,6.1,0],[-72,628,26,18,4.2,1],[-89,697,42,13,4.5,2],[-72,744,20,13,3.2,2],[-57,778,21,12,3.8,2],[-81,814,15,13,4.1,2],[-72,849,21,12,3.6,2],[-67,903,35,25,4.9,0],[-54,935,18,17,4.5,1],[-81,964,21,14,3.6,2],[-83,1026,28,35,6.1,0],[-60,1108,30,18,4.7,1],[-71,1139,21,33,4.6,1],[-56,1210,13,36,3.8,2],[-95,1322,44,31,5.7,0],[-66,1370,32,17,4.5,1],[-70,1494,27,25,4.6,0]];
export {lots};
export function layers(F,H){const {face,ground,worldLine}=H;
 const quad=(x1,x2,z1,y1,x3,x4,z2,y2,c)=>face(F,[[x1,y1,z1],[x2,y1,z1],[x4,y2,z2],[x3,y2,z2]],c);
 const strokeRoad=(x1,x2,z1,z2,c,y=.021)=>ground(F,x1,x2,z1,z2,c,y);
 function cover(a,b,grad,park){const m=(a+b)/2,A=section(a),B=section(b),M=section(m);quad(A.w,2.6,a,0,B.w,2.6,b,0,grad);
  // Distinct paving on opposite carriageway. Curb returns are separate from the highway edge.
  quad(A.w,A.mw,a,.001,B.w,B.mw,b,.001,'#57575e');
  const mouth=streets.some(j=>Math.abs(m-branchZ(j,M.w))<j.halfWidth+j.spread+1);
  if(!mouth){quad(A.w-3,A.w,a,.02,B.w-3,B.w,b,.02,'#79766e');quad(A.w-2.8,A.w-1.4,a,.07,B.w-2.8,B.w-1.4,b,.07,'#b7a899');quad(A.w-.43,A.w-.08,a,.06,B.w-.43,B.w-.08,b,.06,'#c0afa2');}
  if(!park){strokeRoad(2.56,3.04,a,b,'#a5988c');strokeRoad(3.04,3.25,a,b,'#dbbfa4',.09);strokeRoad(3.25,4.95,a,b,'#a69b8e',.09);strokeRoad(1.82,1.97,a,b,'#ddd6bf')}
 }
 function median(a,b){const m=(a+b)/2;if(medianOpen(m))return;const A=section(a),B=section(b);
  const tip=z=>Math.min(1,...streets.map(j=>clamp((Math.abs(z-j.station)-(j.signal?13:5.8))/2.3,0,1)));
  function ends(q,z){const mid=(q.me+q.mw)/2,t=tip(z);return [mid+(q.mw-mid)*t,mid+(q.me-mid)*t]};const [L,R]=ends(A,a),[l,r]=ends(B,b);
  quad(L,R,a,.09,l,r,b,.09,'#baac91');quad(R,R+.12,a,.06,r,r+.12,b,.06,'#736d63');
  if(Math.min(R-L,r-l)>1.25){quad(L+.28,R-.28,a,.095,l+.28,r-.28,b,.095,'#65704d');if(Math.min(R-L,r-l)>2.5)quad(L+.7,R-.63,a,.098,l+.7,r-.63,b,.098,'#71805a')}
  quad(L-.28,L-.13,a,.018,l-.28,l-.13,b,.018,'#e1ad54');quad(R+.14,R+.29,a,.018,r+.14,r+.29,b,.018,'#e1ad54');
 }
 function branches(){for(const j of streets){if(Math.abs(j.station-F.s.z)>700)continue;const w=westAt(j.station);const h=j.halfWidth;
  const cuts=[w+.15,w-2,w-5,w-10,w-16,w-25,...j.pts.map(p=>p[0]).filter(x=>x<w-26)].sort((a,b)=>b-a);
  const ribbon=(x1,x2,c,edge1,edge2)=>{const p=branchZ(j,x1),q=branchZ(j,x2);face(F,[[x1,.015,p+edge1(x1)],[x1,.015,p+edge2(x1)],[x2,.015,q+edge2(x2)],[x2,.015,q+edge1(x2)]],c)};
  const outer=x=>h+j.spread*Math.pow(clamp(1-(w-x)/11,0,1),2);
  for(let i=1;i<cuts.length;i++){const x1=cuts[i-1],x2=cuts[i];ribbon(x1,x2,'#b5a594',x=>-outer(x)-.46,x=>outer(x)+.46);ribbon(x1,x2,j.signal?'#555661':'#605d63',x=>-outer(x),outer);
   if(x1<w-12&&j.i===0){ribbon(x1,x2,'#a69d88',()=>-1.25,()=>1.25);ribbon(x1,x2,'#687350',()=>-1,()=>1)}else if(x1<w-5&&(j.i===0||j.i===4)){ribbon(x1,x2,'#ddae67',()=>-.12,()=>.12)}}
  if(j.i===0||j.i===4){const x=w-5.8,cz=branchZ(j,x);ground(F,x-.55,x,cz-h+.3,cz-.8,'#dfd7c0',.023);}
 }}
 function paint(){for(const j of streets){const z=j.station;if(Math.abs(z-F.s.z)>430)continue;
  if(j.signal){const A=section(z);const end=z-(j.i===0?17:14);strokeRoad(A.me+.15,2.05,end-.58,end,'#dfd5be');strokeRoad(A.w,A.mw,z+15,z+15.5,'#d7ccb5');
   // Two distinctly different crossings visible in the reference: transverse lines at Cheney, ladder at Knox.
   if(j.i===4){for(let x=A.w+.45;x<2.1;x+=1.13)strokeRoad(x,x+.48,z-10.5,z-7.8,'#ded2b9')}else{strokeRoad(A.w,2.2,z-12.8,z-12.56,'#d7cbb7');strokeRoad(A.w,2.2,z-10.4,z-10.16,'#d7cbb7')}
   for(const dz of [-35,-63]){const arrow=(x,d)=>face(F,[[x+.13,.025,d-2.2],[x+.13,.025,d+.7],[x-.55,.025,d+.7],[x-.55,.025,d+1.34],[x-1.68,.025,d+.12],[x-.55,.025,d-.98],[x-.55,.025,d-.33],[x-.2,.025,d-.33],[x-.2,.025,d-2.2]],'#dcd3bc');arrow(-6.98,z+dz);if(j.i===0)arrow(-9.65,z+dz)}
  }
 }}
 function lotGround(){for(const [x,z,w,d,,style] of lots){if(Math.abs(z-F.s.z)>430)continue;const near=x>0?x-4:x+w+3,far=x>0?x+w+4:x-3;ground(F,Math.min(near,far),Math.max(near,far),z-3,z+d+3,style===2?'#666d59':'#696769',.004);
 if(x<0&&style!==2){const end=westAt(z)-3.1;ground(F,near,end,z-2,z+d+5,'#6d6a69',.007);for(let zz=z+3;zz<z+d;zz+=2.9)ground(F,near+.6,Math.min(near+5.3,end-.4),zz,zz+.11,'#b8ac96',.015);}}
 }
 return {cover,median,branches,paint,lotGround};}

export function signal(F,H,j){const {worldLine,box,ellipse}=H,z=j.station;
 // Two opposing span directions and suspended multiple signal faces. Heights,
 // pole positions, steady through-green and protected-turn indications are scenic.
 const east=6.1,west=westAt(z)-2.8,dz=8.0;for(const [x,s] of [[east,z+dz],[west,z-dz]]){box(F,x-.23,0,s-.23,.46,8.1,.46,['#747b77','#9e9c8d','#baaf9e']);box(F,x-.34,0,s-.34,.68,.64,.68,['#9b9687','#b0a897','#c0ad95'])}
 const lineAt=x=>z-dz+2*dz*(x-west)/(east-west),wire=x=>{const t=(x-west)/(east-west);return 7.9-1.02*4*t*(1-t)};
 for(const dy of [0,-.13]){const pts=[];for(let i=0;i<=12;i++){const x=west+(east-west)*i/12;pts.push([x,wire(x)+dy,lineAt(x)])}worldLine(F,pts,'#393d40',1.55)}
 for(const [x,mode] of [[.05,'go'],[-3.55,'go'],[-7,'left'],...(j.i===0?[[-9.6,'left']]:[]),[west+2,'back'],[west+5.7,'back']]){const s=lineAt(x),y=wire(x)-.16,p=F.project(x,y,s);if(!p)continue;const k=p.k,g=F.ctx;const W=clamp(k*.58,1,90),Ht=W*2.16;
  g.fillStyle='#9c8654';g.fillRect(p.x-W*.55,p.y,W*1.10,Ht);g.fillStyle='#262c2e';g.fillRect(p.x-W*.44,p.y+W*.08,W*.88,Ht-W*.16);
  if(mode==='back')continue;for(let b=0;b<3;b++){const active=mode==='go'?b===2:b===0;const y1=p.y+W*(.43+b*.65);ellipse(g,p.x,y1,W*.27,W*.265,active?(mode==='go'?'#79efbe':'#ff7656'):'#4a4943');if(active&&W>2)ellipse(g,p.x-.02*W,y1-.02*W,W*.16,W*.16,mode==='go'?'#bdffe0':'#ffd19c')}
 }
}
export function frontage(F,H,r){const {face,box}=H,[x,z,w,d,h,k]=r;const fronts=['#c5b5a1','#baab95','#cbc1a7','#d6b492'],sides=['#9a8a83','#897f7d','#9b9383','#ae8873'];box(F,x,0,z,w,h,d,[fronts[k],sides[k],'#c0afa3']);
 const lip=k===2?.26:.38;box(F,x-.19,h-.32,z-.19,w+.38,lip,d+.38,['#d4c5a9','#afa494','#d7c4a9']);
 const roof=k>=2;if(roof){const y=h+.05,peak=h+(k===3?1.8:1.55),inset=Math.min(w*.45,d*.36);face(F,[[x,y,z],[x+w,y,z],[x+w/2,peak,z+inset]],'#b78b73');face(F,[[x,y,z],[x+w/2,peak,z+inset],[x+w/2,peak,z+d-inset],[x,y,z+d]],'#ad806a');face(F,[[x+w,y,z],[x+w,y,z+d],[x+w/2,peak,z+d-inset],[x+w/2,peak,z+inset]],'#997563')}
 const frontX=x>0?x-.012:x+w+.012;for(let f=0;f<(k===3?3:1);f++){const y=.83+f*3.05;for(let a=1.5;a<d-2;a+=k===3?3.3:4.6){const end=Math.min(a+(k===2?1.35:k===3?1.85:3.4),d-1);face(F,[[frontX,y,z+a],[frontX,y,z+end],[frontX,y+1.42,z+end],[frontX,y+1.42,z+a]],k===2?'#56686b':(Math.floor(a)%3?'#4b6167':'#a78e76'));}}
 if(k===1||k===3){const end=x>0?frontX-1.4:frontX+1.4;face(F,[[frontX,2.89,z+.9],[end,2.62,z+.9],[end,2.62,z+d-.9],[frontX,2.89,z+d-.9]],k===3?'#778986':'#758d89')}
 // South face is the advance silhouette while the player drives north.
 for(let xx=1.4;xx<w-1.8;xx+=4.5){face(F,[[x+xx,1,z-.015],[x+xx+1.55,1,z-.015],[x+xx+1.55,2.47,z-.015],[x+xx,2.47,z-.015]],'#647376')}
}
