// Independent scoring of manually labelled screenshots. Rows are paired by vertical position, never by recognised name.
export function scoreScreenshot(expected, actual) {
  const rows = actual.rows ?? [];
  const used = new Set();
  const result = {expected:expected.rows.length, detected:0, nameCorrect:0, powerCorrect:0, registrationCorrect:0, otherLegionCorrect:0, legionCorrect:actual.legion===expected.legion, extra:0, discrepancies:[]};
  for (const label of expected.rows) {
    const candidates=rows.map((row,index)=>({row,index,distance:Math.abs((row.bounds?.top+row.bounds?.bottom)/2-label.center)})).filter(x=>!used.has(x.index)&&x.distance<=0.035).sort((a,b)=>a.distance-b.distance);
    const match=candidates[0];
    if(!match){result.discrepancies.push({expected:label,reason:'missing row'});continue;}
    used.add(match.index);result.detected++;
    const row=match.row;
    const checks={name:row.name===label.name,power:row.power===label.power,registration:row.registration===label.registration,otherLegion:(row.otherLegion??null)===(label.otherLegion??null)};
    for(const [key,ok] of Object.entries(checks))if(ok)result[key+'Correct']++;
    if(Object.values(checks).some(ok=>!ok))result.discrepancies.push({expected:label,actual:row,checks});
  }
  result.extra=rows.length-used.size;
  return result;
}
