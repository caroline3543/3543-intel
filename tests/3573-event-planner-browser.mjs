import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const origin='http://127.0.0.1:4184';
const server=spawn('./node_modules/.bin/vite',['preview','roster-site','--host','127.0.0.1','--port','4184','--strictPort'],{stdio:'inherit'});
let browser;
try {
  for(let i=0;i<45;i++){
    try{if((await fetch(origin+'/event-preview.html')).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  browser=await chromium.launch();
  for(const width of [390,1280]){
    const page=await browser.newPage({viewport:{width,height:844}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-11-26T00:30:00Z'));
    await page.goto(origin+'/event-preview.html');
    const foundry=page.getByRole('combobox',{name:'Foundry registration alliance'});
    assert.deepEqual((await foundry.locator('option').allTextContents()).slice(0,4),['ARC','HOT','RKG','WAR']);
    assert.ok(await page.getByRole('button',{name:'Buildings',exact:true}).isVisible());
    const legion=page.getByRole('combobox',{name:'Legion',exact:true});
    await legion.selectOption('2');
    assert.equal(await page.getByRole('checkbox',{name:/Opted in/}).count(),0);
    await legion.selectOption('1');
    const input=page.getByRole('textbox',{name:'Troop power for Northvale',exact:true});
    await input.fill('946105130');await input.press('Enter');
    await page.getByRole('button',{name:'Open profile for Northvale',exact:true}).click();
    const profile=page.getByRole('dialog',{name:/Player profile/});
    const eventPower=profile.locator('.soft-profile-stats.event-stats');
    await eventPower.getByText('946,105,130',{exact:true}).waitFor();
    await eventPower.getByText('98,256,120',{exact:true}).waitFor();
    await eventPower.getByText('1.52B',{exact:true}).waitFor();
    await profile.getByRole('button',{name:'Close profile'}).click();

    const optIn=page.getByRole('checkbox',{name:'Opted in: Kite'});
    await optIn.click();
    await page.getByRole('button',{name:/^Not participating.*2/}).click();
    assert.equal(await optIn.isChecked(),false);
    await optIn.click();
    await page.getByRole('button',{name:'Combatant',exact:true}).last().click();
    await page.getByRole('button',{name:'Teams',exact:true}).click();
    const count=page.getByRole('combobox',{name:'Teams per legion'});
    for(const size of [3,4,5,6])await count.selectOption(String(size));
    await page.getByRole('button',{name:/Generate teams/}).click();
    await page.getByRole('button',{name:/Regenerate all teams/}).click();
    const purple=page.getByRole('heading',{name:/^Purple team/});
    await purple.waitFor();
    await page.getByRole('button',{name:/Move Northvale to another team/}).click();
    await page.getByRole('group',{name:'Move Northvale to',exact:true}).getByRole('button',{name:'Purple',exact:true}).click();
    await page.locator('[data-team-card="Purple"]').getByText('Northvale',{exact:true}).waitFor();
    await count.selectOption('3');
    await page.getByRole('combobox',{name:'Assign Northvale to team',exact:true}).waitFor();

    await page.getByRole('button',{name:'Players',exact:true}).click();
    await page.getByLabel('Event date (UTC)',{exact:true}).fill('2026-11-25');
    await page.getByLabel('Event start time (UTC)',{exact:true}).fill('23:30');
    await page.getByRole('button',{name:'Save schedule'}).click();
    await page.getByText('Attendance',{exact:true}).click();
    await page.getByRole('combobox',{name:'Attendance for Northvale'}).selectOption('no-show');
    const substitute=page.getByRole('combobox',{name:'Attendance for Lumen'});
    assert.equal(await substitute.locator('option[value="no-show"]').isDisabled(),true);
    await substitute.selectOption('not-called');
    assert.equal(await page.getByRole('combobox',{name:'Attendance for Cypress'}).count(),0);

    await page.getByRole('navigation',{name:'Choose event planner'}).getByRole('button',{name:'Canyon Clash'}).click();
    assert.equal(await page.getByRole('button',{name:'Buildings',exact:true}).count(),0);
    const search=page.getByRole('textbox',{name:'Search and add player by name or ID'});
    await search.fill('Northvale');
    const candidate=page.getByRole('button',{name:/Northvale.*Recent no-show/});
    await candidate.click();
    const canyon=page.getByRole('textbox',{name:'Canyon Clash power for Northvale',exact:true});
    await canyon.fill('1251234567');await canyon.press('Enter');
    await page.getByRole('button',{name:'Open profile for Northvale'}).click();
    await eventPower.getByText('1.25B',{exact:true}).waitFor();
    await profile.getByText('Event attendance',{exact:true}).click();
    const attendanceHistory=profile.locator('details[open]').filter({hasText:'Event attendance'});
    assert.match(await attendanceHistory.innerText(),/Combatant\s*No-show/);
    await profile.getByRole('button',{name:'Close profile'}).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.deepEqual(errors,[]);
    console.log('Foundry and Canyon Clash verified at '+width+'px');
    await page.close();
  }
} finally {await browser?.close();server.kill();}
