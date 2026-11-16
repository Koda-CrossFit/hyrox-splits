// Link-preview card (og:image) for texts / Instagram / Facebook.
//   node tools/og_image.js   → assets/og-splits.jpg (1200x630)
const fs = require('fs');
const path = require('path');
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer');

const ROOT = path.resolve(__dirname, '..');
const mark = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets/koda-mark.png')).toString('base64');

// The Men's Open "Try an example" race as the strengths chart draws it (Run + Roxzone per km), one
// scale for every bar: zero line at 34%, width = 0.6875% per second.
const rows = [['Wall Balls', 66, 'g', '+1:36'], ['Sled Push', 27.5, 'g', '+0:40'], ['Lunges', 9.6, 'g', '+0:14'], ['Row', 9.6, 's', '−0:14'], ['Run+Rox /km', 11.7, 's', '−0:17'], ['Burpee BJ', 14.4, 's', '−0:21']];
const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@500&family=Inter+Tight:wght@800;900&family=Inter:wght@600&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #1A1818; color: #fff; font-family: 'Inter Tight', sans-serif; overflow: hidden; position: relative; }
  .glow { position: absolute; inset: 0; background: radial-gradient(700px 420px at 86% 40%, rgba(255,255,51,0.09), transparent 62%); }
  .bgword { position: absolute; left: -20px; bottom: -80px; font-weight: 900; font-size: 380px; line-height: 0.8; letter-spacing: -0.05em; color: transparent; -webkit-text-stroke: 2px rgba(223,213,195,0.08); }
  .left { position: absolute; left: 64px; top: 70px; width: 720px; }
  .mono { font-family: 'DM Mono', monospace; font-size: 21px; letter-spacing: 0.06em; text-transform: uppercase; color: #E5DDCF; }
  .mono .tag { background: #FFFF33; color: #1A1818; padding: 3px 9px 1px; margin-right: 12px; }
  h1 { font-weight: 900; text-transform: uppercase; font-size: 98px; line-height: 0.9; letter-spacing: -0.035em; margin: 28px 0 26px; }
  .hl { background: #FFFF33; color: #1A1818; padding: 4px 14px 0 8px; margin-left: -8px; display: inline-block; }
  .sub { font-family: 'Inter', sans-serif; font-weight: 600; font-size: 27px; line-height: 1.35; color: #EDEBE7; }
  .brand { position: absolute; left: 64px; bottom: 54px; display: flex; align-items: center; gap: 14px; font-weight: 800; font-size: 24px; text-transform: uppercase; letter-spacing: 0.02em; }
  .brand img { width: 48px; filter: brightness(0) invert(1); }
  .brand span { color: #BDB6AC; font-family: 'DM Mono', monospace; font-weight: 500; font-size: 17px; letter-spacing: 0.06em; margin-left: 6px; }
  .card { position: absolute; right: 56px; top: 92px; width: 352px; border: 1px solid rgba(223,213,195,0.28); background: rgba(255,255,255,0.03); padding: 30px 30px 26px; }
  .card .lab { font-family: 'DM Mono', monospace; font-size: 15px; letter-spacing: 0.06em; text-transform: uppercase; color: #E5DDCF; }
  .card .fin { font-weight: 800; font-size: 30px; letter-spacing: -0.015em; line-height: 1.1; margin: 8px 0 18px; }
  .card .fin span { color: #FFFF33; }
  .r { display: grid; grid-template-columns: 120px 1fr 60px; gap: 10px; align-items: center; padding: 7px 0; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 18px; }
  .r b { text-align: right; font-weight: 600; }
  .t { position: relative; height: 14px; }
  .t::before { content: ''; position: absolute; left: 34%; top: -6px; bottom: -6px; width: 1px; background: rgba(223,213,195,0.3); }
  .t i { position: absolute; top: 2px; height: 10px; }
  .t i.g { left: 34%; background: #FFFF33; border-radius: 0 4px 4px 0; }
  .t i.s { right: 66%; background: #3987E5; border-radius: 4px 0 0 4px; }
</style></head><body>
  <div class="glow"></div>
  <div class="bgword">KODA</div>
  <div class="left">
    <div class="mono"><span class="tag">Free tool</span>Split analyzer for HYROX races</div>
    <h1>Where's your<br><span class="hl">time</span> hiding?</h1>
    <div class="sub">Enter your race splits. See where you're losing the most time.</div>
  </div>
  <div class="brand"><img src="${mark}">Koda CrossFit Iron View <span>Louisville, CO</span></div>
  <div class="card">
    <div class="lab">Strengths &amp; weak spots</div>
    <div class="fin">Men's Open · <span>1:23:11</span></div>
    ${rows.map(r => `<div class="r"><span>${r[0]}</span><div class="t"><i class="${r[2]}" style="width:${r[1]}%"></i></div><b>${r[3]}</b></div>`).join('')}
  </div>
</body></html>`;

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(ROOT, 'assets/og-splits.jpg'), type: 'jpeg', quality: 90 });
  await browser.close();
  console.log('wrote assets/og-splits.jpg');
})();
