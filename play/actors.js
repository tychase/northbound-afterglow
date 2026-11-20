/* Original Seabreeze wagon + traveler, drawn as metre-scale world geometry.
 * No images, random paint, screen-space actor sprites, clocks or dependencies.
 * +Z is the nose; +X is passenger side; headings turn clockwise from north.
 * Canon: ~5.3 x 2.02 x 1.65 m wagon (mirrors wider), 3.08 m wheelbase,
 * .36 m tires;
 * 1.77 m traveler, .24 m head, .46 m shoulders, .885 m articulated legs.
 * Finish: dusk-plum enamel / aged ivory roof / walnut inlay, warm west light,
 * cool undersides, restrained lamps. Original distance-authored walking cycle.
 */
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mix = (a, b, t) => a + (b - a) * t;
const V = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const unit = v => {const d = Math.hypot(...v) || 1; return v.map(x => x / d);};
const normal = p => unit(cross(V(p[1], p[0]), V(p[2], p[0])));
const center = p => p.reduce((v, q) => v.map((x, i) => x + q[i]/p.length), [0,0,0]);
const lerp3 = (a,b,t) => a.map((v,i) => mix(v,b[i],t));

// Materials store albedo, not pre-baked per-view lighting. The sunset remains
// on the west side while either car or camera turns. All grain is object-fixed.
const MAT = {
  body: {color:'#796875', shade:true, grad:.12},
  hood: {color:'#8b7983', shade:true, grad:.08},
  roof: {color:'#c5b5a3', shade:true, grad:.07},
  dark: {color:'#252c36', shade:true},
  chrome: {color:'#a5adb1', shade:true, grad:.22},
  rubber: {color:'#20252e', shade:true},
  wood: {color:'#735348', shade:true, grad:.13},
  skin: {color:'#bd8d72', shade:true},
  hair: {color:'#3c302e', shade:true},
  jacket: {color:'#ac8265', shade:true, grad:.07},
  jeans: {color:'#4d5a69', shade:true},
  bag: {color:'#4f665f', shade:true, grad:.1}
};
function material(m) { return typeof m === 'string' ? {color:m} : m; }
function face(mesh, points, mat, opts={}) {
  mesh.push({points, mat:material(mat), kind:'face', layer:mesh.layer||0, normal:normal(points), center:center(points), ...opts});
}
function line(mesh, points, color, width=.012, opts={}) {
  mesh.push({points, mat:material(color), kind:'line', width, bias:.009, layer:(mesh.layer||0)+.15, center:center(points), ...opts});
}
function box(mesh, x0,y0,z0,x1,y1,z1, mat) {
  const v=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],
    [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
  for (const ids of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])
    face(mesh,ids.map(i=>v[i]),mat);
}
function bumperBox(mesh,x0,y0,z0,x1,y1,z1,mat,end) {
  const first=mesh.length;box(mesh,x0,y0,z0,x1,y1,z1,mat);
  // An inner/top bumper face is behind the body from a side camera. Only
  // its outward fascia overlays the shell; otherwise a full-width top quad
  // becomes a spurious silver spear across the far side of the wagon.
  for(let i=first;i<mesh.length;i++)mesh[i].layer=normal(mesh[i].points)[2]*end>.9?4.1:1.8;
}
function shell(mesh, rings, mat) {
  const mid=center(rings.flat());
  for(let k=0;k<rings.length-1;k++) for(let j=0;j<rings[k].length;j++) {
    const n=(j+1)%rings[k].length;
    let p=[rings[k][j],rings[k][n],rings[k+1][n],rings[k+1][j]];
    if(dot(normal(p),V(center(p),mid))<0)p=p.reverse();
    face(mesh,p,mat);
  }
  for(const k of [0,rings.length-1]) {
    let p=rings[k].slice(); if(dot(normal(p),V(center(p),mid))<0)p.reverse();
    face(mesh,p,mat);
  }
}
function ovalRing(x,y,z,rx,rz,n=10, angle=0) {
  return Array.from({length:n},(_,i)=>{const a=i/n*TAU+Math.PI/10;
    const X=Math.cos(a)*rx,Z=Math.sin(a)*rz;
    return [x+X*Math.cos(angle)+Z*Math.sin(angle),y,z-X*Math.sin(angle)+Z*Math.cos(angle)];});
}
function ellipsoid(mesh,c,r,mat,n=12,bands=6,filter=null) {
  const rings=[];
  for(let j=0;j<=bands;j++){
    const a=-Math.PI/2+j/bands*Math.PI,rad=Math.max(.012,Math.cos(a));
    rings.push(Array.from({length:n},(_,i)=>{const b=i/n*TAU;return[c[0]+Math.cos(b)*r[0]*rad,c[1]+Math.sin(a)*r[1],c[2]+Math.sin(b)*r[2]*rad];}));
  }
  for(let j=0;j<bands;j++)for(let i=0;i<n;i++){
    let p=[rings[j][i],rings[j][(i+1)%n],rings[j+1][(i+1)%n],rings[j+1][i]];
    if(dot(normal(p),V(center(p),c))<0)p.reverse();
    if(!filter||filter(center(p)))face(mesh,p,mat);
  }
}
function tube(mesh,a,b,ra,rb,mat,n=8,flat=1) {
  const d=unit(V(b,a)),u=unit(cross(d,Math.abs(d[0])<.8?[1,0,0]:[0,1,0])),v=cross(d,u);
  shell(mesh,[a,b].map((c,k)=>Array.from({length:n},(_,i)=>{
    const t=i/n*TAU,r=k?rb:ra;return c.map((x,j)=>x+r*(u[j]*Math.cos(t)+v[j]*Math.sin(t)*flat));
  })),mat);
}
function decal(mesh, text, points, color, size=.07, opts={}) {
  mesh.push({kind:'text',text,points,mat:{color},size,bias:.018,layer:(mesh.layer||0)+.2,...opts});
}
function transformPoint(p, actor) {
  const c=Math.cos(actor.heading||0),s=Math.sin(actor.heading||0);
  return [actor.x+p[0]*c+p[2]*s,p[1],actor.z-p[0]*s+p[2]*c];
}
function transformDirection(p, actor) {
  const c=Math.cos(actor.heading||0),s=Math.sin(actor.heading||0);
  return [p[0]*c+p[2]*s,p[1],-p[0]*s+p[2]*c];
}
function facing(mesh,points,mat,n,opts={}) {face(mesh,points,mat,{normal:n,...opts});}
function side(mesh,sign,yz,mat,opts={}) {
  const x=opts.x??1.008;face(mesh,yz.map(([y,z])=>[sign*x,y,z]),mat,{normal:[sign,0,0],...opts});
}

