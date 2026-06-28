import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const downloadPath = path.resolve(__dirname, 'downloads');

if (!fs.existsSync(downloadPath)) {
  fs.mkdirSync(downloadPath);
}

(async () => {
  console.log("Starting browser...");
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath,
  });

  console.log("Navigating to local app...");
  await page.goto('http://localhost:5188');

  await new Promise(r => setTimeout(r, 20000));
  
  console.log("Clicking pause button...");
  try {
    const pauseFound = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const pause = btns.find(b => b.textContent.includes('HALT'));
      if (pause) { pause.click(); return true; }
      return false;
    });
    console.log("Pause found?", pauseFound);
    
    await new Promise(r => setTimeout(r, 1000));
    
    console.log("Clicking export button...");
    const expFound = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      console.log("Buttons text:");
      btns.forEach(b => console.log(b.textContent));
      const exp = btns.find(b => b.textContent.includes('EXPORT') || b.textContent.includes('SNAPSHOT'));
      if (exp) { exp.click(); return true; }
      return false;
    });
    console.log("Export found?", expFound);
    
    console.log("Clicked! Waiting for download...");
    await new Promise(r => setTimeout(r, 5000));
    
    const files = fs.readdirSync(downloadPath);
    console.log("Downloaded files:", files);
    if (files.length > 0) {
      const filePath = path.join(downloadPath, files[0]);
      const stats = fs.statSync(filePath);
      console.log(`File size: ${stats.size} bytes`);
      const content = fs.readFileSync(filePath, 'utf8');
      console.log("First 500 characters:");
      console.log(content.substring(0, 500));
      
      console.log("Last 500 characters:");
      console.log(content.substring(Math.max(0, content.length - 500)));
    } else {
      console.log("No file downloaded.");
    }
  } catch(e) {
    console.log("Failed. Error:", e);
  }
  await browser.close();
})();
