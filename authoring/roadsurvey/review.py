"""Produce station/lateral review strips from a federal ortho; no runtime imagery."""
from pathlib import Path
import json, math, subprocess
from PIL import Image,ImageDraw
import numpy as np
root=Path(__file__).resolve().parents[2];out=root/'evidence/round-03';out.mkdir(parents=True,exist_ok=True)
photo=Image.open(Path(__file__).with_name('naip2023-reference.jpg')).convert('RGB');assert photo.size==(1380,3400)
# 0.5m output pixels; input extent in WGS84 UTM17N. Local grid convergence ~0.097 degrees.
st=list(range(-80,1581)); lanes=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {routeAt} from './play/route.js';console.log(JSON.stringify(Array.from({length:1661},(_,i)=>routeAt(i-80))))"],cwd=root))
ar=np.array(photo); band=np.zeros((3322,440,3),np.uint8);theta=math.radians(.0973);co=math.cos(theta)*.9996;si=math.sin(theta)*.9996
for y in range(3322):
 s=1580-y*.5;i=int(s+80);u=(s+80-i);i=max(0,i);p=lanes[i];q=lanes[min(i+1,len(lanes)-1)];x=(1-u)*p['x']+u*q['x'];z=(1-u)*p['z']+u*q['z'];h=p['heading'];lat=np.arange(440)/2-110
 X=x+lat*np.cos(h);Z=z-lat*np.sin(h);ix=((519920.671+co*X-si*Z-519490)*2).astype(int);iy=((3160090-3158520.489-si*X-co*Z)*2).astype(int);band[y]=ar[np.clip(iy,0,3399),np.clip(ix,0,1379)]
b=Image.fromarray(band);b.save(out/'road-strip.jpg',quality=96)
d=Image.new('RGB',(440*3,1120),'#191921');d1=ImageDraw.Draw(d)
for i in range(3):
 lo=i*550;hi=lo+550;tile=b.crop((0,(1580-hi)*2,440,(1580-lo)*2));d.paste(tile,(i*440,20));d1.text((i*440+2,2),f'stations {hi} -> {lo}; x=-110..+110',fill='white');
 for s in range(lo,hi+1,25):
  y=20+(hi-s)*2;d1.text((i*440+2,y),str(s),fill='#ffcd4b');d1.line((i*440+198,y,i*440+201,y),fill='#ffcd4b')
d.save(out/'strip-guide.jpg',quality=95)
