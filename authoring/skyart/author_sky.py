"""Northbound Afterglow / original offline matte and exhaust brush.

Run with Python + Pillow + numpy. No source imagery, web access or inference.
The artwork is a cylindrical sky sheet: azimuth -1.35..2.25 radians;
vertical tangent elevation 1.00..-.035. Runtime projects it through the lens.

Look: open violet above; oyster-pink twilight on a flat coastal horizon;
large slate/lilac cumulus banks, warm torn edges, small distant coral strata.
Clouds are fixed-seed density paintings, not animated screen-space noise.
"""
from pathlib import Path
from typing import Any
import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "play" / "skyart"
W, H = 4096, 1280
AZ0, AZ1, TOP, BOTTOM = -1.35, 2.25, 1.00, -.035
rng = np.random.default_rng(271828)
X, Y = np.meshgrid(np.linspace(AZ0, AZ1, W, dtype=np.float32),
                   np.linspace(TOP, BOTTOM, H, dtype=np.float32))


def noise(w, h, gx, gy, seed):
    r = np.random.default_rng(seed)
    a = (r.random((max(2, gy), max(2, gx))) * 255).astype('uint8')
    return np.asarray(Image.fromarray(a).resize((w, h), Image.Resampling.BICUBIC), dtype=np.float32) / 255


def smooth(a, b, v):
    t = np.clip((v-a)/(b-a), 0, 1)
    return t*t*(3-2*t)


def over(canvas, col, alpha):
    canvas *= 1-alpha[..., None]
    canvas += col*alpha[..., None]


# Pigment: long-scale atmospheric wash, sub-pixel tooth baked into the sheet.
n0 = noise(W, H, 13, 8, 1)
n1 = noise(W, H, 41, 26, 2)
n2 = noise(W, H, 113, 74, 3)
n3 = noise(W, H, 287, 172, 4)
n4 = noise(W, H, 663, 390, 5)
levels = np.array([-.035, .0, .035, .095, .20, .37, .60, 1.0])
colors = np.array([[240,168,119], [245,177,128], [233,168,151],
                   [202,147,157], [141,124,156], [80,91,132],
                   [40,58,96], [20,35,65]], dtype=np.float32)
canvas = np.stack([np.interp(Y, levels, colors[:,i]) for i in range(3)], axis=-1).astype('float32')
# The west (left) holds the last apricot light; the east deepens into blue.
west = np.exp(-((X+.77)/.94)**2) * np.exp(-((Y-.10)/.22)**2)
canvas += west[...,None]*np.array([12, 4, -4], dtype='float32')
east = smooth(.4, 2.1, X)*smooth(.02,.40,Y)
canvas += east[...,None]*np.array([-4, 2, 8], dtype='float32')
tooth=1-smooth(.73,.99,Y)
canvas += (((n0-.5)*3.0+(n2-.5)*.8+(n4-.5)*1.6)*tooth)[...,None]

# Far cirrus, sparsely painted. No prominent parallel stripe pattern.
for j, (cx,cy,rx,ry,lean) in enumerate([
    (-.55,.43,.75,.024,.036), (.36,.50,.58,.019,-.028),
    (.99,.60,.72,.014,.022), (-.95,.66,.45,.012,-.02),
    (.75,.30,.48,.008,.025), (1.79,.42,.44,.022,.040)]):
    ridge = Y-cy-lean*(X-cx)-.009*np.sin(X*8+j)
    field = np.exp(-((X-cx)/rx)**4-(ridge/ry)**2)
    threads = noise(W,H,29+j*3,177+j*5,60+j)
    alpha=field*np.clip((n1*.45+threads*.55-.43)*.19,0,.075)
    tint=np.array([196,163,181] if cy>.4 else [232,176,166],dtype='float32')
    over(canvas,tint,alpha)

