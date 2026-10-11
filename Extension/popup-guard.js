// Runs in the page's own JavaScript world from document_start, before page scripts (Safari 18 and later).
// Refuses window.open() soon after a tap on plain page content, which is how tap-anywhere pop-up ads open.
// Taps on links, buttons and other controls are unaffected. content.js turns it off where Harbor is paused.
(() => {
  let allowed=false, tap=null;
  addEventListener('harbor:popups-allowed',()=>{allowed=true;});
  addEventListener('harbor:popups-blocked',()=>{allowed=false;});
  const remember=event=>{if(event.isTrusted)tap={time:performance.now(),target:event.composedPath()[0]};};
  for(const type of ['pointerdown','touchstart','mousedown','click'])addEventListener(type,remember,{capture:true,passive:true});
  const controls='a[href],area[href],button,input,select,textarea,label,summary,[role="button"],[role="link"],[role="menuitem"],[role="tab"],[contenteditable]:not([contenteditable="false"])';
  const intended=node=>{const el=node instanceof Element?node:node?.parentElement;return !!el&&(!!el.closest(controls)||getComputedStyle(el).cursor==='pointer');};
  // A pop-up script that is refused may send this page to the ad instead, so it gets a window that does nothing.
  const inert=key=>key==='closed'?false:key==='then'?undefined:key===Symbol.toPrimitive?()=>'':fake;
  const fake=new Proxy(()=>{},{get:(_,key)=>inert(key),set:()=>true,apply:()=>fake});
  const decoy=new Proxy({},{get:(_,key)=>inert(key),set:()=>true});
  const open=window.open;
  window.open=function(...args){
    if(!allowed&&tap&&performance.now()-tap.time<5000&&!intended(tap.target))return decoy;
    return Reflect.apply(open,this,args);
  };
})();
