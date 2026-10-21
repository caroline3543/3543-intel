import {gameLanguageCode} from './gameLanguageService.js';
import { normalizeAvatarUrl } from './playerAvatarService.js';
// Whiteout Stats' own levelLabel(): /static/app.js (20261020kvkcol).
// Completed Fire Crystal tier = floor((raw furnace level - 30) / 5).
export function providerFurnaceLevel(value) {
  if (!['string','number'].includes(typeof value) || String(value).trim() === '') return null;
  const label = String(value).trim();
  const fc = label.match(/^(?:FC|Fire\s*Crystal)\s*(\d+)$/i);
  if (fc && Number(fc[1]) >= 1 && Number(fc[1]) <= 10) return `FC${Number(fc[1])}`;
  const lv = Number(label.replace(/^F(?:urnace)?\s*/i, ''));
  if (!Number.isSafeInteger(lv) || lv < 1 || lv > 84) return null;
  const tier = Math.floor((lv - 30) / 5);
  return tier > 0 ? `FC${tier}` : `F${lv}`;
}
export function providerNumber(value) {
  if (!['string','number'].includes(typeof value) || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
export function providerProfilePatch(row) {
  const patch = {};
  const language=gameLanguageCode(row.raw?.language);
  if(language)patch.gameLanguage=language;
  const avatar = normalizeAvatarUrl(row.avatarUrl);
  if (avatar) patch.avatarUrl = avatar;
  if (row.username?.trim()) patch.username = row.username.trim();
  if (row.allianceTag?.trim()) patch.allianceTag = row.allianceTag.trim();
  if (/^R[1-5]$/.test(row.allianceRank || '')) patch.allianceRank = row.allianceRank;
  const furnace = providerFurnaceLevel(row.furnaceLabel) || providerFurnaceLevel(row.furnaceLevel);
  if (furnace) patch.furnaceLevel = furnace;
  for (const key of ['power','kills']) {
    const number = providerNumber(row[key]);
    if (number !== null) patch[key] = number;
  }
  return patch;
}
export function profileChanges(existing, row) {
  return Object.entries(providerProfilePatch(row))
    .filter(([key,value]) => existing?.[key] !== value)
    .map(([key,value]) => ({field:key, before:existing?.[key] ?? null, after:value}));
}
