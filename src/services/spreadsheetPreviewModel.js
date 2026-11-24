/** Pure read-only import preview model for a sheet after the server fetches rows.
 * No database mutations. Requires manual approval before any import.
 */
import { previewWorksheet } from './spreadsheetImportPreview.js';

export function buildSpreadsheetPreview({spreadsheetId, metadata, worksheetId, values, players, stateId, headerRow=1}) {
  if (!metadata || !Array.isArray(metadata.sheets)) throw new Error('Missing spreadsheet metadata');
  const worksheet=metadata.sheets.find(s=>s.properties?.sheetId===worksheetId);
  if (!worksheet) throw new Error('Worksheet ID not found in spreadsheet');
  const candidate=previewWorksheet({values,players,stateId,headerRow});
  return {
    spreadsheetId,
    spreadsheetTitle:metadata.properties?.title ?? '',
    worksheetId,
    worksheetTitle:worksheet.properties.title,
    ...candidate,
    approvalRequired:true,
    writeEnabled:false,
    recommendedFieldMapping:candidate.headers.map((header,index)=>{
      const key=header.trim().toLowerCase();
      const recognized={
        'record id':'record_id','record_id':'record_id',
        'player id':'chief_id','chief id':'chief_id','fid':'chief_id',
        'username':'username','player name':'username',
        'alliance':'allianceTag','alliance tag':'allianceTag',
        'furnace':'furnaceLevel','furnace level':'furnaceLevel',
        'power':'power','kills':'kills','notes':'notes',
      };
      const field=recognized[key]??null;
      return {index,header,field,authority:['username','allianceTag','furnaceLevel','power','kills'].includes(field)?'api':'manual'};
    }),
  };
}