// Two notches are part of the body outline, so tires occupy real wheel wells.
function arch(z,r=.421,y=.402) {
  return Array.from({length:15},(_,j)=>{const a=j/14*Math.PI;return[y+Math.sin(a)*r,z+Math.cos(a)*r];});
}
function makeCar() {
  const m=[];
  box(m,-.83,.25,-2.27,.83,.46,2.26,MAT.dark);
  m.layer=3;
  // Body shoulder is chamfered, never a rectangular screen-space trapezoid.
  for(const s of [-1,1]) {
    const outline=[[.995,-2.45],[1.035,-2.12],[1.06,.98],[.985,2.45],[.48,2.50],
      [.405,1.98],...arch(1.54),[.402,-1.119],...arch(-1.54),[.405,-2.49]];
    side(m,s,outline,MAT.body,{layer:2});
    face(m,[[s*1.008,.995,-2.45],[s*.91,1.085,-2.35],[s*.92,1.105,.99],[s*1.008,1.06,.98]],MAT.hood,{normal:[s*.7,.7,0],layer:2});
    face(m,[[s*1.008,1.06,.98],[s*.92,1.105,.99],[s*.90,1.035,2.43],[s*1.008,.985,2.45]],MAT.hood,{normal:[s*.7,.7,.04],layer:2});
    line(m,[[s*1.014,1.018,-2.39],[s*1.014,1.061,.97],[s*1.014,1.00,2.42]],'#c0a4a0',.016,{normal:[s,0,0]});
    // Walnut inset, two coach-lines, and stable long grain rather than noise.
    side(m,s,[[.825,-2.38],[.934,-2.38],[.965,.98],[.91,2.37],[.805,2.37]],MAT.wood,{x:1.014});
    for(let j=0;j<3;j++)line(m,[[s*1.019,.843+j*.032,-2.32],[s*1.019,.865+j*.03,-.8],[s*1.019,.873+j*.029,.93],[s*1.019,.826+j*.03,2.32]],j===1?'#bb947a66':'#392f3866',.006,{normal:[s,0,0]});
    line(m,[[s*1.02,.814,-2.38],[s*1.02,.825,.99],[s*1.02,.805,2.38]],'#c7af98',.014,{normal:[s,0,0]});
    line(m,[[s*1.02,.935,-2.38],[s*1.02,.965,.98],[s*1.02,.91,2.38]],'#b2a396',.012,{normal:[s,0,0]});
    // Moldings and fitted fender lips; the arcs share their tire centres.
    for(const z of [-1.54,1.54]){
      line(m,arch(z,.432).map(([y,Z])=>[s*1.021,y,Z]),'#b4a8a0',.021,{normal:[s,0,0]});
      line(m,arch(z,.451).map(([y,Z])=>[s*1.023,y,Z]),'#443f4a',.009,{normal:[s,0,0]});
    }
    line(m,[[s*1.01,.446,-1.08],[s*1.01,.446,1.08]],'#b5a39b',.027,{normal:[s,0,0]});
    for(const z of [-.71,.23,1.12])line(m,[[s*1.024,.448,z],[s*1.024,.81,z],[s*1.024,1.045,z]],'#332f3d',.009,{normal:[s,0,0]});
    for(const z of [-.53,.98]){
      side(m,s,[[.954,z-.16],[.986,z-.16],[.986,z+.04],[.954,z+.04]],'#333440',{x:1.027});
      line(m,[[s*1.034,.98,z-.14],[s*1.034,.982,z+.025]],'#c7b6a6',.024,{normal:[s,0,0]});
    }
    // Small side markers and fuel door.
    side(m,s,[[.656,-2.32],[.72,-2.32],[.72,-2.17],[.656,-2.17]],'#ba665c',{x:1.025});
    side(m,s,[[.68,2.16],[.735,2.16],[.735,2.30],[.68,2.30]],'#dbb17d',{x:1.025});
    if(s===-1)line(m,[[-1.028,.57,-2.12],[-1.028,.73,-2.12],[-1.028,.73,-2.32],[-1.028,.57,-2.32],[-1.028,.57,-2.12]],'#4a404b',.01,{normal:[s,0,0]});
  }
  // Hood crease and broad reflected dusk, continuous in physical space.
  facing(m,[[-.91,1.106,1.0],[.91,1.106,1.0],[.90,1.036,2.43],[-.90,1.036,2.43]],MAT.hood,[0,1,.05],{layer:2});
  face(m,[[-.73,1.108,1.07],[-.41,1.108,1.07],[-.34,1.047,2.33],[-.65,1.047,2.33]],'#d1a39920',{normal:[0,1,.05],bias:.007,layer:2.1});
  for(const x of [-.64,.64])line(m,[[x,1.112,1.05],[x*.95,1.048,2.36]],'#bd999548',.009,{normal:[0,1,0]});
  // Cabin floor and cargo deck, warm upholstery consistent with cabin.js.
  m.layer=0;
  box(m,-.86,.48,-2.31,.86,.70,1.06,'#282b34');
  box(m,-.79,.70,-2.28,.79,.76,-.70,'#665251');
  for(const z of [-.72,.39])for(const x of [-.46,.46]){
    box(m,x-.25,.73,z-.21,x+.25,.87,z+.29,{color:'#6c5755',shade:true});
    box(m,x-.25,.81,z-.23,x+.25,1.25,z-.10,{color:'#705b59',shade:true});
    box(m,x-.14,1.20,z-.22,x+.14,1.36,z-.09,{color:'#8a7067',shade:true});
    for(let j=0;j<4;j++)line(m,[[x-.17+j*.11,.88,z-.095],[x-.17+j*.11,1.19,z-.095]],'#ad8c7255',.008,{normal:[0,0,1]});
  }
  box(m,-.82,.96,.94,.82,1.12,1.15,'#433d46');
  // Side glass is a genuinely sloped volume. Rear-quarter panes read as a wagon.
  m.layer=5;
  for(const s of [-1,1]){
    const pane=(zb,ze,ztb,zte)=>[[s*.915,1.10,zb],[s*.915,1.10,ze],[s*.825,1.50,zte],[s*.825,1.50,ztb]];
    for(const [zb,ze,ztb,zte] of [[-2.27,-.75,-2.08,-.75],[-.68,.19,-.68,.19],[.27,1.02,.27,.63]]){
      const first=m.length;
      const p=pane(zb,ze,ztb,zte);
      face(m,p,'#30404eaf',{normal:[s,.23,0],bias:-.008});
      line(m,[...p,p[0]],'#bcae9f',.028,{normal:[s,.23,0]});
      // A reflected horizon and one long cloud, clipped by the window itself.
      const q=[lerp3(p[0],p[3],.58),lerp3(p[1],p[2],.58),lerp3(p[1],p[2],.87),lerp3(p[0],p[3],.87)];
      face(m,q,'#d9aca537',{normal:[s,.23,0],bias:.012,layer:5.08});
      line(m,[lerp3(p[0],p[3],.55),lerp3(p[1],p[2],.55)],'#e7c3ab40',.008,{normal:[s,.23,0]});
      if(s===-1&&zb===.27)for(let i=first;i<m.length;i++)m[i].doorFixed=true;
    }
    // Slender, solid pillars with honest volume and cream painted gutters.
    for(const [zb,zt,w] of [[-2.29,-2.10,.065],[-.715,-.715,.048],[.23,.23,.051],[1.065,.68,.055]]){
      const p=[[s*.921,1.08,zb-w],[s*.921,1.08,zb+w],[s*.839,1.53,zt+w],[s*.839,1.53,zt-w]];
      face(m,p,MAT.roof,{normal:[s,.2,0],bias:.02,layer:5.3});
    }
    line(m,[[s*.846,1.54,-2.13],[s*.846,1.565,-1.91],[s*.846,1.565,.57],[s*.846,1.53,.70]],'#cbb9a6',.028,{normal:[s,.5,0]});
    // Door mirror has a mounting stalk, not a floating chrome square.
    tube(m,[s*.96,1.10,.94],[s*1.12,1.17,.92],.018,.018,MAT.chrome,6);
    box(m,s<0?-1.225:1.08,1.14,.82,s<0?-1.08:1.225,1.245,1.01,MAT.body);
    facing(m,[[s*1.219,1.16,.827],[s*1.089,1.16,.827],[s*1.089,1.226,.827],[s*1.219,1.226,.827]],'#b6aaa3',[0,0,-1]);
  }
  // Ivory roof with rounded shoulders and two low luggage rails.
  m.layer=6;
  const roofRings=[
    [[-.84,1.51,-2.12],[.84,1.51,-2.12],[.84,1.51,.70],[-.84,1.51,.70]],
    [[-.77,1.56,-2.07],[.77,1.56,-2.07],[.77,1.56,.62],[-.77,1.56,.62]]
  ];shell(m,roofRings,MAT.roof);
  m.layer=6.3;
  for(const x of [-.64,.64]){
    for(const z of [-1.89,.37])tube(m,[x,1.56,z],[x,1.635,z],.021,.021,MAT.chrome,6);
    tube(m,[x,1.635,-1.94],[x,1.635,.43],.018,.018,MAT.chrome,6);
  }
  for(const z of [-1.52,.15])tube(m,[-.64,1.60,z],[.64,1.60,z],.014,.014,'#4a4851',6);
  // Windshield and rear window. Reflections remain small enough to see seats.
  m.layer=5;
  const windshield=[[-.89,1.11,1.08],[.89,1.11,1.08],[.81,1.50,.69],[-.81,1.50,.69]];
  const rear=[[-.89,1.075,-2.35],[-.82,1.49,-2.125],[.82,1.49,-2.125],[.89,1.075,-2.35]];
  face(m,windshield,'#52606d95',{normal:[0,.70,.72]});
  face(m,rear,'#34424fa8',{normal:[0,.47,-.88]});
  for(const [p,n] of [[windshield,[0,.70,.72]],[rear,[0,.47,-.88]]]){
    line(m,[...p,p[0]],'#b7a797',.027,{normal:n});
  }
  face(m,[[-.86,1.19,.999],[.86,1.19,.999],[.82,1.41,.779],[-.82,1.41,.779]],'#d7a69b23',{normal:[0,.7,.72],bias:.014,layer:5.08});
  face(m,[[-.86,1.26,-2.251],[.86,1.26,-2.251],[.827,1.45,-2.149],[-.827,1.45,-2.149]],'#e4b4a52b',{normal:[0,.47,-.88],bias:.018,layer:5.08});
  for(let j=0;j<6;j++){
    const y=1.135+j*.046,z=-2.35+(y-1.075)/.415*.225;
    line(m,[[-.82,y,z-.003],[.82,y,z-.003]],'#c49a7860',.004,{normal:[0,.47,-.88]});
  }
  line(m,[[-.61,1.12,-2.336],[.16,1.19,-2.298],[.28,1.15,-2.32]],'#252e38',.016,{normal:[0,.47,-.88]});
  for(const x of [-.56,.20])line(m,[[x,1.13,1.063],[x+.38,1.16,1.033]],'#242d36',.015,{normal:[0,.7,.72]});
  // Tailgate: inset walnut field, bright lower bumper, inset US-sized plate.
  m.layer=3;
  facing(m,[[-1.008,.44,-2.49],[1.008,.44,-2.49],[1.008,.995,-2.45],[.91,1.085,-2.35],[-.91,1.085,-2.35],[-1.008,.995,-2.45]],MAT.body,[0,0,-1],{layer:2});
  facing(m,[[-.88,.69,-2.481],[.88,.69,-2.481],[.88,.955,-2.46],[-.88,.955,-2.46]],MAT.wood,[0,0,-1],{bias:.006});
  line(m,[[-.95,.98,-2.463],[.95,.98,-2.463]],'#c9b4a2',.018,{normal:[0,0,-1]});
  m.layer=4;
  bumperBox(m,-1.014,.365,-2.63,1.014,.515,-2.47,MAT.chrome,-1);
  bumperBox(m,-.97,.394,-2.642,.97,.454,-2.631,'#383742',-1);
  for(const x of [-.68,.68])bumperBox(m,x-.041,.366,-2.67,x+.041,.54,-2.48,'#373640',-1);
  facing(m,[[-.27,.535,-2.514],[.27,.535,-2.514],[.27,.675,-2.504],[-.27,.675,-2.504]],'#baa998',[0,0,-1]);
  facing(m,[[-.246,.551,-2.518],[.246,.551,-2.518],[.246,.661,-2.51],[-.246,.661,-2.51]],'#d4c3a0',[0,0,-1]);
  decal(m,'COAST  01',[[-.229,.638,-2.526],[.229,.638,-2.526],[-.229,.565,-2.526]],'#4b595c',.075,{normal:[0,0,-1]});
  decal(m,'S E A B R E E Z E',[[-.46,.908,-2.484],[.46,.908,-2.484],[-.46,.846,-2.484]],'#ddc6ab',.065,{normal:[0,0,-1]});
  line(m,[[-.125,.792,-2.497],[.125,.792,-2.497]],'#c5b7a9',.025,{normal:[0,0,-1]});
  // Nose: broad grille, recessed pairs of square sealed-beam headlamps.
  facing(m,[[-1.008,.48,2.50],[-1.008,.985,2.45],[-.90,1.035,2.43],[.90,1.035,2.43],[1.008,.985,2.45],[1.008,.48,2.50]],MAT.body,[0,0,1],{layer:2});
  bumperBox(m,-1.022,.36,2.48,1.022,.515,2.63,MAT.chrome,1);
  bumperBox(m,-.96,.396,2.632,.96,.451,2.642,'#383742',1);
  facing(m,[[-.50,.63,2.509],[.50,.63,2.509],[.50,.947,2.472],[-.50,.947,2.472]],'#282f39',[0,0,1]);
  for(let i=0;i<13;i++){const x=-.465+i*.0775;line(m,[[x,.645,2.513],[x,.93,2.481]],'#a69e99',.014,{normal:[0,0,1]});}
  for(const y of [.71,.81,.92])line(m,[[-.48,y,2.51-(y-.63)*.11],[.48,y,2.51-(y-.63)*.11]],'#847e80',.011,{normal:[0,0,1]});
  face(m,[[-.06,.925,2.489],[0,.993,2.48],[.06,.925,2.489],[0,.879,2.493]],'#c6b7a0',{normal:[0,0,1],bias:.025});
  // Exhaust terminates below, not through, the bumper.
  tube(m,[.73,.27,-2.35],[.73,.25,-2.60],.038,.038,'#51515a',8);
  return m;
}
const CAR = makeCar();
const WHEEL_TRAVEL = new WeakMap();
function wheelSpin(car) {
  if(Number.isFinite(car.distance))return car.distance/.36;
  const old=WHEEL_TRAVEL.get(car);let distance=old?.distance||0;
  if(old){const dx=car.x-old.x,dz=car.z-old.z;
    if(Math.hypot(dx,dz)<10)distance+=dx*Math.sin(car.heading||0)+dz*Math.cos(car.heading||0);
  }
  WHEEL_TRAVEL.set(car,{x:car.x,z:car.z,distance});return distance/.36;
}