# Each bank is a smooth-union mass with a deliberately asymmetric tower plan.
# Features are in azimuth/elevation units, not screen positions.
banks: list[dict[str, Any]] = [
    # distant west shoals
    dict(seed=31, opacity=.48, shadow=[111,107,133], light=[229,158,144],
         lobes=[(-1.12,.069,.26,.035),(-.87,.078,.22,.045),(-.59,.058,.29,.033),(-.28,.055,.23,.020),(.02,.041,.20,.016)]),
    # distant east anvils, nearly lost in the air
    dict(seed=41, opacity=.58, shadow=[117,116,142], light=[235,174,154],
         lobes=[(.44,.067,.25,.030),(.71,.089,.24,.047),(.96,.060,.29,.030),(1.23,.070,.33,.043),(1.60,.091,.25,.044),(1.89,.058,.40,.033)]),
    # long broken pink cloud at lower-left, underneath the main formation
    dict(seed=52, opacity=.80, shadow=[99,94,124], light=[241,171,149],
         lobes=[(-1.28,.130,.34,.058),(-.99,.141,.28,.063),(-.74,.131,.25,.048),(-.49,.110,.23,.039),(-.25,.108,.18,.029),(-.08,.092,.14,.023)]),
    # hero west bank: broad anvil, rising turrets, low ragged shelf
    dict(seed=72, opacity=.98, shadow=[51,61,91], light=[211,149,156],
         lobes=[(-1.27,.262,.40,.105),(-.98,.305,.32,.131),(-.71,.288,.29,.109),
                (-.82,.367,.19,.127),(-.57,.306,.18,.082),(-.39,.258,.19,.069),
                (-.22,.237,.15,.048),(-.08,.217,.10,.026),(-.74,.230,.50,.064),
                (-1.10,.386,.23,.076)]),
    # eastern bank frames the climb without filling the open central window
    dict(seed=93, opacity=.96, shadow=[55,66,97], light=[217,157,168],
         lobes=[(.91,.172,.27,.065),(1.10,.210,.21,.093),(1.29,.251,.26,.126),
                (1.52,.307,.21,.158),(1.77,.270,.32,.131),(1.97,.209,.31,.078),
                (1.12,.146,.39,.060),(2.20,.186,.27,.100)]),
]

for bank in banks:
    # Restrict work to occupied pixels; the large empty sky remains clean.
    lobes=bank['lobes']
    lo=min(cx-rx*1.22 for cx,cy,rx,ry in lobes)
    hi=max(cx+rx*1.22 for cx,cy,rx,ry in lobes)
    bottom=min(cy-ry*1.4 for cx,cy,rx,ry in lobes)
    top=max(cy+ry*1.4 for cx,cy,rx,ry in lobes)
    x0=max(0,int((lo-AZ0)/(AZ1-AZ0)*W)); x1=min(W,int((hi-AZ0)/(AZ1-AZ0)*W)+1)
    y0=max(0,int((TOP-top)/(TOP-BOTTOM)*H)); y1=min(H,int((TOP-bottom)/(TOP-BOTTOM)*H)+1)
    xx,yy=X[y0:y1,x0:x1],Y[y0:y1,x0:x1]
    hh,ww=xx.shape
    seed=bank['seed']
    a=noise(ww,hh,max(5,int(ww/95)),max(4,int(hh/64)),seed)
    b=noise(ww,hh,max(8,int(ww/31)),max(5,int(hh/29)),seed+1)
    c=noise(ww,hh,max(8,int(ww/11)),max(5,int(hh/10)),seed+2)
    d=noise(ww,hh,max(8,int(ww/4)),max(5,int(hh/5)),seed+3)
    # Warp the outline and the internal lobes together, not just a noisy border.
    wx=xx+(a-.5)*.040+(b-.5)*.013
    wy=yy+(a-.5)*.024+(b-.5)*.014+(c-.5)*.0045
    dist=np.full_like(xx,-8)
    relief=np.zeros_like(xx)
    for cx,cy,rx,ry in lobes:
        q=((wx-cx)/rx)**2+((wy-cy)/ry)**2
        shape=1-np.sqrt(q)
        # Soft maximum: merges bulb bases into one coherent shelf.
        k=.12
        h=np.clip(.5+.5*(shape-dist)/k,0,1)
        dist=dist*(1-h)+shape*h+k*h*(1-h)
        relief+=np.exp(-q*2.0)
    fractal=(a-.5)*.20+(b-.5)*.21+(c-.5)*.085+(d-.5)*.020
    density=dist+fractal
    alpha=smooth(-.045,.030,density)*bank['opacity']
    # A thickness/relief field gives large planes of light and cool core shadow.
    height=np.sqrt(np.clip(density+.10,0,1.5))*.55+(b-.5)*.10+(c-.5)*.035
    dy,dx=np.gradient(height)
    face=np.clip(.48-dx*24-dy*35,0,1)
    broad=np.clip(.31+(a-.5)*.70+(b-.5)*.32+face*.32,0,1)
    rim=np.exp(-np.maximum(density,0)*23)*(0.24+face*.70)
    # Cloud tops see the last light, undersides retain slate rather than charcoal.
    ymax=max(cy+ry for cx,cy,rx,ry in lobes)
    ymin=min(cy-ry for cx,cy,rx,ry in lobes)
    topLight=smooth(ymin,ymax,yy)
    warm=np.clip(broad*.62+rim*.42+topLight*.15,0,1)
    shade=np.array(bank['shadow'],dtype='float32')
    lit=np.array(bank['light'],dtype='float32')
    pigment=shade+(lit-shade)*warm[...,None]
    # Large, softly broken brush planes; no per-frame shimmer or circular dabs.
    pigment+=(c-.5)[...,None]*np.array([5.2,4.5,5.6])
    pigment+=(d-.5)[...,None]*2.8
    over(canvas[y0:y1,x0:x1],pigment,alpha)

