import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const port = 4182;
const origin = `http://127.0.0.1:${port}`;
const server = spawn('./node_modules/.bin/vite',['preview','roster-site','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'inherit'});
const route = '/profile-preview.html';
const captures = process.env.PROFILE_CAPTURE_DIR || 'profile-review-captures';
const order = ['Troop tiers','Quick stats','Last recorded event power','Last known location','Alliance rank','Last 4 alliance movements','Identity','Joiner heroes','Teamwork','Officer notes','More'];
let browser;
try {
  await mkdir(captures,{recursive:true});
  let ready = false;
  for(let i=0;i<40;i++) {
    try {ready = (await fetch(origin+route)).ok;} catch {}
    if(ready)break;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.equal(ready,true);
  browser = await chromium.launch({headless:true});
  for(const width of [320,428,1280]) {
    const context = await browser.newContext({viewport:{width,height:850},permissions:['clipboard-read','clipboard-write']});
    const page = await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+route);
    const profile=page.getByRole('dialog',{name:/Player profile/});
    await profile.waitFor();
    assert.deepEqual(await profile.locator('.soft-profile-body > section > .soft-profile-card-heading > h3').allTextContents(),order);
    assert.equal(await profile.getByRole('button',{name:/Copy player ID/}).count(),1);
    for(const event of ['Foundry','TAL','Canyon Clash']) await profile.getByText(event,{exact:true}).waitFor();
    assert.equal(await profile.locator('details[open]').count(),0);
    assert.doesNotMatch(await profile.innerText(),/Battle roles|Check username with API|Rally setup|Troop inventory/i);
    assert.equal(await profile.evaluate(element=>element.scrollWidth<=element.clientWidth),true);
    if(width===428) {
      const capture=async(name,heading)=>{
        if(heading)await profile.getByRole('heading',{name:heading,exact:true}).evaluate(element=>element.closest('section').scrollIntoView({block:'start'}));
        await page.screenshot({path:`${captures}/3573-soft-dark-${name}.png`});
      };
      await capture('top');
      await capture('middle','Alliance rank');
      await capture('bottom','Joiner heroes');
    }
    await profile.getByRole('button',{name:/Edit infantry tier/}).click();
    await profile.getByRole('group',{name:'Infantry tier',exact:true}).getByRole('button',{name:'FC7',exact:true}).click();
    await profile.getByText('Tiers last changed just now').waitFor();
    await profile.getByRole('button',{name:/Copy player ID/}).click();
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'357300012');
    await profile.getByRole('button',{name:'Copy coordinates'}).click();
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'X: 432 · Y: 618');
    await profile.getByRole('button',{name:'R4',exact:true}).click();
    assert.equal(await profile.getByRole('button',{name:'R4',exact:true}).getAttribute('aria-pressed'),'true');
    await profile.getByRole('switch',{name:'Voice chat'}).click();
    assert.equal(await profile.getByRole('switch',{name:'Voice chat'}).getAttribute('aria-checked'),'false');
    const notes=profile.locator('section').filter({has:profile.getByRole('heading',{name:'Officer notes',exact:true})});
    await notes.getByRole('button',{name:'Edit',exact:true}).click();
    await notes.getByRole('textbox',{name:'Officer notes'}).fill('Saved in the fixture');
    await notes.getByRole('button',{name:'Save notes'}).click();
    await notes.getByText('Saved in the fixture').waitFor();
    await profile.getByText('Heroes & gear',{exact:true}).click();
    await profile.getByText('Total hero power').waitFor();
    await page.keyboard.press('Escape');
    await profile.waitFor({state:'hidden'});
    await page.goto(origin+route+'?sparse&readonly');
    await profile.waitFor();
    assert.equal(await profile.evaluate(element=>element.scrollWidth<=element.clientWidth),true);
    assert.ok(await profile.getByText('Not recorded',{exact:true}).count() > 5);
    assert.equal(await profile.getByRole('button',{name:/Edit infantry tier/}).isEnabled(),false);
    assert.equal(await profile.getByRole('switch',{name:'Voice chat'}).isEnabled(),false);
    assert.equal(await profile.getByRole('button',{name:'Edit identity'}).count(),0);
    assert.deepEqual(errors,[]);
    console.log(`Soft Dark profile verified at ${width}px`);
    await context.close();
  }
} finally {await browser?.close();server.kill();}
