// Capture stills through the existing local UI; no renderer or simulation settings are changed.
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const targets = new Set(process.argv.slice(2));
const requested = name => !targets.size || targets.has(name);
const previews = [
  { name: 'moon', id: 'lunar-habitat', gravity: 0.165, ready: 'shell', zoom: 10, elevate: 30, file: 'moon-exterior' },
  { name: 'mars', id: 'mars-habitat', gravity: 0.38, ready: 'shell', zoom: 3, file: 'mars-exterior' },
  { name: 'gateway', id: 'gateway-orbit', gravity: 0, ready: 'living-quarters', zoom: 6, file: 'gateway' },
];
(async () => {
  // Release high-resolution framebuffers between habitats, especially on software WebGL.
  for (const preview of previews.filter(preview => requested(preview.name))) {
  const browser = await chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    // The high-tier renderer uses 1.5 DPR. Capture at that native density,
    // rather than stretching the old 1160px stills across the landing page.
    const page = await browser.newPage({viewport:{width:2880,height:1800},deviceScaleFactor:1.5,reducedMotion:'reduce'});
    await page.addInitScript(preview => {
      sessionStorage.setItem('ignis-session', JSON.stringify({ version: 0, state: {
        scenario: { missionId: preview.id, name: preview.name, gravityG: preview.gravity,
          oxygenPct: 32, pressurePsi: 10.2, airflowMs: 0.05,
          fuelCategory: 'solid-polymer', objective: 'habitat-fire-safety' },
        selectedEquipment: null, selectedRoomId: null, selectedObjectId: null, selectedLevel: null,
        navigationMode: 'orbit', cutaway: false, exploded: false, hideRoof: true, hideFrontWalls: true,
      } }));
    }, preview);
    const pending = new Set();
    page.on('request', r => {if (/\.(glb|wasm|hdr|webp|png|jpe?g)(\?|$)/i.test(r.url())) pending.add(r);});
    page.on('requestfinished',r=>pending.delete(r)); page.on('requestfailed',r=>pending.delete(r));
    await page.goto((process.env.IGNIS_SCREENSHOT_URL || 'http://127.0.0.1:3000')+'/simulation',{waitUntil:'domcontentloaded',timeout:120000});
    await page.locator('canvas').waitFor({state:'visible',timeout:120000});
    async function settle(id) {
      await page.waitForFunction(id=>Boolean(window.__IGNIS_SCREEN?.[id]),id,{timeout:120000});
      for(let n=0;n<180 && pending.size;n++) await page.waitForTimeout(500);
      if(pending.size) throw Error('Unfinished scene assets');
      await page.waitForTimeout(3000);
    }
    async function zoom(steps) {
      const b=await page.locator('canvas').boundingBox();
      await page.mouse.move(b.x+b.width*.6,b.y+b.height*.55);
      for(let n=0;n<Math.abs(steps);n++){await page.mouse.wheel(0,Math.sign(steps)*100);await page.waitForTimeout(100);}
      await page.waitForTimeout(1500);
    }
    async function elevate(pixels) {
      const b=await page.locator('canvas').boundingBox();
      const x=b.x+b.width*.6, y=b.y+b.height*.55;
      await page.mouse.move(x,y); await page.mouse.down();
      await page.mouse.move(x,y+pixels,{steps:15}); await page.mouse.up();
      await page.waitForTimeout(1500);
    }
    async function capture(name) {
      await page.evaluate(()=>{
        window.__overviewHidden=[];
        let node=document.querySelector('canvas');
        while(node && node.id!=='main') {
          for(const sibling of node.parentElement.children) if(sibling!==node){window.__overviewHidden.push([sibling,sibling.style.visibility]);sibling.style.visibility='hidden';}
          node=node.parentElement;
        }
      });
      const b=await page.locator('canvas').boundingBox();
      await page.mouse.move(5,5);
      await page.screenshot({path:path.resolve('public/overview/'+name+'.jpg'),type:'jpeg',quality:96,clip:{x:b.x+80,y:b.y+110,width:b.width-160,height:b.height-210},animations:'disabled',timeout:120000});
      await page.evaluate(()=>{for(const [element,value] of window.__overviewHidden)element.style.visibility=value;});
      console.log('Captured '+name);
    }
    await settle(preview.ready);
    await zoom(preview.zoom);
    if (preview.elevate) await elevate(preview.elevate);
    await capture(preview.file);
  } finally {await browser.close();}
  }
  console.log(JSON.stringify(fs.readdirSync('public/overview').map(name=>({name,bytes:fs.statSync('public/overview/'+name).size}))));
})().catch(error=>{console.error(error);process.exitCode=1;});
