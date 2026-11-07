export const IMPORT_STATUS_NOTE='Sheet poll status: Awaiting reply. Checkbox times retained as recorded.';
export function cleanTalNote(value){return String(value??'').replaceAll(IMPORT_STATUS_NOTE,'').split(/\r?\n/).map(line=>line.trimEnd()).join('\n').replace(/\n{3,}/g,'\n\n').trim();}