function wheel(mesh, side, z, steer, spin) {
  const r=.36, x=side*.935, y=.36, a=z>0?steer*.42:0, co=Math.cos(a),si=Math.sin(a);
  const at=(X,Y,Z)=>[x+X*co+Z*si,y+Y,z-X*si+Z*co];
  const n=20,rings=[-.115,-.095,.095,.115].map((X,k)=>Array.from({length:n},(_,i)=>{
    const t=i/n*TAU,R=(k===0||k===3)?r*.93:r;return at(X,Math.cos(t)*R,Math.sin(t)*R);
  }));
  // Tire tread as a closed barrel, with sidewalls and wheel-face concentric discs.
  shell(mesh,rings,MAT.rubber);
  const out=side*.119, normalW=[side*co,0,-side*si];
  for(const [rad,col] of [[.266,'#858281'],[.243,'#343b45'],[.204,'#adaba5'],[.155,'#555d66'],[.107,'#c0b7a7']]){
    face(mesh,Array.from({length:n},(_,i)=>{const t=i/n*TAU;return at(out,Math.cos(t)*rad,Math.sin(t)*rad);}),{color:col,shade:true},{normal:normalW,bias:.006+(r-rad)*.025});
  }
  for(let i=0;i<7;i++){
    const t=i/7*TAU+spin;
    line(mesh,[at(out+side*.004,Math.cos(t)*.113,Math.sin(t)*.113),at(out+side*.004,Math.cos(t+.12)*.187,Math.sin(t+.12)*.187)],'#bdb6a6',.026,{normal:normalW,bias:.016});
  }
  for(let i=0;i<5;i++){
    const t=i/5*TAU+spin;
    face(mesh,Array.from({length:6},(_,j)=>at(out+side*.01,Math.cos(t)*.065+Math.cos(j/6*TAU)*.013,Math.sin(t)*.065+Math.sin(j/6*TAU)*.013)),'#454953',{normal:normalW,bias:.018});
  }
}
function lamps(mesh, braking, parked) {
  for(const s of [-1,1]){
    const x0=s<0?-.94:.55,x1=s<0?-.55:.94;
    facing(mesh,[[x0,.675,-2.494],[x1,.675,-2.494],[x1,.94,-2.475],[x0,.94,-2.475]],'#282b34',[0,0,-1],{bias:.018});
    for(const [y,h,color] of [[.706,.062,braking?'#ffb2a0':parked?'#97494a':'#c86b65'],[.79,.104,braking?'#ff826a':parked?'#a15351':'#e47f70']]){
      facing(mesh,[[x0+.025,y,-2.504],[x1-.025,y,-2.504],[x1-.025,y+h,-2.492],[x0+.025,y+h,-2.492]],color,[0,0,-1],{bias:.027});
      for(let i=1;i<5;i++){const x=mix(x0+.025,x1-.025,i/5);line(mesh,[[x,y,-2.508],[x,y+h,-2.496]],'#672e3a70',.007,{normal:[0,0,-1],bias:.035});}
    }
    facing(mesh,[[s*.49,.714,-2.502],[s*.37,.714,-2.502],[s*.37,.77,-2.496],[s*.49,.77,-2.496]],'#b8b8ad',[0,0,-1],{bias:.025});
    for(const k of [0,1]){
      const c=s*(.632+k*.225);
      facing(mesh,[[c-.104,.69,2.519],[c+.104,.69,2.519],[c+.104,.94,2.49],[c-.104,.94,2.49]],'#282e38',[0,0,1]);
      facing(mesh,[[c-.084,.715,2.526],[c+.084,.715,2.526],[c+.084,.914,2.502],[c-.084,.914,2.502]],parked?'#b5b5a4':'#eed8ad',[0,0,1],{bias:.013});
      facing(mesh,[[c-.064,.735,2.529],[c+.064,.735,2.529],[c+.064,.886,2.512],[c-.064,.886,2.512]],parked?'#c4c0ac':'#fff0cb',[0,0,1],{bias:.022});
      for(const dx of [-.04,.02])line(mesh,[[c+dx,.728,2.535],[c+dx,.902,2.513]],'#87929455',.008,{normal:[0,0,1],bias:.03});
    }
    facing(mesh,[[s*.6,.567,2.528],[s*.92,.567,2.528],[s*.92,.626,2.519],[s*.6,.626,2.519]],parked?'#a78b67':'#e8b876',[0,0,1],{bias:.017});
  }
}
function openDoor(mesh, amount) {
  // Left-front leaf, front-hinged. The static door is covered by the dark jamb;
  // only the leaf rotates, and the mirror is intentionally body-mounted.
  if(amount<=.002)return;
  const angle=amount*1.08,co=Math.cos(angle),si=Math.sin(angle);
  const hinge=[-1.019,0,1.10];
  const local=p=>{const dx=p[0]-hinge[0],dz=p[2]-hinge[2];return[hinge[0]+dx*co+dz*si,p[1],hinge[2]-dx*si+dz*co];};
  side(mesh,-1,[[.46,.26],[1.065,.26],[1.065,1.065],[.46,1.065]],'#242b35',{x:1.04,bias:.035});
  const leaf=[];leaf.layer=mesh.layer;
  side(leaf,-1,[[.45,.245],[1.065,.245],[1.065,1.10],[.45,1.10]],MAT.body,{x:1.035});
  side(leaf,-1,[[.82,.26],[.95,.26],[.95,1.08],[.82,1.08]],MAT.wood,{x:1.04});
  const glass=[[-.93,1.10,.265],[-.93,1.10,1.04],[-.842,1.50,.66],[-.842,1.50,.265]];
  face(leaf,glass,'#42515c92',{normal:[-1,.2,0],double:true});
  line(leaf,[...glass,glass[0]],'#c5b09c',.033,{normal:[-1,.2,0],double:true});
  side(leaf,1,[[.48,.26],[1.055,.26],[1.055,1.08],[.48,1.08]],'#665353',{x:-1.026});
  line(leaf,[[-1.022,.83,.44],[-1.022,.83,.83]],'#baa18d',.033,{double:true});
  line(leaf,[[-1.049,.978,.90],[-1.049,.978,1.04]],'#d1bdab',.023,{double:true});
  for(const f of leaf)mesh.push({...f,points:f.points.map(local),center:undefined,normal:f.normal?[f.normal[0]*co+f.normal[2]*si,f.normal[1],-f.normal[0]*si+f.normal[2]*co]:undefined});
}
function driver(mesh) {
  // Seated occupant in the driver's seat; no silhouette floats on the glass.
  ellipsoid(mesh,[-.46,1.33,.53],[.087,.115,.09],MAT.skin,10,5);
  ellipsoid(mesh,[-.46,1.365,.519],[.091,.087,.092],MAT.hair,10,4,p=>p[1]>1.37||p[2]<.50);
  shell(mesh,[ovalRing(-.46,.86,.43,.17,.12),ovalRing(-.46,1.19,.45,.19,.115),ovalRing(-.46,1.24,.47,.075,.07)],MAT.jacket);
  for(const side of [-1,1]){
    const a=[-.46+side*.18,1.17,.48],b=[-.46+side*.22,1.03,.68],c=[-.46+side*.14,1.09,.85];
    tube(mesh,a,b,.061,.046,MAT.jacket);tube(mesh,b,c,.048,.036,MAT.jacket);
    ellipsoid(mesh,c,[.039,.037,.045],MAT.skin,8,4);
  }
  const wheelRing=Array.from({length:25},(_,i)=>{const a=i/24*TAU;return[-.46+Math.cos(a)*.17,1.04+Math.sin(a)*.13,.91-Math.sin(a)*.075];});
  line(mesh,wheelRing,'#292c34',.025,{double:true});
}

