/* Conservative, local consent automation. No text-only "accept" heuristics. */
(() => {
  const PROFILES = [
    {name:'OneTrust',banner:'#onetrust-banner-sdk',panel:'#onetrust-pc-sdk',open:'#onetrust-pc-btn-handler',save:'.save-preference-btn-handler',inputs:'input[type="checkbox"][id^="ot-group-id-"]',required:['ot-group-id-C0001'],functional:['ot-group-id-C0003'],known:/^ot-group-id-C000[1-5]$/,expected:['ot-group-id-C0002','ot-group-id-C0003','ot-group-id-C0004']},
    {name:'Cookiebot',banner:'#CybotCookiebotDialog',panel:'#CybotCookiebotDialog',open:'#CybotCookiebotDialogBodyLevelButtonCustomize, #CybotCookiebotDialogBodyButtonDetails',save:'#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection, #CybotCookiebotDialogBodyButtonAcceptSelected',inputs:'input[type="checkbox"][id^="CybotCookiebotDialogBodyLevelButton"]',required:['CybotCookiebotDialogBodyLevelButtonNecessary'],functional:['CybotCookiebotDialogBodyLevelButtonPreferences'],known:/^CybotCookiebotDialogBodyLevelButton(Necessary|Preferences|Statistics|Marketing)$/,expected:['CybotCookiebotDialogBodyLevelButtonPreferences','CybotCookiebotDialogBodyLevelButtonStatistics','CybotCookiebotDialogBodyLevelButtonMarketing']},
    {name:'Complianz',banner:'.cmplz-cookiebanner',panel:'.cmplz-cookiebanner',open:'.cmplz-view-preferences',save:'.cmplz-save-preferences',inputs:'input[type="checkbox"][id^="cmplz-"]',required:['cmplz-functional-optin'],functional:['cmplz-preferences-optin'],known:/^cmplz-(functional|preferences|statistics|marketing)-optin$/,expected:['cmplz-statistics-optin','cmplz-marketing-optin']},
    {name:'CookieYes',banner:'.cky-consent-container',panel:'.cky-preference-center',open:'.cky-btn-customize',save:'.cky-btn-preferences',inputs:'input[type="checkbox"][id^="ckySwitch"]',required:['ckySwitchnecessary'],functional:['ckySwitchfunctional'],known:/^ckySwitch(necessary|functional|analytics|performance|advertisement|other)$/,expected:['ckySwitchfunctional','ckySwitchanalytics','ckySwitchadvertisement']}
  ];
  let active=false, observer, timer, running=false, generation=0, attempts=0, result='Waiting for a supported cookie dialog';
  const handled=new WeakSet();
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function visible(node){return !!node && node.isConnected && node.getClientRects().length>0 && getComputedStyle(node).visibility!=='hidden' && getComputedStyle(node).display!=='none' && node.getAttribute('aria-hidden')!=='true';}
  function firstVisible(selector,root=document){return [...root.querySelectorAll(selector)].find(visible);}
  function needsManual(name,reason){result=`${name}: choose cookies manually (${reason})`;}
  async function handle(profile,token) {
    const banner=firstVisible(profile.banner), existing=firstVisible(profile.panel);
    if(!banner&&!existing)return false;
    const anchor=existing??banner;if(handled.has(anchor))return false;
    // Never alter a preferences panel the user already opened unless a banner is still present.
    if(!banner)return false;
    handled.add(anchor);result=`${profile.name}: choosing necessary and functional cookies`;
    let panel=existing;
    const opener=firstVisible(profile.open,banner)??firstVisible(profile.open);
    if(opener){opener.click();await delay(350);}
    if(!active||token!==generation)return true;
    panel=firstVisible(profile.panel);
    if(!panel){needsManual(profile.name,'settings did not open');return true;}
    handled.add(panel);
    const controls=[...panel.querySelectorAll(profile.inputs)];
    const allChecks=[...panel.querySelectorAll('input[type="checkbox"], [role="switch"], [role="checkbox"]')];
    // Unknown controls may represent legitimate-interest/vendor permissions. Do not submit an incomplete panel.
    if(allChecks.some(node=>!controls.includes(node)) || controls.some(c=>!profile.known.test(c.id))){needsManual(profile.name,'unrecognized consent categories');return true;}
    if(!profile.expected.every(id=>controls.some(c=>c.id===id))){needsManual(profile.name,'not all categories are available');return true;}
    const desired=controls.map(control=>({control,value:profile.required.includes(control.id)||profile.functional.includes(control.id)}));
    // Preflight every control before making any change.
    if(desired.some(({control,value})=>(control.disabled||control.getAttribute('aria-disabled')==='true')&&control.checked!==value)){needsManual(profile.name,'a cookie category is locked');return true;}
    const save=firstVisible(profile.save,panel);
    if(!save||save.disabled||save.getAttribute('aria-disabled')==='true'){needsManual(profile.name,'no recognized save action');return true;}
    for(const {control,value} of desired){
      if(!active||token!==generation)return true;
      if(control.checked!==value){control.click();await delay(60);}
    }
    await delay(160);
    if(!active||token!==generation)return true;
    if(desired.some(({control,value})=>!control.isConnected||control.checked!==value)){needsManual(profile.name,'preferences did not stay selected');return true;}
    // Re-check the complete control set immediately before committing.
    if(panel.querySelectorAll('input[type="checkbox"], [role="switch"], [role="checkbox"]').length!==allChecks.length){needsManual(profile.name,'categories changed');return true;}
    save.click();await delay(500);
    result=visible(panel)?`${profile.name}: preferences submitted; check the remaining dialog`:`${profile.name}: necessary and functional preferences submitted`;
    return true;
  }
  async function scan(){
    timer=undefined;if(!active||running||attempts>=60)return;running=true;attempts++;
    const token=generation;
    try{for(const profile of PROFILES){if(!active||token!==generation)break;if(await handle(profile,token))break;}}
    catch{result='Cookie dialog could not be handled. Choose cookies manually.';}
    finally{running=false;}
  }
  function schedule(){if(active&&!timer&&attempts<60)timer=setTimeout(scan,200);}
  function configure(enabled){
    if(enabled===active)return;
    active=enabled;generation++;clearTimeout(timer);timer=undefined;observer?.disconnect();
    if(!active){result='Automatic cookie choices paused';return;}
    attempts=0;result='Waiting for a supported cookie dialog';
    observer=new MutationObserver(schedule);observer.observe(document.documentElement??document,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']});schedule();
  }
  globalThis.HarborConsent=Object.freeze({configure,status:()=>result});
})();
