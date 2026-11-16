import React from 'react';
import {createRoot} from 'react-dom/client';
import {BulkPlayerImport} from './BulkPlayerImport.jsx';
const players=[{id:'1',name:'Caroline',alliance:'HOT',searchFields:['681766601']},{id:'2',name:'REINTLESS RKG',alliance:'HOT',searchFields:['681766602']},{id:'3',name:'8ARI',alliance:'ARC',searchFields:['681766603']},{id:'4',name:'Бакит Кыргыз',alliance:'HOT',searchFields:['681766604']}];
function Harness(){
 const [saved,setSaved]=React.useState([]);
 return <><BulkPlayerImport players={players} alliance="HOT" context="TAL Planner" roleLabel="Match troop power" requirePower title="Import troop power" onConfirm={rows=>{setSaved(rows);return {message:rows.length+' saved in test fixture'};}} onClose={()=>{}}/><output aria-label="Saved import">{JSON.stringify(saved)}</output></>;
}
createRoot(document.getElementById('root')).render(<Harness/>);