// The stance part retreats exactly one metre per metre of root displacement.
// Thus its planted foot is stationary in the world in a straight walk. Swing
// is a cubic with matching endpoint velocity, not a pair of pendulum legs.
const STRIDE=1.10, STANCE=.60;
function footAt(phase, weight) {
  const p=((phase%1)+1)%1;
  if(p<STANCE)return{z:(STRIDE*STANCE/2-STRIDE*p)*weight,lift:0};
  const t=(p-STANCE)/(1-STANCE),t2=t*t,t3=t2*t;
  const start=-STRIDE*STANCE/2,end=-start,slope=-STRIDE*(1-STANCE);
  return{z:((2*t3-3*t2+1)*start+(t3-2*t2+t)*slope+(-2*t3+3*t2)*end+(t3-t2)*slope)*weight,lift:Math.sin(Math.PI*t)**2*.14*weight};
}
function knee(hip, ankle) {
  const dy=ankle[1]-hip[1],dz=ankle[2]-hip[2],d=Math.hypot(dy,dz),a=.44,b=.445;
  const l=clamp(d,.05,a+b-.0001),along=(a*a-b*b+l*l)/(2*l),bend=Math.sqrt(Math.max(0,a*a-along*along));
  return[hip[0],hip[1]+dy/d*along+dz/d*bend,hip[2]+dz/d*along-dy/d*bend];
}
function shoe(mesh,x,lift,z) {
  const outline=[[-.065,-.10],[.055,-.10],[.071,.125],[.045,.182],[-.051,.182],[-.074,.115]];
  const rings=[[.012,1],[.06,1],[.125,.82]].map(([y,k])=>outline.map(([X,Z])=>[x+X*k,y+lift,z+Z*k]));
  shell(mesh,rings,{color:'#705547',shade:true});
  shell(mesh,rings.slice(0,2).map(r=>r.map(p=>[p[0]*1,p[1]-.006,p[2]])),'#2b3038');
  for(let j=0;j<3;j++)line(mesh,[[x-.037,.13+lift,z+.025+j*.027],[x+.037,.13+lift,z+.025+j*.027]],'#b09a7b',.008,{normal:[0,1,0]});
}
function traveler(s) {
  const m=[],p=s.person, speed=Math.abs(p.speed??s.speed??0),settle=clamp(speed/.08,0,1),weight=settle*settle*(3-2*settle);
  const phase=((p.stride||0)/STRIDE)%1, a=phase*TAU, hipY=mix(.98,.95-.025*Math.cos(a*2),weight);
  const sway=Math.sin(a)*.014*weight,twist=Math.sin(a)*.06*weight;
  const body=p=>[p[0]*Math.cos(twist)+p[2]*Math.sin(twist)+sway,p[1]+hipY-.98,-p[0]*Math.sin(twist)+p[2]*Math.cos(twist)];
  for(const sign of [-1,1]) {
    const f=footAt(phase+(sign>0?.5:0),weight),x=sign*.105;
    const h=[x+sway,hipY,0],ank=[x,.105+f.lift,f.z],k=knee(h,ank);
    tube(m,h,k,.105,.073,MAT.jeans,10,.85);
    tube(m,k,ank,.076,.052,MAT.jeans,10,.9);
    ellipsoid(m,k,[.070,.073,.071],MAT.jeans,10,4);
    line(m,[[h[0]+sign*.073,h[1],h[2]],[k[0]+sign*.065,k[1],k[2]],[ank[0]+sign*.045,ank[1]+.025,ank[2]]],'#91a1a22d',.008,{double:true});
    shoe(m,x,f.lift,f.z);
  }
  // Pelvis and closed jacket retain volume under sway; hem never opens a gap.
  shell(m,[ovalRing(sway,hipY-.06,0,.17,.115),ovalRing(sway,hipY+.055,0,.17,.125)],MAT.jeans);
  shell(m,[ovalRing(0,.99,0,.18,.135,12),ovalRing(0,1.12,0,.17,.125,12),ovalRing(0,1.38,0,.225,.13,12),ovalRing(0,1.47,0,.175,.10,12),ovalRing(0,1.49,0,.077,.067,12)].map(r=>r.map(body)),MAT.jacket);
  const details=[];
  line(details,[[-.17,1.035,.09],[0,1.025,.135],[.17,1.035,.09]],'#d2a886',.013,{normal:[0,0,1]});
  line(details,[[0,1.03,.14],[0,1.40,.136],[0,1.47,.078]],'#655144',.012,{normal:[0,0,1]});
  face(details,[[-.067,1.49,.068],[-.12,1.445,.115],[-.055,1.38,.143],[0,1.43,.12]],'#c8aa87',{normal:[0,0,1]});
  face(details,[[.067,1.49,.068],[.12,1.445,.115],[.055,1.38,.143],[0,1.43,.12]],'#c8aa87',{normal:[0,0,1]});
  for(const sign of [-1,1]){
    line(details,[[sign*.13,1.30,.139],[sign*.035,1.30,.141],[sign*.045,1.21,.144],[sign*.12,1.21,.143]],'#775847',.007,{normal:[0,0,1]});
    // Backpack straps follow the shoulders, with a small brass adjuster.
    line(details,[[sign*.155,1.43,-.075],[sign*.18,1.43,.045],[sign*.15,1.32,.137],[sign*.125,1.12,.13]],'#44534d',.034,{double:true});
    line(details,[[sign*.14,1.22,.149],[sign*.13,1.18,.149]],'#bea27a',.026,{normal:[0,0,1]});
  }
  for(const f of details)m.push({...f,points:f.points.map(body),center:undefined,normal:f.normal?transformDirection(f.normal,{heading:twist}):undefined});
  // Small canvas pack, shaped flap, patch and seams; visible in the chase view.
  const pack=[];
  shell(pack,[ovalRing(0,1.065,-.185,.146,.075,10),ovalRing(0,1.30,-.205,.17,.085,10),ovalRing(0,1.405,-.175,.145,.072,10)],MAT.bag);
  face(pack,[[-.14,1.39,-.235],[.14,1.39,-.235],[.13,1.28,-.294],[.07,1.255,-.299],[-.10,1.265,-.299],[-.14,1.30,-.29]],'#718075',{normal:[0,0,-1]});
  line(pack,[[-.12,1.10,-.255],[.12,1.10,-.255],[.12,1.22,-.288],[-.12,1.22,-.288],[-.12,1.10,-.255]],'#9c9e8555',.008,{normal:[0,0,-1]});
  face(pack,[[-.034,1.295,-.301],[.034,1.295,-.301],[.034,1.34,-.277],[-.034,1.34,-.277]],'#d1ad75',{normal:[0,0,-1]});
  line(pack,[[-.042,1.40,-.167],[-.04,1.45,-.16],[.04,1.45,-.16],[.042,1.40,-.167]],'#34463f',.018,{double:true});
  for(const f of pack)m.push({...f,points:f.points.map(body),center:undefined,normal:f.normal?transformDirection(f.normal,{heading:twist}):undefined});
  for(const sign of [-1,1]){
    const armPhase=a+(sign>0?Math.PI:0),swing=-Math.cos(armPhase)*.47*weight;
    const sh=body([sign*.224,1.405,0]);
    const el=[sh[0]+sign*.022,sh[1]-.295*Math.cos(swing),sh[2]+.295*Math.sin(swing)];
    const fore=swing+.26+.07*Math.sin(armPhase)*weight;
    const wrist=[el[0]+sign*.006,el[1]-.255*Math.cos(fore),el[2]+.255*Math.sin(fore)];
    ellipsoid(m,sh,[.071,.075,.076],MAT.jacket,10,4);
    tube(m,sh,el,.078,.059,MAT.jacket,8);
    tube(m,el,wrist,.061,.040,MAT.jacket,8);
    ellipsoid(m,el,[.059,.06,.057],MAT.jacket,8,4);
    const cuff=lerp3(el,wrist,.9);tube(m,cuff,wrist,.045,.044,{color:'#735c4d',shade:true},8);
    const hand=[wrist[0],wrist[1]-.055*Math.cos(fore),wrist[2]+.055*Math.sin(fore)];
    ellipsoid(m,hand,[.039,.068,.036],MAT.skin,8,5);
    ellipsoid(m,[hand[0]-sign*.027,hand[1]+.019,hand[2]+.022],[.021,.033,.021],MAT.skin,8,4);
  }
  const head=body([0,1.647,.009]);
  tube(m,body([0,1.46,0]),body([0,1.565,.008]),.053,.05,MAT.skin,10);
  ellipsoid(m,head,[.087,.121,.101],MAT.skin,14,8);
  ellipsoid(m,[head[0],head[1]+.041,head[2]-.008],[.093,.087,.106],MAT.hair,14,6,q=>q[1]>head[1]+.052||q[2]<head[2]-.015);
  for(const sign of [-1,1])ellipsoid(m,[head[0]+sign*.085,head[1]-.006,head[2]],[.016,.034,.024],MAT.skin,8,4);
  const faceParts=[];
  face(faceParts,[[-.017,1.654,.105],[.017,1.654,.105],[.018,1.609,.118],[0,1.616,.139],[-.018,1.609,.118]],{color:'#c69477',shade:true},{normal:[0,0,1]});
  for(const sign of [-1,1]){
    line(faceParts,[[sign*.019,1.668,.103],[sign*.052,1.668,.094]],'#493d39',.008,{normal:[0,0,1]});
    line(faceParts,[[sign*.025,1.654,.108],[sign*.045,1.652,.102]],'#3c3c3c',.006,{normal:[0,0,1]});
  }
  line(faceParts,[[-.025,1.591,.103],[0,1.588,.11],[.025,1.591,.103]],'#865e50',.006,{normal:[0,0,1]});
  for(const f of faceParts)m.push({...f,points:f.points.map(body),center:undefined,normal:f.normal?transformDirection(f.normal,{heading:twist}):undefined});
  return m;
}

