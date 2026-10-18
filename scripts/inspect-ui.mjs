import {chromium} from "../frontend/node_modules/playwright-core/index.mjs";
const browser=await chromium.launch({channel:"chrome",headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.on("pageerror",error=>console.log("PAGE ERROR",error.message));
await page.goto("http://127.0.0.1:5173/",{waitUntil:"networkidle"});
await page.evaluate(()=>document.fonts.ready);
console.log("DESIGN",await page.evaluate(()=>({heading:getComputedStyle(document.querySelector('h1')).fontFamily,body:getComputedStyle(document.body).fontFamily})));
console.log("IMAGES",await page.locator("img").evaluateAll(imgs=>imgs.map(i=>({src:i.src,complete:i.complete,width:i.naturalWidth,height:i.naturalHeight}))));
await page.screenshot({path:".runtime/serif-desktop.png",fullPage:true});
await page.screenshot({path:".runtime/serif-first-screen.png"});
for(const width of [375,768,1440,1920]){
  await page.setViewportSize({width,height:1000});
  console.log("OVERFLOW",width,await page.evaluate(()=>[...document.querySelectorAll("body *")].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right})).slice(0,12)));
  if(width===375)await page.screenshot({path:".runtime/serif-mobile.png",fullPage:true});
}
await browser.close();
