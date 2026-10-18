import {chromium} from "../frontend/node_modules/playwright-core/index.mjs";
import assert from "node:assert/strict";
const base="https://localhost:18443";
const browser=await chromium.launch({channel:"chrome",headless:true});
const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
const page=await context.newPage();const errors=[];page.on("pageerror",error=>errors.push(error.message));
try{
  const home=await page.goto(base,{waitUntil:"networkidle"});assert.equal(home.status(),200);
  assert.ok((await page.locator(".hero-story").textContent()).includes("Расул Ахметов"));
  assert.ok(await page.locator("img").evaluateAll(imgs=>imgs.filter(i=>i.getAttribute("loading")!=="lazy").every(i=>i.complete&&i.naturalWidth>0)));
  const health=await context.request.get(`${base}/api/health/`);assert.equal(health.status(),200);
  assert.equal(home.headers()["x-content-type-options"],"nosniff");
  const csrf=async()=> (await (await context.request.get(`${base}/api/v1/auth/csrf/`)).json()).csrfToken;
  const contact=await context.request.post(`${base}/api/v1/contact/`,{headers:{"X-CSRFToken":await csrf(),Origin:base},data:{name:"Container smoke test",email:"smoke@example.com",project_type:"Backend-разработка",message:"Проверка production-схемы: Traefik, Gunicorn, SSR, PostgreSQL.",consent:true}});assert.equal(contact.status(),201);
  const login=await context.request.post(`${base}/api/v1/auth/login/`,{headers:{"X-CSRFToken":await csrf(),Origin:base},data:{username:"owner",password:process.env.E2E_PASSWORD}});assert.equal(login.status(),200);
  const {access}=await login.json();const cookie=(await context.cookies()).find(c=>c.name==="portfolio_refresh");assert.equal(cookie.secure,true);assert.equal(cookie.httpOnly,true);
  assert.equal((await context.request.get(`${base}/api/v1/inbox/`,{headers:{Authorization:`Bearer ${access}`}})).status(),200);
  const logout=await context.request.post(`${base}/api/v1/auth/logout/`,{headers:{"X-CSRFToken":await csrf(),Origin:base}});assert.equal(logout.status(),204);
  assert.equal((await context.request.get(`${base}/api/v1/auth/me/`,{headers:{Authorization:`Bearer ${access}`}})).status(),401);
  await page.goto(`${base}/admin/login/`,{waitUntil:"networkidle"});await page.locator('input[name="username"]').fill("owner");await page.locator('input[name="password"]').fill(process.env.E2E_PASSWORD);await page.locator('input[type="submit"]').click();await page.waitForURL(`${base}/admin/`);
  await page.goto(`${base}/admin/portfolio/sitesettings/1/change/`,{waitUntil:"networkidle"});const name=await page.locator('input[name="name"]').inputValue();
  await page.locator('input[name="name"]').fill(`${name} · CMS`);await page.locator('input[name="_save"]').click();await page.waitForURL(`${base}/admin/portfolio/sitesettings/`);
  await page.goto(base,{waitUntil:"networkidle"});assert.ok((await page.locator(".hero-story").textContent()).includes("· CMS"));
  await page.goto(`${base}/admin/portfolio/sitesettings/1/change/`,{waitUntil:"networkidle"});await page.locator('input[name="name"]').fill(name);await page.locator('input[name="_save"]').click();await page.waitForURL(`${base}/admin/portfolio/sitesettings/`);
  await page.goto(base,{waitUntil:"networkidle"});await page.screenshot({path:".runtime/production-desktop.png",fullPage:true});assert.deepEqual(errors,[]);
  console.log("PASS: TLS routing, SSR, media, security headers, CSRF form, Secure HttpOnly login, private inbox, logout revocation, Django Admin edit reflected in SSR.");
}finally{await browser.close();}