# Low scumbled wisps and warm gaps near the coast, not a solid horizon cloud line.
for j,(cx,cy,rx) in enumerate([(-.83,.021,.33),(-.27,.027,.18),(.23,.025,.22),(.63,.019,.30),(1.29,.024,.26),(1.92,.035,.40)]):
    ridge=(Y-cy-.003*np.sin(X*22+j))/.005
    mask=np.exp(-((X-cx)/rx)**4-ridge*ridge)
    mask*=np.clip((n3-.24)*.45,0,.26)
    over(canvas,np.array([145,117,141],dtype='float32'),mask)

# Minimal tooth belongs to the painting, never to a flickering final-pass overlay.
canvas += (rng.random((H,W,1),dtype=np.float32)-.5)*1.10*tooth[...,None]
Image.fromarray(np.uint8(np.clip(canvas,0,255)), 'RGB').save(OUT/'dusk-matte.png', optimize=True)

# Exhaust pigment atlas: volumetric irregular tufts with connected ragged edges.
# Runtime overlaps these at <1/4 of their width along a continuous backbone.
S=160
atlas=Image.new('RGBA',(S*4,S*3))
for j in range(12):
    yy,xx=np.mgrid[-1:1:complex(S),-1:1:complex(S)].astype('float32')
    a=noise(S,S,5,5,200+j*7)
    b=noise(S,S,12,12,201+j*7)
    c=noise(S,S,31,29,202+j*7)
    ex=xx+(a-.5)*.24; ey=yy+(b-.5)*.17
    r=np.sqrt((ex/0.88)**2+(ey/0.84)**2)
    field=1-r+(a-.5)*.28+(b-.5)*.23+(c-.5)*.08
    alpha=smooth(-.035,.24,field)*np.clip(.64+a*.40+b*.12,0,1)
    relief=np.sqrt(np.clip(field,0,1))*.58+(a-.5)*.16+(b-.5)*.12
    dy,dx=np.gradient(relief)
    light=np.clip(.57-dx*15-dy*19+(a-.5)*.3,0,1)
    warm=np.clip(.19+light*.75,0,1)
    col=np.array([101,108,141])+(np.array([235,191,176])-np.array([101,108,141]))*warm[...,None]
    col+=(c-.5)[...,None]*8
    rgba=np.concatenate([np.clip(col,0,255),alpha[...,None]*255],axis=-1).astype('uint8')
    atlas.paste(Image.fromarray(rgba,'RGBA'),((j%4)*S,(j//4)*S))
atlas.save(OUT/'smoke-pigment.png',optimize=True)
print('Wrote original procedural dusk-matte.png and smoke-pigment.png')
