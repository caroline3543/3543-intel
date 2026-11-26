import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const screenshotDir = process.env.ROSTER_SCREENSHOTS_DIR;
if (!screenshotDir) throw new Error('Set ROSTER_SCREENSHOTS_DIR to the original screenshot directory.');
const supplied = (await readdir(screenshotDir)).filter(name => /^IMG_98[45]\d\.(jpeg|png)$/.test(name)).sort();
assert.equal(supplied.length, 20);
const fixture = new URL('/event-preview.html', process.env.EVENT_PREVIEW_ORIGIN || 'http://127.0.0.1:4187');
const server = process.env.EVENT_PREVIEW_ORIGIN ? null :
  spawn('./node_modules/.bin/vite', ['preview', 'roster-site', '--host', '127.0.0.1', '--port', '4187', '--strictPort']);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const image = async (name, alias = name) => ({ name: alias, mimeType: name.endsWith('.png') ? 'image/png' : 'image/jpeg', buffer: await readFile(join(screenshotDir, name)) });
const first = await image(supplied[0]);
let browser;
try {
  for (let attempt = 0; attempt < 40; attempt++) {
    try { if ((await fetch(fixture)).ok) break; } catch {}
    await delay(250);
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
  const options = { viewport:{width:428,height:926}, isMobile:true, hasTouch:true, deviceScaleFactor:3 };
  const page = await browser.newPage(options);
  page.setDefaultTimeout(15000);
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) errors.push(response.status()+' '+response.url()); });
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  await page.goto(fixture.href);
  const uploader = page.getByRole('region', { name:'Troop power upload' });
  const upload = uploader.locator('input[type=file]');
  await upload.setInputFiles([first, { ...first, name:'same-image.jpeg' }, { name:'notes.txt', mimeType:'text/plain', buffer:Buffer.from('bad') },
    { name:'corrupt.jpeg', mimeType:'image/jpeg', buffer:Buffer.from('bad JPEG') }]);
  await uploader.getByText(/Duplicate screenshots were skipped/).waitFor();
  await uploader.getByText('0 of 2 screenshots read', {exact:true}).waitFor();
  await uploader.getByRole('button', {name:'Scan screenshots'}).click();
  await uploader.getByText('Could not read this screenshot.', {exact:true}).waitFor();
  await uploader.getByText('1 of 2 screenshots read', {exact:true}).waitFor();
  await uploader.getByRole('button', {name:/Resume or retry/}).click();
  await uploader.getByRole('button', {name:/Review Legion 1/}).click();
  const review = uploader.getByRole('region', {name:'Review screenshot readings'});
  const firstRow = review.locator('.ocr-reading').filter({hasText:"Frankie's Pet"});
  await firstRow.locator('summary').first().click();
  await firstRow.getByText(/Screenshot evidence/).click();
  await firstRow.getByRole('img', {name:/Roster screenshot/}).waitFor();
  await firstRow.getByRole('searchbox').fill('Aster');
  await firstRow.getByRole('button', {name:/Aster · ARC/}).click();
  await review.getByRole('combobox', {name:'Import mode'}).selectOption('both');
  await firstRow.getByRole('combobox', {name:/Registration for/}).selectOption('join');
  await firstRow.getByRole('textbox', {name:/Troop power for/}).fill('6,095');
  await firstRow.getByRole('searchbox').fill('sample-8');
  assert.equal(await firstRow.getByRole('combobox', {name:/Registration for/}).inputValue(), 'join');
  for (const node of (await review.locator('.ocr-reading').all()).slice(1)) {
    await node.locator('summary').first().click();
    await node.getByRole('checkbox', {name:'Skip this reading'}).check();
  }
  await review.getByRole('button', {name:'Review troop powers and registrations changes'}).click();
  const confirm = review.getByRole('region', {name:'Confirm screenshot import'});
  await confirm.getByText(/Legion 2 · Substitute → ARC · Legion 1 · Combatant/).waitFor();
  await confirm.getByText(/→ 6,095/).waitFor();
  await confirm.getByRole('button', {name:/Confirm registration moves/}).click();
  await review.getByText('Saved to the sample roster in this tab.').waitFor();
  await page.getByRole('button', { name:'Aster · Legion 1 Combatant', exact:true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name:'Aster · Legion 1 Combatant', exact:true }).waitFor();
  await uploader.getByText('1 of 2 screenshots read', {exact:true}).waitFor();
  await uploader.getByRole('button', {name:/Review Legion 1/}).click();
  await firstRow.locator('summary').first().click();
  await firstRow.getByRole('searchbox').fill('Aster');
  await firstRow.getByRole('button', {name:/Aster · ARC/}).click();
  for (const node of (await review.locator('.ocr-reading').all()).slice(1)) {
    await node.locator('summary').first().click();
    await node.getByRole('checkbox', {name:'Skip this reading'}).check();
  }
  await review.getByRole('button', {name:'Review troop powers changes'}).click();
  await review.getByRole('button', {name:'Save troop powers'}).click();
  await review.getByText(/already imported from this batch/).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  assert.ok(!requests.some(path => path.startsWith('/api/')), 'The sample preview contacted a workspace API.');
  console.log('PASS 428×926: actual OCR, evidence, identity search, inline power, combined transfer, local persistence and duplicate import guard');
  await page.close();

  const bulk = await browser.newPage(options);
  bulk.setDefaultTimeout(90000);
  bulk.on('pageerror', error => errors.push(error.message));
  await bulk.goto(fixture.href);
  const files = await Promise.all(supplied.map(name => image(name)));
  // Distinct payloads with unchanged decoded pixels test the file-count limit.
  const loadOnly = files.slice(0, 6).map((item, index) => ({ ...item,
    name:'load-'+index+'-'+item.name, buffer:Buffer.concat([item.buffer, Buffer.from('batch load case '+index)]) }));
  await bulk.locator('.screenshot-import input[type=file]').setInputFiles([...files, ...loadOnly]);
  await bulk.getByText('0 of 25 screenshots read', {exact:true}).waitFor();
  await bulk.getByText('A batch can contain up to 25 screenshots.').waitFor();
  const started = performance.now();
  await bulk.getByRole('button', {name:'Scan screenshots'}).click();
  await bulk.getByText('1 of 25 screenshots read', {exact:true}).waitFor();
  await bulk.getByRole('button', {name:'Stop scan'}).click();
  const resume = bulk.getByRole('button', {name:/Resume or retry/});
  await bulk.waitForFunction(() => !document.querySelector('.screenshot-import > button:disabled'));
  await bulk.reload();
  assert.match(await bulk.locator('.screenshot-import > p').nth(1).textContent(), /^[1-9] of 25 screenshots read$/);
  await resume.click();
  await bulk.getByText('25 of 25 screenshots read', {exact:true}).waitFor();
  assert.equal(await bulk.evaluate(() => sessionStorage.getItem('3573-event-preview-fixture-v1')), null);
  assert.deepEqual(errors, []);
  console.log('PASS: 25 screenshots processed, 26th skipped, stopping and reload recovery worked, no roster mutation. Batch wall time '+Math.round(performance.now()-started)+' ms');
} finally {
  await browser?.close();
  server?.kill();
}
