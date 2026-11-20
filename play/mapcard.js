import {routeAt,JUNCTIONS} from './route.js';
import {DRIVE_START,DRIVE_END,PARKS,PIER,bankAt} from './riverfront.js';
import {section} from './us1.js';

const stations = [];
for (let z=DRIVE_START; z<DRIVE_END; z+=8) stations.push(z);
stations.push(DRIVE_END);
const trace = (z,x) => routeAt(z,x);
const highway = stations.map(z => trace(z,-1.83));
const southbound = stations.map(z => trace(z,section(z).w+4.05));
const shore = stations.map(z => trace(z,bankAt(z)));
const world = ([x,z]) => trace(z,x);
const parks = PARKS.map(park => park.pavement.map(world));
const pier = PIER.map(world);
const all = [...highway,...southbound,...shore,...pier,...JUNCTIONS.flatMap(j=>j.geometry.map(([x,z])=>({x,z})))];
const x0=Math.min(...all.map(p=>p.x)),x1=Math.max(...all.map(p=>p.x));
const z0=Math.min(...all.map(p=>p.z)),z1=Math.max(...all.map(p=>p.z));

export function mapDraw(canvas,s) {
  const g=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  const scale=Math.min((w-52)/(x1-x0),(h-30)/(z1-z0));
  const xy=({x,z})=>[w*.43+(x-(x0+x1)/2)*scale,h/2-(z-(z0+z1)/2)*scale];
  const path=(points,color,width,fill=false)=>{
    g.beginPath();
    points.forEach((p,i)=>i?g.lineTo(...xy(p)):g.moveTo(...xy(p)));
    if(fill){g.fillStyle=color;g.fill();return}
    g.strokeStyle=color;g.lineWidth=width;g.stroke();
  };
  g.fillStyle='#26333b';g.fillRect(0,0,w,h);
  path([trace(DRIVE_START,-2400),...shore,trace(DRIVE_END,-2400)],'#3b4c48',0,true);
  path(shore,'#71897f',1);
  for(const j of JUNCTIONS)path(j.geometry.map(([x,z])=>({x,z})),'#a5b1a4',1.5);
  path(southbound,'#a5b1a4',2);
  path(highway,'#e8b98b',4);
  for(const p of parks)path(p,'#e8b98b',0,true);
  path([pier[0],pier[1]],'#e8b98b',1.5);
  g.font='16px system-ui';
  g.fillStyle='#fdd1a0';
  for(const p of PARKS){
    const [x,y]=xy(trace(p.station,32));
    g.fillText(p.name,x+10,Math.max(21,Math.min(h-12,y+6)));
  }
  const [x,y]=xy(s.listener);
  g.beginPath();g.arc(x,y,5.5,0,Math.PI*2);
  g.fillStyle='#91e7df';g.fill();
  g.lineWidth=2;g.strokeStyle='#192e34';g.stroke();
}
