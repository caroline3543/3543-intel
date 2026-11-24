/**
 * Pure three-way reconciliation plan. This module never writes to either system.
 * A backend worker must apply actions with locks, revision checks and an outbox.
 */
import { compareCell, sheetCellRange } from './spreadsheetMappingService.js';

export function planSpreadsheetSync({ rows, fields, baselineByRecord, databaseByRecord, sheetByRecord, worksheetTitle }) {
  if (!Array.isArray(rows) || !Array.isArray(fields)) throw new Error('Invalid mappings');
  const rowIds=new Set(), columns=new Set(), operations=[], conflicts=[];
  for (const row of rows) {
    const recordId=String(row.recordId??'');
    if (!recordId || !Number.isSafeInteger(row.sheetRow) || row.sheetRow<2 || rowIds.has(recordId)) {
      throw new Error('Missing, duplicate or invalid record mapping');
    }
    rowIds.add(recordId);
  }
  for (const field of fields) {
    if (!field?.key || !Number.isSafeInteger(field.columnIndex) || field.columnIndex<0 || columns.has(field.columnIndex)) {
      throw new Error('Invalid or duplicate field column');
    }
    columns.add(field.columnIndex);
  }
  const get = (map,id,key) => map?.[id]?.[key];
  for (const row of rows) {
    const id=String(row.recordId);
    if (!Object.hasOwn(databaseByRecord??{},id)) {
      conflicts.push({recordId:id,reason:'missing_database_record'});
      continue;
    }
    if (!Object.hasOwn(sheetByRecord??{},id)) {
      conflicts.push({recordId:id,reason:'missing_sheet_record'});
      continue;
    }
    for (const field of fields) {
      const baseline=baselineByRecord?.[id];
      if (!baseline || !Object.hasOwn(baseline,field.key)) {
        conflicts.push({recordId:id,fieldKey:field.key,reason:'missing_baseline'});
        continue;
      }
      const decision=compareCell({
        baseline:baseline[field.key],
        database:get(databaseByRecord,id,field.key),
        sheet:get(sheetByRecord,id,field.key),
        authority:field.authority==='api'?'api':'manual',
      });
      if (decision.action==='none') continue;
      const item={recordId:id,fieldKey:field.key,sheetRange:sheetCellRange(worksheetTitle,row.sheetRow,field.columnIndex)};
      if (decision.action==='conflict' || decision.action==='reject_sheet_edit') {
        conflicts.push({...item,reason:decision.action,baseline:baseline[field.key],
          database:get(databaseByRecord,id,field.key),sheet:get(sheetByRecord,id,field.key)});
      } else {
        operations.push({...item,action:decision.action,value:decision.value,
          expectedDatabase:get(databaseByRecord,id,field.key),expectedSheet:get(sheetByRecord,id,field.key)});
      }
    }
  }
  return {operations,conflicts,requiresApproval:conflicts.length>0};
}
