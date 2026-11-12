// Render a local HTML file to PNG.  node tools/shot.js <in.html> <out.png> [width] [height] [scale]
const path = require('path');
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer');

(async () => {
  const [inFile, outFile, w = '924', h = '2000', scale = '1'] = process.argv.slice(2);
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: +w, height: +h, deviceScaleFactor: +scale });
  await page.goto('file:///' + path.resolve(inFile).replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  await page.screenshot({ path: outFile, clip: { x: 0, y: 0, width: +w, height: +h } });
  await browser.close();
  console.log('wrote', outFile);
})();