function colorLit(mat,n) {
  if(!mat.shade)return mat.color;
  const rgb=mat.rgb||(mat.rgb=mat.color.match(/[0-9a-f]{2}/gi).map(x=>parseInt(x,16)));
  const light=Math.max(0,dot(n,[-.76,.62,-.19])),up=Math.max(0,n[1]);
  return `rgb(${rgb.map((v,i)=>clamp(Math.round(v*(.63+light*.38+up*.12)+[14,10,15][i]+light*[9,2,-3][i]),0,255)).join(',')})`;
}
function projectSafe(P,p) {
  const q=P.project(p[0],p[1],p[2]);
  return q&&Number.isFinite(q.x)&&Number.isFinite(q.y)?q:null;
}
function clipped(P,world,closed) {
  const out=[],ps=world.map(p=>projectSafe(P,p));
  const n=closed?world.length:world.length-1;
  for(let i=0;i<n;i++){
    const j=(i+1)%world.length,a=world[i],b=world[j],pa=ps[i],pb=ps[j];
    if(pa)out.push({p:a,q:pa});
    if(Boolean(pa)!==Boolean(pb)){
      let good=pa?a:b,bad=pa?b:a;
      for(let k=0;k<14;k++){const mid=lerp3(good,bad,.5);if(projectSafe(P,mid))good=mid;else bad=mid;}
      const q=projectSafe(P,good);if(q)out.push({p:good,q});
    }
  }
  if(!closed&&ps[ps.length-1])out.push({p:world[world.length-1],q:ps[ps.length-1]});
  return out;
}
function enqueue(queue,mesh,actor,P,eye) {
  const co=Math.cos(actor.heading||0),si=Math.sin(actor.heading||0),dx=eye[0]-actor.x,dz=eye[2]-actor.z;
  const localEye=[dx*co-dz*si,eye[1],dx*si+dz*co];
  for(const f of mesh){
    const fn=f.normal||(f.points.length>2?normal(f.points):[0,1,0]);
    const fc=f.center||center(f.points);
    if(!f.double&&dot(fn,V(localEye,fc))<=0)continue;
    const world=f.points.map(p=>transformPoint(p,actor));
    const n=unit(transformDirection(fn,actor));
    const pts=clipped(P,world,f.kind==='face');
    if(pts.length<(f.kind==='face'?3:2))continue;
    if(P.w&&P.h&&(pts.every(v=>v.q.x< -4)||pts.every(v=>v.q.x>P.w+4)||pts.every(v=>v.q.y< -4)||pts.every(v=>v.q.y>P.h+4)))continue;
    const depth=pts.reduce((sum,v)=>sum+(Number.isFinite(v.q.depth)?v.q.depth:Math.hypot(...V(v.p,eye))),0)/pts.length;
    const scale=pts.reduce((sum,v)=>sum+(Number.isFinite(v.q.k)?v.q.k:(P.focal||700)/Math.max(.2,depth)),0)/pts.length;
    queue.push({...f,pts:pts.map(v=>v.q),depth:depth-(f.bias||0),scale,color:colorLit(f.mat,n)});
  }
}
function drawItem(ctx,f){
  const p=f.pts;
  if(f.kind==='text'){
    if(p.length!==3)return;
    const u=V([p[1].x,p[1].y,0],[p[0].x,p[0].y,0]),v=V([p[2].x,p[2].y,0],[p[0].x,p[0].y,0]);
    if(Math.hypot(v[0],v[1])<3)return;
    ctx.save();ctx.transform(u[0]/240,u[1]/240,v[0]/24,v[1]/24,p[0].x,p[0].y);
    ctx.font='600 20px ui-monospace, monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=f.color;ctx.fillText(f.text,120,12,234);ctx.restore();return;
  }
  ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)ctx.lineTo(p[i].x,p[i].y);
  if(f.kind==='line'){
    ctx.strokeStyle=f.color;ctx.lineWidth=Math.max(.45,Math.min(28,f.width*f.scale));ctx.stroke();return;
  }
  ctx.closePath();ctx.fillStyle=f.color;
  // Same-color subpixel bleed joins the shared opaque facets. No bright wire
  // seams on hair, knees or tires; translucent glazing must not be expanded.
  if(f.mat.shade){ctx.strokeStyle=f.color;ctx.lineWidth=.55;ctx.stroke();}
  if(f.mat.grad){
    let top=Infinity,bottom=-Infinity;for(const q of p){top=Math.min(top,q.y);bottom=Math.max(bottom,q.y);}
    if(bottom-top>2){
      const g=ctx.createLinearGradient(0,top,0,bottom);
      g.addColorStop(0,f.color);g.addColorStop(1,f.color);ctx.fillStyle=g;
      ctx.fill();const sheen=ctx.createLinearGradient(0,top,0,bottom);
      sheen.addColorStop(0,`rgba(244,196,168,${f.mat.grad})`);sheen.addColorStop(.43,'rgba(165,140,149,0)');sheen.addColorStop(1,`rgba(15,27,40,${f.mat.grad})`);
      ctx.fillStyle=sheen;ctx.fill();return;
    }
  }
  ctx.fill();
}
function shadow(ctx,P,actor,rx,rz,opacity){
  // Nested world-space contact washes, not blurred camera-facing ellipses.
  for(let j=0;j<4;j++){
    const k=1+j*.12,poly=Array.from({length:28},(_,i)=>{const a=i/28*TAU;return transformPoint([Math.cos(a)*rx*k,.008,Math.sin(a)*rz*k],actor);});
    const p=clipped(P,poly,true);if(p.length<3)continue;
    ctx.beginPath();ctx.moveTo(p[0].q.x,p[0].q.y);for(let i=1;i<p.length;i++)ctx.lineTo(p[i].q.x,p[i].q.y);ctx.closePath();ctx.fillStyle=`rgba(16,22,31,${opacity/(j+2)})`;ctx.fill();
  }
}

