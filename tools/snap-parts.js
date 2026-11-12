// Element screenshots of the running preview.  node tools/snap-parts.js <url> <out-prefix> <width> <selector> [<selector> ...]
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer');

(async () => {
  const [url, out, width, ...sels] = process.argv.slice(2);
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const w = +width;
  await page.setViewport({ width: w, height: 1000, deviceScaleFactor: w < 600 ? 2 : 1, isMobile: w < 600, hasTouch: w < 600 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.addStyleTag({ content: '.topbar{position:relative!important;top:0!important}' });
  await new Promise(r => setTimeout(r, 500));
  let n = 0;
  for (const sel of sels) {
    const els = await page.$$(sel);
    for (const el of els) {
      await el.screenshot({ path: out + '-' + (++n) + '.png' });
      console.log('wrote', out + '-' + n + '.png', sel);
    }
  }
  await browser.close();
})();
