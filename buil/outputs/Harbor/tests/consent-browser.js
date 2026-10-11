const check=(id,checked=false,disabled=false)=>`<label><input type="checkbox" id="${id}" ${checked?'checked':''} ${disabled?'disabled':''}>${id}</label><br>`;
const models=[
 {name:'OneTrust',banner:'onetrust-banner-sdk',panel:'onetrust-pc-sdk',open:'onetrust-pc-btn-handler',save:'save-preference-btn-handler',required:'ot-group-id-C0001',functional:'ot-group-id-C0003',reject:['ot-group-id-C0002','ot-group-id-C0004','ot-group-id-C0005']},
 {name:'Cookiebot',banner:'CybotCookiebotDialog',panel:'CybotCookiebotDialog',open:'CybotCookiebotDialogBodyLevelButtonCustomize',save:'CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection',required:'CybotCookiebotDialogBodyLevelButtonNecessary',functional:'CybotCookiebotDialogBodyLevelButtonPreferences',reject:['CybotCookiebotDialogBodyLevelButtonStatistics','CybotCookiebotDialogBodyLevelButtonMarketing']},
 {name:'Complianz',banner:'cmplz-cookiebanner',panel:'cmplz-cookiebanner',open:'cmplz-view-preferences',save:'cmplz-save-preferences',required:'cmplz-functional-optin',functional:'cmplz-preferences-optin',reject:['cmplz-statistics-optin','cmplz-marketing-optin']},
 {name:'CookieYes',banner:'cky-consent-container',panel:'cky-preference-center',open:'cky-btn-customize',save:'cky-btn-preferences',required:'ckySwitchnecessary',functional:'ckySwitchfunctional',reject:['ckySwitchanalytics','ckySwitchperformance','ckySwitchadvertisement']}
];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let passed=0,failed=0;
async function test(name,model,mode='normal'){
 const iframe=document.createElement('iframe');iframe.title=name;document.querySelector('#stage').replaceChildren(iframe);
 const inputs=check(model.required,true,true)+check(model.functional)+(mode==='missing'?'':model.reject.map((id,i)=>check(id,true,mode==='locked'&&i===0)).join(''))+(mode==='unknown'?check('unmapped-vendor-interest',true):'');
 const attrs=id=>`id="${id}" class="${id}"`;
 const panel=`<section ${attrs(model.panel)} ${model.panel!==model.banner?'hidden':''}>${inputs}<button ${attrs(model.save)}>Save selected preferences</button><button id="accept-all">Accept all</button></section>`;
 const markup=model.panel===model.banner?panel:`<div ${attrs(model.banner)}><button ${attrs(model.open)}>Preferences</button></div>${panel}`;
 iframe.srcdoc=`<!doctype html><html><head><script src="/consent.js"></script></head><body>${markup}<script>
 window.saved=null;window.acceptedAll=false;document.querySelector('#accept-all').onclick=()=>window.acceptedAll=true;
 const opener=document.getElementById(${JSON.stringify(model.open)});if(opener)opener.onclick=()=>{document.getElementById(${JSON.stringify(model.panel)}).hidden=false;};
 document.getElementById(${JSON.stringify(model.save)}).onclick=()=>{window.saved=Object.fromEntries([...document.querySelectorAll('input')].map(e=>[e.id,e.checked]));document.body.style.display='none';};
 if(${JSON.stringify(mode)}==='revert')document.getElementById(${JSON.stringify(model.reject[0])}).onclick=e=>setTimeout(()=>e.target.checked=true,10);
 HarborConsent.configure(${mode!=='disabled'});
 </script></body></html>`;
 await new Promise(resolve=>iframe.onload=resolve);await sleep(1700);
 const win=iframe.contentWindow;
 let okay=!win.acceptedAll;
 if(mode==='normal')okay=okay&&!!win.saved&&win.saved[model.required]&&win.saved[model.functional]&&model.reject.every(id=>win.saved[id]===false);
 else okay=okay&&win.saved===null;
 const li=document.createElement('li');li.className=okay?'pass':'fail';li.textContent=`${okay?'PASS':'FAIL'} · ${name} — ${win.HarborConsent.status()}`;document.querySelector('#results').append(li);if(okay)passed++;else failed++;
 win.HarborConsent.configure(false);iframe.remove();
}
for(const model of models)await test(`${model.name}: functional + necessary, all others off`,model);
for(const mode of ['unknown','missing','locked','revert','disabled'])await test(`No consent submitted: ${mode} categories/state`,models[0],mode);
document.querySelector('#status').textContent=`${passed} passed; ${failed} failed. ${failed?'Needs repair.':'All consent fixture checks passed.'}`;
document.title=`Harbor consent tests — ${passed} passed, ${failed} failed`;
