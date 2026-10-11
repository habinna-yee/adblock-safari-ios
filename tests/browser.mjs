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
 if(host!=='127.0.0.1'){hits[host+req.url]=(hits[host+req.url]??0)+1;res.setHeader('Content-Type','text/javascript');res.end('');return;}
 if(req.url==='/harbor-ad.js'){requests++;res.setHeader('Content-Type','text/javascript');res.end('window.adLoaded=true;');return;}
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><title>Harbor test page</title></head><body><h1>Publisher content</h1><div class="sponsor">Sponsored test element</div><p>Article text stays visible.</p><script src="/harbor-ad.js"></script></body></html>');
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}`;
let context;
try{
 context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,`--host-resolver-rules=${['weather.com','s.w-x.co','c.amazon-adsystem.com'].map(h=>`MAP ${h} 127.0.0.1:${server.address().port}`).join(', ')}`],viewport:{width:390,height:844}});
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
 await page.locator('h1').click();
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
 await settings.getByRole('link',{name:'Protection',exact:true}).click();await settings.locator('#adguard-base').uncheck();await settings.waitForFunction(()=>!document.querySelector('#adguard-base').disabled);
 await weather.reload();await weather.waitForTimeout(300);
 assert.equal(await weather.locator('#WxuAd-top').isVisible(),true,'AdGuard Base toggle controls its filters');assert.equal(await weather.locator('.adWrapper').isVisible(),false);assert.equal(await weather.locator('.regionStickyAds').isVisible(),false);
 await settings.locator('#adguard-base').check();await settings.waitForFunction(()=>!document.querySelector('#adguard-base').disabled);
 await settings.screenshot({path:path.join(evidence,'filter-lists.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 const result={passed:true,engine:'Chromium MV3 (Safari manifest adapted only for service worker)',checks:[`${report.totals.compiledRules.toLocaleString()} static rules in ${Object.keys(report.lists).length} rulesets registered`,'network request blocked before reaching server','cosmetic hide','allowlist create/remove','global pause','custom validation/save','draft retention','element picker save','320px reflow','light/dark','reduced motion','weather.com stand-in: AdGuard hiding, EasyList blocks kept, list toggle'],safariDeviceTested:false};
 await fs.writeFile(path.join(evidence,'browser-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await context?.close();server.close();await fs.rm(scratch,{recursive:true,force:true});}