/** Draw after terrain, instead of the first-person cabin. Never changes s/P.
 * P.project(X,Y,Z) -> {x,y,depth?,k?}|null; P.worldX/worldZ/eye are camera
 * world metres. P.w/h/focal are optional (culling and subpixel stroke scale).
 * Person is drawn iff s.onFoot; the parked wagon is always world-positioned.
 * Actors are depth-sorted in world space. Within the car, opaque shell layers
 * precede coplanar trim/glass so a long side panel cannot erase its own lamps.
 */
export function drawActors(ctx,P,s) {
  if(!ctx||typeof P?.project!=='function'||!s)return;
  const car=s.car,person=s.person;
  const valid=a=>a&&Number.isFinite(a.x)&&Number.isFinite(a.z);
  const eye=[P.worldX??0,typeof P.eye==='number'?P.eye:3,P.worldZ??0];
  const queue=[];ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  try{
    if(valid(car)){
      shadow(ctx,P,car,.93,2.38,.22);
      const moving=[];moving.layer=1;
      const spin=wheelSpin(car);
      for(const side of [-1,1])for(const z of [-1.54,1.54]){
        wheel(moving,side,z,clamp(s.steer||0,-1,1),spin);
        const c={x:car.x+(side*.935)*Math.cos(car.heading||0)+z*Math.sin(car.heading||0),z:car.z-(side*.935)*Math.sin(car.heading||0)+z*Math.cos(car.heading||0),heading:car.heading};
        shadow(ctx,P,c,.15,.27,.22);
      }
      moving.layer=4.3;lamps(moving,!!s.braking,!!s.onFoot);
      const localEyeX=(eye[0]-car.x)*Math.cos(car.heading||0)-(eye[2]-car.z)*Math.sin(car.heading||0);
      moving.layer=localEyeX>.1?1.5:7;openDoor(moving,clamp(s.door||0,0,1));
      if(!s.onFoot){moving.layer=0;driver(moving);}
      enqueue(queue,s.door>.002?CAR.filter(f=>!f.doorFixed):CAR,car,P,eye);enqueue(queue,moving,car,P,eye);
      const q=projectSafe(P,[car.x,.8,car.z]),depth=q?.depth??Math.hypot(car.x-eye[0],car.z-eye[2]);
      for(const f of queue){f.actor=0;f.actorDepth=depth;}
    }
    if(s.onFoot&&valid(person)){
      shadow(ctx,P,person,.27,.31,.17);
      const first=queue.length;
      enqueue(queue,traveler(s),person,P,eye);
      const q=projectSafe(P,[person.x,.8,person.z]),depth=q?.depth??Math.hypot(person.x-eye[0],person.z-eye[2]);
      for(let i=first;i<queue.length;i++){queue[i].actor=1;queue[i].actorDepth=depth;}
    }
    queue.sort((a,b)=>a.actor!==b.actor?b.actorDepth-a.actorDepth:a.actor===0?(a.layer-b.layer||b.depth-a.depth):b.depth-a.depth);
    for(const f of queue)drawItem(ctx,f);
  }finally{ctx.restore();}
}
