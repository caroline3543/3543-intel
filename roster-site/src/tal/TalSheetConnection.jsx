import {useState} from 'react';
import {Card,Hint,button,C} from './ui.jsx';
import {talSheetPreview,TAL_SHEET_URL} from './sheetSync.js';

export function TalSheetConnection({data,onImport,locked=false}){
 const [loading,setLoading]=useState(false),[snapshot,setSnapshot]=useState(null),[review,setReview]=useState(null),[error,setError]=useState('');
 async function refresh(){
  if(loading)return;
  setLoading(true);setSnapshot(null);setReview(null);setError('');
  try{
   const response=await fetch('/api/tal-sheet',{credentials:'same-origin',cache:'no-store'});
   const payload=await response.json();
   if(!response.ok)throw Error(payload.error||'Unable to read the spreadsheet.');
   const result=talSheetPreview(data,payload);
   setSnapshot(payload);setReview(result);
  }catch(err){setError(err.message||'Unable to refresh the spreadsheet.');}
  finally{setLoading(false);}
 }
 function importSnapshot(){
  if(!snapshot||!review)return;
  try{
   onImport(snapshot);
   setSnapshot(null);setReview(null);setError('');
  }catch(err){setError(err.message||'Unable to import.');}
 }
 const last=data.settings?.sheetImport;
 return <Card title="Google Sheets connection">
   <Hint>State 3573 · TAL Nov-4. Read-only source. Player IDs match sheet records to Members; importing will not delete players, change legion assignments or overwrite battle plans.</Hint>
   <a href={TAL_SHEET_URL} target="_blank" rel="noreferrer" style={{color:C.gold,fontSize:13,display:'block',padding:'8px 0'}}>Open source spreadsheet</a>
   <p style={{color:C.icy,fontSize:13,margin:'8px 0'}}>
     {last?.importedAt?'Last imported '+new Date(last.importedAt).toLocaleString():'No live import recorded yet'}
   </p>
   <button type="button" style={{...button,width:'100%',color:C.gold}} disabled={loading} onClick={refresh}>{loading?'Checking Google Sheets…':'Refresh sheet & review changes'}</button>
   {error&&<p role="alert" style={{fontSize:13,color:C.gold,lineHeight:1.5}}>{error}</p>}
   {review&&<section aria-label="Google Sheets import review" style={{marginTop:12,padding:10,borderRadius:10,background:C.section}}>
     <strong style={{fontSize:15}}>Review changes before import</strong>
     <p style={{fontSize:13,color:C.icy,lineHeight:1.6}}>Sheet rows: {review.total} · Valid unique IDs: {review.valid} · Changes: {review.changes.length} · New members: {review.newPlayers} · ID issues: {review.invalid.length}</p>
     <Hint>{review.warning}</Hint>
   {locked&&<p role="status" style={{fontSize:13,color:C.gold}}>This TAL plan is locked. You can inspect the sheet, but must unlock the plan before importing.</p>}
     {!!review.invalid.length&&<details><summary style={{minHeight:44,color:C.gold}}>Review {review.invalid.length} skipped ID issues</summary>
       {review.invalid.slice(0,30).map(row=><p key={row.row} style={{fontSize:12,color:C.icy}}>Row {row.row} · {row.name||'Unnamed'}: {row.reason}</p>)}
     </details>}
     {!!review.changes.length&&<details><summary style={{minHeight:44,color:C.icy}}>Review {review.changes.length} changed entries</summary>
       {review.changes.slice(0,40).map(row=><p key={row.fid} style={{fontSize:12,color:C.icy,margin:'6px 0'}}>{row.name||row.fid} · {row.newPlayer?'New member':'Update sheet evidence'} · {row.selection} · {row.registration} · {row.sourceLegion||'No legion'}</p>)}
       {review.changes.length>40&&<p style={{fontSize:12,color:C.icy}}>Showing first 40 changes.</p>}
     </details>}
     <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:12}}>
       <button type="button" style={button} onClick={()=>{setSnapshot(null);setReview(null);}}>Cancel</button>
       <button type="button" style={{...button,background:C.gold,color:C.bg,fontWeight:700}} disabled={locked||!review.valid} onClick={importSnapshot}>Confirm import</button>
     </div>
   </section>}
   <details style={{marginTop:10}}><summary style={{color:C.icy,fontSize:13,minHeight:36}}>Connection requirements</summary>
     <Hint>The deployed app needs a Google service account with Viewer access to this sheet. Its credentials must be configured securely on Vercel. Signing in to ChatGPT does not automatically authorise the website.</Hint>
   </details>
 </Card>;
}
