// Browser acceptance through the public screen controls and keyboard.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,
    args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const out=path.resolve(__dirname,process.env.CAPTURE_DIR||'../evidence/round-04');
  fs.mkdirSync(out,{recursive:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  const shot=name=>page.screenshot({path:path.join(out,name+'.jpg')});
  const read=()=>page.evaluate(()=>coastRead());
  const until=(fn,timeout=20000)=>page.waitForFunction(fn,null,{timeout});
  const hold=async(key,fn,timeout)=>{
    await page.keyboard.down(key);
    try{await until(fn,timeout)}finally{await page.keyboard.up(key);}
  };
  try{
    await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:4322/');
    await until(()=>window.coastRead?.().build===4&&coastRead().frames>0);
    await page.click('#helpBtn');
    assert(await page.locator('#guide').isVisible());
    await page.click('#back');
    await page.click('#start');
    await until(()=>coastRead().elapsed>.2);
    const start=await read();
    assert(start.onFoot&&start.carX>20&&start.doorDistance<2.15);
    await shot('kennedy-point');
    await page.keyboard.press('KeyG');
    await until(()=>!coastRead().onFoot);
    await hold('KeyW',()=>coastRead().speed>=4);
    await until(()=>coastRead().carX<=5.2);
    await hold('KeyD',()=>coastRead().carBearing>=-.09);
    await until(()=>coastRead().carZ>35);
    await hold('KeyW',()=>coastRead().speed>=17);
    await page.keyboard.press('KeyC');
    await until(()=>coastRead().cabin);
    await page.keyboard.press('KeyE');
    await until(()=>coastRead().look>.97&&coastRead().time>13);
    await shot('launch');
    await page.keyboard.press('KeyE');
    await page.keyboard.press('KeyC');
    await hold('KeyW',()=>coastRead().carZ>=1457,180000);
    await hold('KeyS',()=>coastRead().speed<=4.2);
    await until(()=>coastRead().carZ>=1499.5);
    await hold('KeyD',()=>coastRead().carBearing>=1.48);
    await until(()=>coastRead().carX>=25);
    await hold('KeyS',()=>coastRead().speed===0);
    await page.keyboard.press('KeyG');
    await until(()=>coastRead().onFoot&&coastRead().heard!==null);
    const parked=await read();
    assert(parked.carZ>parked.routeLength&&parked.carX>25);
    await shot('rotary-parking');
    await page.keyboard.press('Space');
    assert((await read()).mark!==null);
    await page.keyboard.press('KeyB');
    assert(await page.locator('#mapcard').isVisible());
    await shot('map');
    await page.keyboard.press('KeyP');
    const frozen=await read();
    await page.waitForTimeout(250);
    assert.equal((await read()).elapsed,frozen.elapsed);
    await page.click('#finish');
    assert(await page.locator('#record').isVisible());
    await page.reload();
    await until(()=>window.coastRead?.().mode==='title');
    assert(await page.locator('#record').isVisible());
    assert.deepEqual(errors,[]);
    console.log('PASS · keyboard drive, launch glance, manual parking, delayed audio, map and saved note');
  } catch(e) {
    console.error(e,errors,await read().then(({timings,...state})=>state).catch(()=>{}));
    await shot('failure').catch(()=>{});
    process.exitCode=1;
  } finally {await browser.close();}
})();
