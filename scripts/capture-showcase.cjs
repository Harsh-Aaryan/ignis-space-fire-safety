const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.IGNIS_SCREENSHOT_URL || 'http://127.0.0.1:3002';
const OUTPUT = path.resolve('docs/screenshots/showcase');
const WIDTH = 1920, HEIGHT = 1080, SCALE = 2;
const manifest = [];
const errors = [];
const pending = new Set();
let lastAsset = Date.now();
fs.mkdirSync(OUTPUT, {recursive:true});

async function main() {
  const browser = await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
  try {
    const context = await browser.newContext({viewport:{width:WIDTH,height:HEIGHT},deviceScaleFactor:SCALE,colorScheme:'dark',reducedMotion:'reduce',locale:'en-US',timezoneId:'America/Chicago'});
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (/\.(?:glb|wasm|hdr|webp|png|jpe?g|woff2?)(?:\?|$)/i.test(request.url())) { pending.add(request); lastAsset=Date.now(); }
    });
    const finish = request => { if (pending.delete(request)) lastAsset=Date.now(); };
    page.on('requestfinished',finish);page.on('requestfailed',finish);

    async function settle(ms=1500) {
      await page.evaluate(async()=>{await document.fonts.ready;});
      await page.waitForTimeout(ms);
      await page.mouse.move(WIDTH-4,HEIGHT-4);
      await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();});
    }
    async function go(route,heading) {
      const response=await page.goto(BASE+route,{waitUntil:'domcontentloaded',timeout:120000});
      if(!response?.ok())throw new Error('Route failed: '+route);
      if(heading)await page.getByRole('heading',{name:heading,exact:true}).waitFor();
      await settle();
      await page.locator('#main').evaluate(main=>{main.scrollTop=0;});
    }
    async function waitScene(expectedId='shell') {
      await page.locator('canvas').waitFor();
      await page.waitForTimeout(1000);
      const started=Date.now();
      while(Date.now()-started<120000) {
        const ready=await page.evaluate(id=>Boolean(window.__IGNIS_SCREEN?.[id]),expectedId);
        if(ready&&!pending.size&&Date.now()-lastAsset>2500)break;
        await page.waitForTimeout(500);
      }
      await settle(3500);
      if(pending.size)throw new Error('Scene assets have not finished loading');
    }
    async function shot(file,title,group,description) {
      await settle(800);
      await page.screenshot({path:path.join(OUTPUT,file+'.png'),type:'png',animations:'disabled',caret:'hide',timeout:120000});
      const session=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ignis-session')||'null')?.state);
      manifest.push({file:file+'.png',title,group,description,route:new URL(page.url()).pathname,width:WIDTH*SCALE,height:HEIGHT*SCALE,scenario:session?.scenario,selectedRoom:session?.selectedRoomId||null,selectedObject:session?.selectedObjectId||null});
      console.log('Captured '+file+'.png');
    }
    async function positionSection(heading) {
      await page.getByRole('heading',{name:heading,exact:true}).evaluate(element=>{
        const main=document.getElementById('main');
        main.scrollTop += element.getBoundingClientRect().top-main.getBoundingClientRect().top-28;
      });
      await settle();
    }
    async function zoom(delta) {
      const bounds=await page.locator('canvas').boundingBox();
      await page.mouse.move(bounds.x+bounds.width*0.55,bounds.y+bounds.height*0.53);
      for(let step=0;step<Math.ceil(Math.abs(delta)/100);step++){await page.mouse.wheel(0,Math.sign(delta)*100);await page.waitForTimeout(90);}
      await settle(2500);
    }
    async function elevate(pixels) {
      const b=await page.locator('canvas').boundingBox();
      const x=b.x+b.width*0.6, y=b.y+b.height*0.55;
      await page.mouse.move(x,y);await page.mouse.down();
      await page.mouse.move(x,y+pixels,{steps:15});await page.mouse.up();
      await settle(2200);
    }
    const choose = async label => {
      await page.getByRole('radio',{name:label,exact:true}).click();
      await page.waitForTimeout(750);
    };
    const moon='Moon, 0.165 g', mars='Mars, 0.38 g', gateway='Gateway-inspired lunar orbit habitat, about 0 g, conceptual digital twin';

    // Real, populated application pages in an isolated browser session.
    await go('/','Fire safety beyond Earth.');
    await shot('07-overview','IGNIS overview','Application pages','A clear introduction, interactive habitat previews and guided research workflows.');
    await go('/research','Research Explorer');
    await page.getByRole('button',{name:'Compare',exact:true}).first().click();
    await page.getByRole('button',{name:'Compare',exact:true}).first().click();
    await page.locator('#main').evaluate(main=>{main.scrollTop=0;});
    await shot('08-research-explorer','Research Explorer','Application pages','Ranked synthetic dossiers, filters and investigation selection.');
    await positionSection('Side-by-side comparison');
    await shot('13-research-comparison','Investigation comparison','Detail views','Actual side-by-side conditions, measurements and uncertainty.');
    const index=JSON.parse(fs.readFileSync('src/data/verified/ntrs-index.json','utf8'));
    await go('/research/'+index.records[0].id,index.records[0].title);
    await shot('14-nasa-evidence-record','NASA evidence record','Detail views','Verified NTRS citation metadata with its source and extraction limits.');
    await go('/predict','Predictive analytics');
    await shot('09-predict','Predictive analytics','Application pages','Verified evidence limitations and the separate synthetic statistical baseline.');
    await go('/gravity-bridge','GravityBridge');
    await shot('10-gravitybridge','GravityBridge','Application pages','Condition-space heatmap, partial-gravity gaps and applicability.');
    await go('/firelab','FireLab');
    await page.getByRole('textbox',{name:'Ask the demo assistant',exact:true}).fill('Which investigations are most relevant to this lunar habitat, and what should researchers investigate next?');
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await page.getByText('Briefing clerk',{exact:true}).waitFor();
    await settle(2500);
    await shot('11-firelab','FireLab research briefing','Application pages','A populated briefing and research proposals generated by the existing demo assistant.');
    await go('/reports','Mission report');
    for(const [label,name] of [[moon,'Moon materials research - demo'],[mars,'Mars habitat evidence gaps - demo'],[gateway,'Gateway combustion research - demo']]) {
      await choose(label);
      await page.getByRole('textbox',{name:'Scenario name',exact:true}).fill(name);
      await page.getByRole('button',{name:'Save scenario',exact:true}).click();
    }
    await choose(moon);
    await page.locator('#main').evaluate(main=>{main.scrollTop=0;});
    await settle(3500);
    await shot('12-reports','Mission report','Application pages','Live scenario summary, ranked dossiers and evidence charts.');

    // Warm and frame each real habitat, retaining all model/source labels.
    await go('/firetwin');
    await choose(moon);
    await waitScene('shell');
    await zoom(850);
    await elevate(30);
    await shot('01-moon-exterior','Moon habitat - exterior','Habitat exterior and cutaway','The existing ESA/Foster+Partners-inspired shell, lunar terrain and Apollo lander.');
    await page.getByRole('button',{name:'Cutaway view',exact:true}).click();
    await waitScene('lunar-habitat-lab-samples-1');
    await zoom(-170);
    await shot('02-moon-cutaway','Moon habitat - cutaway','Habitat exterior and cutaway','Furnished research, crew, airlock and environmental spaces across two decks.');
    await page.getByLabel('Select room',{exact:true}).selectOption('lunar-habitat-lab');
    await waitScene('lunar-habitat-lab-samples-1');
    await page.locator('[data-object-id="lunar-habitat-lab-samples-1"]').click();
    await settle(2500);
    await page.getByLabel('Research inspector').evaluate(aside=>{aside.scrollTop=0;});
    await shot('15-moon-equipment','Moon sample-rack inspection','Detail views','Selected sample geometry with its synchronized research inspector.');

    await choose(mars);
    await waitScene('shell');
    await zoom(-100);
    await shot('03-mars-exterior','Mars habitat - exterior','Habitat exterior and cutaway','The original MARSHA-inspired printed habitat and Mars surface environment.');
    await page.getByRole('button',{name:'Cutaway view',exact:true}).click();
    await waitScene('mars-habitat-lab-samples-3');
    await zoom(80);
    await shot('04-mars-cutaway','Mars habitat - four-floor cutaway','Habitat exterior and cutaway','Airlock and storage, laboratory, crew quarters, and environmental control.');
    await page.getByRole('button',{name:'Explode levels',exact:true}).click();
    await settle(3500);
    await shot('16-mars-exploded','Mars exploded levels','Detail views','All four furnished decks separated vertically on their original alignment.');

    await choose(gateway);
    await waitScene('living-quarters');
    await zoom(800);
    await elevate(40);
    await shot('05-gateway-exterior','Gateway - exterior','Habitat exterior and cutaway','The intact NASA-derived spacecraft, framed to include its full solar-array span.');
    await page.getByLabel('Select room',{exact:true}).selectOption('gateway-orbit-halo');
    await waitScene('gateway-orbit-halo');
    await zoom(100);
    await shot('06-gateway-cutaway','Gateway - HALO cutaway','Habitat exterior and cutaway','Conceptual living and environmental systems inside one selected pressurized module.');
    await page.getByLabel('Select room',{exact:true}).selectOption('gateway-orbit-ihab');
    await waitScene('gateway-orbit-ihab');
    await zoom(80);
    await shot('17-gateway-experiment','Gateway - experiment workspace','Detail views','Conceptual I-Hab workbenches, sample racks, stowage and monitoring.');
    await page.getByLabel('Select room',{exact:true}).selectOption('gateway-orbit-passage');
    await waitScene('gateway-orbit-passage');
    await zoom(100);
    await shot('18-gateway-docking','Gateway - docking passage','Detail views','Pressure hatch, oxygen monitoring, emergency equipment and restrained storage.');

    manifest.sort((a,b)=>a.file.localeCompare(b.file));
    fs.writeFileSync(path.join(OUTPUT,'manifest.json'),JSON.stringify({source:BASE,viewport:{width:WIDTH,height:HEIGHT},deviceScaleFactor:SCALE,format:'PNG',browser:'Microsoft Edge / hardware WebGL',note:'Actual local application captures. No model, lighting, scientific results or screenshot pixels were altered. Scenario saves and assistant conversations are confined to an isolated browser context.',errors,screenshots:manifest},null,2)+'\n');
    const escape = value => value.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const groups=['Habitat exterior and cutaway','Application pages','Detail views'];
    const sections=groups.map(group=>`<section><h2>${group}</h2><div class="grid">${manifest.filter(item=>item.group===group).map(item=>`<a class="card" href="${item.file}" target="_blank"><img src="${item.file}" alt="${escape(item.title)}" loading="eager"><div><h3>${escape(item.title)}</h3><p>${escape(item.description)}</p><span>3840 x 2160 PNG</span></div></a>`).join('')}</div></section>`).join('');
    const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IGNIS - Screenshot gallery</title><style>*{box-sizing:border-box}body{margin:0;background:#14181c;color:#e7e8df;font-family:Arial,sans-serif}header,main,footer{max-width:1500px;margin:auto;padding:32px}header{border-bottom:1px solid #3c454a}small{color:#d5a36f;letter-spacing:.2em}h1{font-size:38px;margin:14px 0 10px}header p{color:#aab5b5;line-height:1.6;max-width:850px}section{margin:0 0 42px}h2{font-size:19px;font-weight:500;margin:0 0 18px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}.card{display:block;color:inherit;text-decoration:none;background:#20272b;border:1px solid #3b464b;border-radius:6px;overflow:hidden}.card:hover{border-color:#d5a36f}img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}h3{font-size:16px;margin:0 0 10px}.card div{padding:17px}.card p{font-size:13px;line-height:1.5;color:#aeb8b7;min-height:39px;margin:0 0 14px}.card span{font-size:10px;color:#d5a36f;letter-spacing:.1em}footer{border-top:1px solid #3c454a;font-size:12px;color:#aeb8b7;line-height:1.6}@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.grid{grid-template-columns:1fr}header,main,footer{padding:20px}}</style></head><body><header><small>IGNIS / LOCAL APPLICATION CAPTURES</small><h1>Explore the habitat. Follow the evidence.</h1><p>18 high-resolution screenshots of Moon, Mars and Gateway exteriors and interiors, plus the research, analysis and reporting workspace. Open any image for the original 4K PNG.</p></header><main>${sections}</main><footer>Captured from the local IGNIS application. Habitat interiors are conceptual; verified NASA citation metadata and synthetic demonstration data retain their labels. No application or deployment changes were made for these captures.</footer></body></html>`;
    fs.writeFileSync(path.join(OUTPUT,'index.html'),html);
    fs.writeFileSync(path.join(OUTPUT,'README.md'),'# IGNIS screenshot collection\n\n18 original 3840 x 2160 PNG screenshots, captured from the local production build at '+BASE+'.\n\nOpen `index.html` for the gallery. Numbered images 01-06 are exterior/cutaway pairs, 07-12 cover all other application tabs, and 13-18 contain comparison, evidence and equipment detail views.\n\nThe images are direct browser screenshots with real UI states. Camera framing uses the actual orbit and zoom controls. No screenshots were retouched, and no application source or deployment settings were changed. Demonstration saved scenarios and FireLab chat exist only in an isolated capture session. See `manifest.json` for routes, mission conditions and selected objects.\n');
    const gallery=await context.newPage({viewport:{width:1500,height:1000}});
    await gallery.setViewportSize({width:1500,height:1000});
    await gallery.goto('file:///'+path.join(OUTPUT,'index.html').replaceAll('\\','/'));
    await gallery.evaluate(async()=>{await Promise.all([...document.images].map(image=>image.decode()));});
    await gallery.screenshot({path:path.join(OUTPUT,'gallery-overview.png'),fullPage:true,animations:'disabled',timeout:120000});
    console.log(JSON.stringify({captured:manifest.length,output:OUTPUT,errors}));
    await context.close();
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});

