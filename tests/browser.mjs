// Real Chromium MV3 extension smoke test. Safari/iOS acceptance is a separate gate.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const root=path.resolve(new URL('..',import.meta.url).pathname);
const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'harbor-browser-'));
const extension=path.join(scratch,'Extension');await fs.cp(path.join(root,'Extension'),extension,{recursive:true});
const manifest=JSON.parse(await fs.readFile(path.join(extension,'manifest.json'),'utf8'));
manifest.background={service_worker:'background.js',type:'module'};
await fs.writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
const evidence=process.env.HARBOR_EVIDENCE ?? path.join(scratch,'evidence');await fs.mkdir(evidence,{recursive:true});
const report=JSON.parse(await fs.readFile(path.join(root,'Extension/rules/report.json'),'utf8'));
let requests=0;const hits={};
const server=http.createServer((req,res)=>{
 // Other hosts reach this server through --host-resolver-rules, so their URLs carry no port.
 const host=req.headers.host.split(':')[0];
 if(host==='weather.com'){res.setHeader('Content-Type','text/html');res.end(`<!doctype html><title>Forecast</title><main id="forecast">Today: sunny</main><div id="WxuAd-top">AdGuard Base ad slot</div><div class="adWrapper">AdGuard Mobile Ads slot</div><div class="regionStickyAds">EasyList ad slot</div><script src="http://s.w-x.co/helios/twc/ads.js"></script><script src="http://c.amazon-adsystem.com/aax2/apstag.js"></script>`);return;}
 if(host==='foxnews.com'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Fox stand-in</title><main id="story">Story</main><div id="div-gpt-ad-top">Google ad slot</div>');return;}
 if(host==='partner.example'&&req.url==='/trap'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><a href="http://partner.example/landing2" target="_blank" style="position:fixed;inset:0">Ad</a>');return;}
 if(req.url==='/popups'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Popups</title><p id="text" style="font-size:20px">Plain article text.</p><button id="share" style="width:200px;height:50px">Share</button><div style="height:1500px"></div><script>let fired=false;document.addEventListener("click",()=>{if(fired)return;fired=true;const w=window.open("http://partner.example/popunder2");if(!w)location.href="http://partner.example/fallback";});document.getElementById("share").addEventListener("click",()=>window.open("http://partner.example/share"));</script>');return;}
 if(req.url==='/overlay'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Overlay</title><p id="text" style="font-size:20px;margin-top:40px">Article text under an invisible ad.</p><button id="real" style="width:200px;height:50px">Real button</button><div style="height:1500px"></div><iframe src="http://partner.example/trap" style="position:fixed;inset:0;width:100%;height:100%;border:0;opacity:0;z-index:99"></iframe><div id="modal" style="position:fixed;top:30%;left:5%;width:90%;height:60%;z-index:100;opacity:0;transition:opacity .2s;background:#fff"><button id="ok" style="width:200px;height:50px">OK</button></div><script>window.realClicked=false;window.okClicked=false;document.getElementById("real").onclick=()=>realClicked=true;document.getElementById("ok").onclick=()=>okClicked=true;setTimeout(()=>document.getElementById("modal").style.opacity=1,600);</script>');return;}
 if(host==='partner.example'&&req.url==='/frame'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><a href="http://partner.example/landing" target="_blank" style="position:fixed;inset:0;background:#fd0">Partner offer</a>');return;}
 if(req.url==='/picker'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Picker test</title><h2>Story</h2><iframe id="partner-frame" src="http://partner.example/frame" style="width:320px;height:100px;border:0"></iframe><a id="partner-link" href="http://partner.example/landing" target="_blank" style="display:block;width:320px;height:60px">Partner offer</a><div style="height:2000px"></div><script>window.addEventListener(\'click\',()=>window.open(\'http://partner.example/popunder\'),true);</script>');return;}
 if(host!=='127.0.0.1'){hits[host+req.url]=(hits[host+req.url]??0)+1;res.setHeader('Content-Type','text/javascript');res.end('');return;}
 if(req.url==='/harbor-ad.js'){requests++;res.setHeader('Content-Type','text/javascript');res.end('window.adLoaded=true;');return;}
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><title>Harbor test page</title></head><body><h1>Publisher content</h1><div class="sponsor">Sponsored test element</div><p>Article text stays visible.</p><script src="/harbor-ad.js"></script></body></html>');
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}`;
let context;
try{
 context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:'chromium',headless:true,hasTouch:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,`--host-resolver-rules=${['weather.com','foxnews.com','s.w-x.co','c.amazon-adsystem.com','partner.example'].map(h=>`MAP ${h} 127.0.0.1:${server.address().port}`).join(', ')}`],viewport:{width:390,height:844}});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
 const id=new URL(worker.url()).host;
 const settings=await context.newPage();const errors=[];settings.on('pageerror',e=>errors.push(e.message));
 await settings.goto(`chrome-extension://${id}/options.html`);
 await settings.locator('#enabled:not([disabled])').waitFor();
 assert.equal(await settings.locator('#enabled').isChecked(),true);
 assert.equal((await worker.evaluate(()=>chrome.declarativeNetRequest.getEnabledRulesets())).length,Object.keys(report.lists).length);
 // UI validation, create and remove exception.
 await settings.locator('#domain').fill('https://bad.example/path');await settings.locator('#add-site').click();
 assert.match(await settings.locator('#domain-error').innerText(),/hostname/);
 await settings.locator('#domain').fill('example.com');await settings.locator('#add-site').click();await settings.getByRole('button',{name:'Remove exception for example.com'}).waitFor();
 await settings.getByRole('button',{name:'Remove exception for example.com'}).click();await settings.locator('#empty-sites').waitFor({state:'visible'});
 await settings.screenshot({path:path.join(evidence,'protection-phone.png'),fullPage:true});
 await settings.getByRole('link',{name:'My filters',exact:true}).click();
 await settings.locator('#custom').fill('||ads.example^$redirect=noop');await settings.locator('#save-custom').click();assert.match(await settings.locator('#custom-error').innerText(),/Line 1/);
 const filter=`|${url}/harbor-ad.js|$script\n127.0.0.1##.sponsor`;
 await settings.locator('#custom').fill(filter);await settings.locator('#save-custom').click();await settings.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Filters saved'));
 const page=await context.newPage();await page.goto(url);await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>!!window.adLoaded),false,'Network request should be blocked');
 assert.equal(await page.locator('.sponsor').isVisible(),false,'Cosmetic filter should hide sponsored element');
 assert.equal(requests,0,'Blocked request must not reach the server');
 // Site exception disables both network and cosmetic filtering.
 await settings.getByRole('link',{name:'Protection',exact:true}).click();await settings.locator('#domain').fill('127.0.0.1');await settings.locator('#add-site').click();await settings.getByRole('button',{name:'Remove exception for 127.0.0.1'}).waitFor();
 await page.reload();await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>!!window.adLoaded),true);assert.equal(await page.locator('.sponsor').isVisible(),true);
 await settings.getByRole('button',{name:'Remove exception for 127.0.0.1'}).click();await settings.locator('#empty-sites').waitFor({state:'visible'});
 // Global pause also pauses custom rules.
 await settings.locator('#enabled').uncheck();await settings.waitForFunction(()=>!document.querySelector('#enabled').disabled);await page.reload();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>!!window.adLoaded),true);assert.equal(await page.locator('.sponsor').isVisible(),true);
 await settings.locator('#enabled').check();await settings.waitForFunction(()=>!document.querySelector('#enabled').disabled);await page.reload();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>!!window.adLoaded),false);
 // Theme, keyboard, narrow layout, and draft retention.
 await settings.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});await settings.screenshot({path:path.join(evidence,'protection-dark.png'),fullPage:true});
 await settings.getByRole('link',{name:'My filters',exact:true}).click();await settings.locator('#custom').fill(filter+'\n! draft');await settings.getByRole('link',{name:'Setup',exact:true}).click();await settings.getByRole('link',{name:'My filters',exact:true}).click();assert.ok((await settings.locator('#custom').inputValue()).endsWith('! draft'));
 await settings.locator('#discard').click();assert.equal(await settings.locator('#custom').inputValue(),filter);
 await settings.setViewportSize({width:320,height:700});assert.equal(await settings.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await settings.keyboard.press('Tab');
 await settings.emulateMedia({colorScheme:'light'});await settings.screenshot({path:path.join(evidence,'filters-phone.png'),fullPage:true});
 // Picker writes a real rule, then settings show it after reload.
 await worker.evaluate(async()=>{const tabs=await chrome.tabs.query({});const tab=tabs.find(t=>t.url?.startsWith('http://127.0.0.1'));await chrome.tabs.sendMessage(tab.id,{type:'pick'},{frameId:0});});
 const heading=await page.locator('h1').boundingBox();await page.mouse.click(heading.x+heading.width/2,heading.y+heading.height/2);
 // Inspect the isolated picker UI through CDP for an end-to-end save.
 const cdp=await context.newCDPSession(page);const {root:dom}=await cdp.send('DOM.getDocument',{depth:-1,pierce:true});
 function find(node){if(node.attributes?.includes('hide'))return node;for(const child of [...(node.children??[]),...(node.shadowRoots??[])]){const found=find(child);if(found)return found;}}
 const button=find(dom);assert.ok(button,'Picker save control exists');const {model}=await cdp.send('DOM.getBoxModel',{nodeId:button.nodeId});await page.mouse.click((model.content[0]+model.content[4])/2,(model.content[1]+model.content[5])/2);
 await page.waitForTimeout(250);assert.equal(await page.locator('h1').isVisible(),false,'Picked element hidden after confirmed save');
 await settings.reload();await settings.locator('#custom:not([disabled])').waitFor();assert.match(await settings.locator('#custom').inputValue(),/127\.0\.0\.1##body > h1/);
 // Bundled lists on a weather.com stand-in: AdGuard adds hiding and never unblocks what EasyList blocks.
 const weather=await context.newPage();await weather.goto('http://weather.com/');await weather.waitForTimeout(300);
 assert.equal(await weather.locator('#forecast').isVisible(),true);
 for(const slot of ['#WxuAd-top','.adWrapper','.regionStickyAds'])assert.equal(await weather.locator(slot).isVisible(),false,`${slot} should be hidden`);
 assert.deepEqual(hits,{},'EasyList blocks weather.com ad scripts despite AdGuard exceptions');
 // AdGuard turns generic hiding off on foxnews.com; that must not switch off EasyList's generic filters.
 await weather.goto('http://foxnews.com/');await weather.waitForTimeout(300);assert.equal(await weather.locator('#story').isVisible(),true);assert.equal(await weather.locator('#div-gpt-ad-top').isVisible(),false,'EasyList generic filters still apply where AdGuard disables its own');
 await weather.goto('http://weather.com/');await weather.waitForTimeout(300);
 await settings.getByRole('link',{name:'Protection',exact:true}).click();await settings.locator('#adguard-base').uncheck();await settings.waitForFunction(()=>!document.querySelector('#adguard-base').disabled);
 await weather.reload();await weather.waitForTimeout(300);
 assert.equal(await weather.locator('#WxuAd-top').isVisible(),true,'AdGuard Base toggle controls its filters');assert.equal(await weather.locator('.adWrapper').isVisible(),false);assert.equal(await weather.locator('.regionStickyAds').isVisible(),false);
 await settings.locator('#adguard-base').check();await settings.waitForFunction(()=>!document.querySelector('#adguard-base').disabled);
 await settings.screenshot({path:path.join(evidence,'filter-lists.png'),fullPage:true});
 // Picking an ad in a frame, or an ad link, selects it instead of opening it; page click handlers never see picker taps.
 // Touch taps here, as on iPhone; the heading above was picked with a mouse click.
 const pickPage=await context.newPage();await pickPage.goto(`${url}/picker`);await pickPage.waitForTimeout(300);
 const opened=[];context.on('page',p=>opened.push(p));
 assert.ok(pickPage.frames().some(f=>f.url()==='http://partner.example/frame'),'Ad frame loaded');assert.equal(await pickPage.locator('#partner-frame').isVisible(),true);assert.equal(await pickPage.locator('#partner-link').isVisible(),true);
 await worker.evaluate(async page=>{const [tab]=await chrome.tabs.query({url:page});await chrome.tabs.sendMessage(tab.id,{type:'pick'},{frameId:0});},`${url}/picker`);
 const picker=(id,read)=>pickPage.evaluate(([id,read])=>{for(const el of document.documentElement.children){const node=el.shadowRoot?.getElementById(id);if(node){if(read)return node.textContent;const r=node.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};}}},[id,read]);
 const tap=async target=>{const box=typeof target==='string'?await pickPage.locator(target).boundingBox():null;const point=box?{x:box.x+box.width/2,y:box.y+box.height/2}:target;await pickPage.touchscreen.tap(point.x,point.y);await pickPage.waitForTimeout(300);};
 await pickPage.mouse.move(160,300);await pickPage.mouse.wheel(0,400);await pickPage.waitForTimeout(300);assert.ok(await pickPage.evaluate(()=>scrollY)>0,'Page scrolls while picking');await pickPage.evaluate(()=>scrollTo(0,0));await pickPage.waitForTimeout(100);
 await tap('#partner-link');assert.equal(await picker('selector',true),'#partner-link');
 await tap('#partner-frame');assert.equal(await picker('selector',true),'#partner-frame');
 assert.equal(opened.length,0,'No ad or popunder page opened while picking');assert.equal(pickPage.url(),`${url}/picker`);
 await tap(await picker('hide'));assert.equal(await pickPage.locator('#partner-frame').isVisible(),false,'Picked ad frame hidden');
 assert.equal(opened.length,0);assert.deepEqual(Object.keys(hits).filter(k=>k.startsWith('partner.example')),[]);await pickPage.close();
 // Tap-anywhere pop-ups: an invisible full-page ad frame, and a script that opens an ad on the first tap anywhere.
 const popPage=await context.newPage();opened.length=0;
 const tapOn=async(page,selector)=>{const box=await page.locator(selector).boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(400);};
 await popPage.goto(`${url}/overlay`);await popPage.waitForTimeout(1300);
 await tapOn(popPage,'#text');await tapOn(popPage,'#real');await tapOn(popPage,'#ok');
 assert.equal(opened.length,0,'Invisible ad frame cannot open a page');assert.equal(await popPage.evaluate(()=>[realClicked,okClicked].join()),'true,true','Content under the invisible frame and a faded-in dialog stay usable');
 await popPage.goto(`${url}/popups`);await popPage.waitForTimeout(300);
 await tapOn(popPage,'#text');assert.equal(opened.length,0,'Tap on plain text opens no pop-up');assert.equal(popPage.url(),`${url}/popups`,'Refused pop-up does not redirect the page');
 await tapOn(popPage,'#share');assert.deepEqual(opened.map(p=>p.url()),['http://partner.example/share'],'Buttons can still open windows');await opened.pop().close();
 // Pausing Harbor on the site turns pop-up protection off.
 await settings.reload();await settings.locator('#add-site:not([disabled])').waitFor();// the picker saved from another tab
 await settings.locator('#domain').fill('127.0.0.1');await settings.locator('#add-site').click();await settings.getByRole('button',{name:'Remove exception for 127.0.0.1'}).waitFor();
 await popPage.reload();await popPage.waitForTimeout(500);await tapOn(popPage,'#text');assert.deepEqual(opened.map(p=>p.url()),['http://partner.example/popunder2'],'Paused site behaves normally');await opened.pop().close();
 await settings.getByRole('button',{name:'Remove exception for 127.0.0.1'}).click();await settings.locator('#empty-sites').waitFor({state:'visible'});await popPage.close();
 assert.deepEqual(errors,[]);
 const result={passed:true,engine:'Chromium MV3 (Safari manifest adapted only for service worker)',checks:[`${report.totals.compiledRules.toLocaleString()} static rules in ${Object.keys(report.lists).length} rulesets registered`,'network request blocked before reaching server','cosmetic hide','allowlist create/remove','global pause','custom validation/save','draft retention','element picker save','320px reflow','light/dark','reduced motion','weather.com stand-in: AdGuard hiding, EasyList blocks kept, list toggle','AdGuard exceptions never switch off EasyList hiding','picker selects ad frames and links without opening them','tap-anywhere pop-ups and invisible ad frames stopped; controls, faded-in dialogs and paused sites unaffected'],safariDeviceTested:false};
 await fs.writeFile(path.join(evidence,'browser-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await context?.close();server.close();await fs.rm(scratch,{recursive:true,force:true});}
