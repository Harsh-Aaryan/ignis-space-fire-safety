// Capture stills through the existing local UI; no renderer or simulation settings are changed.
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const targets = new Set(process.argv.slice(2));
const requested = name => !targets.size || targets.has(name);
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,reducedMotion:'reduce'});
    const pending = new Set();
    page.on('request', r => {if (/\.(glb|wasm|hdr|webp|png|jpe?g)(\?|$)/i.test(r.url())) pending.add(r);});
    page.on('requestfinished',r=>pending.delete(r)); page.on('requestfailed',r=>pending.delete(r));
    await page.goto((process.env.IGNIS_SCREENSHOT_URL || 'http://127.0.0.1:3000')+'/firetwin',{waitUntil:'domcontentloaded',timeout:120000});
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
      await page.screenshot({path:path.resolve('public/overview/'+name+'.jpg'),type:'jpeg',quality:88,clip:{x:b.x+80,y:b.y+110,width:b.width-160,height:b.height-210},animations:'disabled'});
      await page.evaluate(()=>{for(const [element,value] of window.__overviewHidden)element.style.visibility=value;});
      console.log('Captured '+name);
    }
    if(requested('moon')) {
      await settle('shell'); await zoom(10); await elevate(30); await capture('moon-exterior');
    }
    if(requested('mars')) {
      await page.getByRole('radio',{name:'Mars, 0.38 g',exact:true}).click();
      await settle('shell'); await zoom(3); await capture('mars-exterior');
    }
    if(requested('gateway')) {
      await page.getByRole('radio',{name:'Gateway-inspired lunar orbit habitat, about 0 g, conceptual digital twin',exact:true}).click();
      await settle('living-quarters'); await zoom(8); await capture('gateway');
    }
    console.log(JSON.stringify(fs.readdirSync('public/overview').map(name=>({name,bytes:fs.statSync('public/overview/'+name).size}))));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
