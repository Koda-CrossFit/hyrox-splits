// Full-page screenshots of the running preview.  node tools/snap.js <url> <out-prefix> [widths=1280,390]
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer');

(async () => {
  const [url, out, widths = '1280,390'] = process.argv.slice(2);
  const browser = await puppeteer.launch({ headless: 'new' });
  for (const w of widths.split(',').map(Number)) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1, isMobile: w < 600, hasTouch: w < 600 });
    await page.goto(url, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.screenshot({ path: out + '-' + w + '.png', fullPage: true });
    console.log(w, 'overflow-x px:', overflow, errs.length ? 'errors: ' + errs.join(' | ') : '');
    await page.close();
  }
  await browser.close();
})();
