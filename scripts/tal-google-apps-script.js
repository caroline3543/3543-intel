/**
 * Card-free read-only connector for State 3573 TAL.
 *
 * Set Script Properties -> TAL_BRIDGE_SECRET to a randomly generated secret
 * of at least 32 characters. Set that same secret only as a server-side
 * GOOGLE_TAL_SCRIPT_SECRET environment variable on Vercel.
 *
 * Deploy -> New deployment -> Web app
 * Execute as: Me
 * Who has access: Anyone (the script checks the secret on every POST)
 *
 * The script has no doGet and never returns data without the secret.
 * Keep the spreadsheet itself private and do not publish it to the web.
 */
const TAL_SHEET_ID='1iHHBMYDu2FF3HjNTzas8VoyzUQz7_3L__ZS48EDXMdY';
const TAL_READ_TABS={
  'Players':250,
  'Availability':250,
  'State Roster':500,
  'HOT - Legion 1':100,
  'ARC - Legion 2':100,
  'RKG - Legion 3':100,
  'Language Sources':500,
};
const TAL_MAX_COLUMNS={
  'Players':40,'Availability':12,'State Roster':22,
  'HOT - Legion 1':24,'ARC - Legion 2':9,
  'RKG - Legion 3':9,'Language Sources':5,
};
function json_(data){
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e){
  let input;
  try{input=JSON.parse(e.postData.contents||'{}');}
  catch{return json_({error:'unauthorized'});}
  const secret=PropertiesService.getScriptProperties().getProperty('TAL_BRIDGE_SECRET');
  if(!secret||secret.length<32||typeof input.token!=='string'||input.token!==secret||input.action!=='readTalSheet'){
    return json_({error:'unauthorized'});
  }
  try{
    const book=SpreadsheetApp.openById(TAL_SHEET_ID);
    const sheets={};
    Object.keys(TAL_READ_TABS).forEach(function(title){
      const tab=book.getSheetByName(title);
      if(!tab)throw new Error('Missing required worksheet '+title);
      const rows=Math.min(tab.getLastRow(),TAL_READ_TABS[title]);
      const columns=Math.min(tab.getLastColumn(),TAL_MAX_COLUMNS[title]);
      sheets[title]={values:rows&&columns?tab.getRange(1,1,rows,columns).getValues().map(function(row){
        return row.map(function(value){
          return value instanceof Date ? value.toISOString() : value;
        });
      }):[]};
    });
    return json_({spreadsheetId:TAL_SHEET_ID,sheets:sheets});
  }catch(error){
    // No raw exception messages: they may reveal private workbook details.
    console.error(error);
    return json_({error:'source_unavailable'});
  }
}
