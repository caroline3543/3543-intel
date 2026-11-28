import {avatarCropGeometry} from './avatarCropGeometry.js';
import { avatarFingerprint } from './avatarFingerprint.js';
import { simd } from 'wasm-feature-detect';
import simdCorePath from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url';
import { createWorker, OEM, PSM } from 'tesseract.js';
import workerPath from 'tesseract.js/dist/worker.min.js?url';
import { ROSTER_OCR_LANGUAGES } from './rosterOcrLanguages.js';
import corePath from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url';
import { classifyRosterCheckboxes, pickScreenshotRows, readScreenshotLegion, readScreenshotPower, readScreenshotRow, rosterScreenshotLayout, readRosterRegistrationLabel } from './rosterScreenshotModel.js';

function canvas(width, height) {
  return Object.assign(document.createElement('canvas'), { width, height });
}

function textCrop(source, left, top, width, height, { invert = false, green: greenOnly = false, dark = false, tight = false } = {}) {
  const border = 12;
  const output = canvas(width + 2 * border, height + 2 * border);
  const context = output.getContext('2d', { willReadFrequently: true });
  context.fillStyle = 'white';
  context.fillRect(0, 0, output.width, output.height);
  context.drawImage(source, left, top, width, height, border, border, width, height);
  const pixels = context.getImageData(border, border, width, height);
  let first = width, last = -1;
  for (let i = 0; i < pixels.data.length; i += 4) {
    const light = .213 * pixels.data[i] + .715 * pixels.data[i + 1] + .072 * pixels.data[i + 2];
    const red = pixels.data[i], green = pixels.data[i + 1], blue = pixels.data[i + 2];
    const blueText = light < 148 && blue - red > 50 && blue - green > 20;
    const ink = greenOnly ? pixels.data[i + 1] - red > 40 && pixels.data[i + 1] - blue > 38
      : invert ? light > 183 : dark ? light < 153 : blueText;
    if (tight && ink) {
      const column = i / 4 % width;
      first = Math.min(first, column);
      last = Math.max(last, column);
    }
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = ink ? 0 : 255;
  }
  context.putImageData(pixels, border, border);
  if (!tight || last < first) return output;
  const trimmed = canvas((last - first + 1 + 2 * border) * 2, output.height * 2);
  const target = trimmed.getContext('2d');
  target.imageSmoothingEnabled = false;
  target.drawImage(output, first, 0, last - first + 1 + 2 * border, output.height, 0, 0, trimmed.width, trimmed.height);
  return trimmed;
}

export async function createRosterReader() {
  let rejectWorker;
  const failure = new Promise((_, reject) => { rejectWorker = reject; });
  const worker = createWorker(ROSTER_OCR_LANGUAGES, OEM.LSTM_ONLY, {
    workerPath, corePath: await simd() ? simdCorePath : corePath, workerBlobURL: false,
    langPath: new URL('ocr-data/', new URL(import.meta.env.BASE_URL, window.location.href)).href,
    errorHandler: () => rejectWorker(new Error('Screenshot reader unavailable')),
  });
  const timer = setTimeout(() => rejectWorker(new Error('Screenshot reader timed out')), 30000);
  try {
    return await Promise.race([worker, failure]);
  } catch (error) {
    void worker.then(reader => reader.terminate()).catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const isPowerLine = value => /^(?:[^\d\s]{1,2}\s+)?\d{1,3}(?:[.,]\d{3})+$/u.test(value);
const stripPowerLine = value => isPowerLine(value) ? '' : value;

async function recognize(worker, crop, mode, whitelist = '') {
  await worker.setParameters({ tessedit_pageseg_mode: mode, tessedit_char_whitelist: whitelist });
  const { data } = await worker.recognize(crop);
  return data.text.trim();
}

function greenDensity(context, left, top, right, bottom) {
  const { data } = context.getImageData(left, top, right - left, bottom - top);
  let green = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 1] - data[i] > 40 && data[i + 1] - data[i + 2] > 38) green++;
  }
  return green * 4 / data.length;
}

export async function readRosterScreenshot(worker, file, kind, { matchName } = {}) {
  const url = URL.createObjectURL(file);
  const source = new Image();
  try {
    source.src = url;
    await source.decode();
    if (source.naturalWidth < 400 || source.naturalHeight < 650) {
      throw new Error('Use the full roster screenshot at its original size.');
    }
    const width = Math.min(1284, Math.max(950, source.naturalWidth));
    const height = Math.round(width * source.naturalHeight / source.naturalWidth);
    if (height / width < 1.5 || height / width > 2.5) {
      throw new Error('Use a full portrait screenshot of the legion roster.');
    }
    const screen = canvas(width, height);
    const context = screen.getContext('2d', { willReadFrequently: true });
    context.drawImage(source, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const layout = rosterScreenshotLayout(pixels, width, height);
    const regions = pickScreenshotRows(pixels, width, height, layout);
    const x = value => Math.round(width * value);
    const y = value => Math.round(height * value);
    const header = textCrop(screen, x(.24), y(.17), x(.55), y(.048), { invert: true });
    const legion = readScreenshotLegion(await recognize(worker, header, PSM.SINGLE_LINE));
    if (!legion && !regions.length) throw new Error('Use a full screenshot of the legion registration roster.');
    async function readTotal(left, right) {
      const text = await recognize(worker, textCrop(screen, x(left), y(layout.totalsTop), x(right - left), y(.026), { dark: true }),
        PSM.SINGLE_LINE, '0123456789/');
      const [count, limit] = text.replace(/\s/g, '').match(/^\d{1,2}\/\d{1,2}$/)?.[0].split('/').map(Number) ?? [];
      return limit > 0 && count <= limit ? { count, limit } : null;
    }
    const totals = { combatant: await readTotal(.22, .39), substitute: await readTotal(.62, .79) };
    const rows = [], partial = [];
    for (const { top, bottom, partial: clipped } of regions) {
      if (clipped) {
        partial.push({ top: top / height, bottom: bottom / height });
        continue;
      }
      const h = bottom - top;
      const nominalHeight = y(.077);
      const start = top <= y(layout.listStart + .001) ? bottom - nominalHeight : top;
      const rowY = ratio => Math.round(start + nominalHeight * ratio);
      const otherLegionMarker = greenDensity(context, x(.22), rowY(.69), x(.63), bottom) > .035;
      const voted = greenDensity(context, x(.78), Math.max(top, rowY(-.03)), x(.92), rowY(.22)) > .13;
      // The badge uses small green letters on a dark strip near the avatar
      // base. Sample that strip rather than the brighter avatar artwork.
      const battleRequest = greenDensity(context, x(.066), rowY(.67), x(.207), Math.min(bottom, rowY(.94))) > .13;
      const crop = textCrop(screen, x(.223), top, x(.49), h);
      const row = readScreenshotRow(await recognize(worker, crop, PSM.SINGLE_BLOCK));
      row.name = stripPowerLine(row.name);
      if (!row.name) {
        const nameBottom = rowY(otherLegionMarker ? .40 : .54);
        const nameCrop = textCrop(screen, x(.219), top, x(.50), nameBottom - top);
        row.name = stripPowerLine(await recognize(worker, nameCrop, PSM.RAW_LINE));
      }
      // Alternative OCR is advisory evidence, never an automatic identity.
      if (matchName && !matchName(row.name).player) {
        const nameBottom = Math.min(bottom, rowY(otherLegionMarker ? .40 : .54));
        if (nameBottom > top) {
          const alternatives = [];
          for (const [options, mode] of [[{tight:true}, PSM.RAW_LINE]]) {
            try {
              const candidate = stripPowerLine(await recognize(worker, textCrop(screen, x(.219), top, x(.50), nameBottom-top, options), mode));
              if (candidate && candidate !== row.name && !alternatives.includes(candidate)) alternatives.push(candidate);
            } catch { break; }
          }
          if (alternatives.length) row.nameAlternatives = alternatives;
        }
      }
      const powerTop = rowY(otherLegionMarker ? .42 : .55);
      const powerBottom = Math.min(bottom, rowY(otherLegionMarker ? .66 : .81));
      const powerCrop = textCrop(screen, x(.267), powerTop, x(.42), powerBottom - powerTop);
      const digits = '0123456789,.KMBkmb';
      const powerRaw = await recognize(worker, powerCrop, PSM.SINGLE_LINE, digits);
      const independentPower = readScreenshotPower(powerRaw);
      let alternative = null;
      if (otherLegionMarker || independentPower === null) {
        const retry = textCrop(screen, x(.267), powerTop, x(.42), powerBottom - powerTop, { tight: true });
        alternative = readScreenshotPower(await recognize(worker, retry, PSM.RAW_LINE, digits));
      }
      let broadPower = null;
      if (otherLegionMarker) {
        const broadTop = top + Math.floor(h * .49);
        const broad = textCrop(screen, x(.265), broadTop, x(.32), bottom - broadTop);
        broadPower = readScreenshotPower(await recognize(worker, broad, PSM.SINGLE_LINE, digits));
      }
      const readings = [...new Set([independentPower, alternative, broadPower, row.power].filter(value => value !== null))];
      if (otherLegionMarker && !row.otherLegion) {
        const dispatchCrop = textCrop(screen, x(.22), rowY(.67), x(.40), bottom - rowY(.67), { green: true });
        const dispatch = await recognize(worker, dispatchCrop, PSM.SINGLE_LINE);
        row.otherLegion = Number(dispatch.match(/\bLegion\s*([12])\s+dispatched\b/i)?.[1]) || null;
      }
      let registration = 'other-legion';
      if (!row.otherLegion && !otherLegionMarker) {
        if (layout.registrationLabels) {
          // Start below the green Voted badge, which can otherwise obscure short labels.
          const statusTop = Math.max(top, rowY(.30));
          const statusBottom = Math.min(bottom, rowY(.79));
          const label = textCrop(screen, x(.73), statusTop, x(.20), statusBottom-statusTop, { dark: true, tight: true });
          registration = readRosterRegistrationLabel(await recognize(worker, label, PSM.SINGLE_BLOCK));
        } else {
          registration = classifyRosterCheckboxes(pixels,width,height,top,bottom);
        }
      }
      // Experimental, opt-in only: never persist this evidence in ordinary import sessions.
      let avatarEvidence;
      if (kind && typeof kind === 'object' && kind.avatarBenchmark === true) {
        const crop=avatarCropGeometry(width,height,top,bottom);
        if (crop) {
          const image=context.getImageData(crop.left,crop.upper,crop.width,crop.height);
          avatarEvidence=avatarFingerprint(image.data,image.width,image.height);
        }
      }
      rows.push({ ...row, ...(avatarEvidence ? { avatarEvidence } : {}), power: readings[0] ?? null, ...(readings.length > 1 ? { powerConflict: readings } : {}),
        registration, voted, battleRequest, bounds: { top: top / height, bottom: bottom / height } });
    }
    return { legion, rows, totals, partial };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function retryRosterUsername(file,bounds,existingWorker) {
  if(!file || !bounds || !Number.isFinite(bounds.top) || !Number.isFinite(bounds.bottom) || bounds.top<0 || bounds.bottom>1 || bounds.bottom<=bounds.top) throw new Error('Screenshot evidence unavailable');
  const url=URL.createObjectURL(file);
  let worker;
  try {
    const source=new Image();source.src=url;await source.decode();
    const width=Math.min(1284,Math.max(950,source.naturalWidth)),height=Math.round(width*source.naturalHeight/source.naturalWidth);
    const screen=canvas(width,height),context=screen.getContext('2d',{willReadFrequently:true});
    context.drawImage(source,0,0,width,height);
    const top=Math.round(bounds.top*height),bottom=Math.round(bounds.bottom*height),nominal=Math.round(height*.077);
    const layout=rosterScreenshotLayout(context.getImageData(0,0,width,height).data,width,height);
    // The first row may be clipped under the roster toolbar.
    const start=top<=Math.round(height*(layout.listStart+.001))?bottom-nominal:top;
    const other=greenDensity(context,Math.round(width*.22),Math.round(start+nominal*.69),Math.round(width*.63),bottom)>.035;
    const end=Math.min(bottom,Math.round(start+nominal*(other ? .40 : .54)));
    if(end<=top)return '';
    worker=existingWorker??await createRosterReader();
    return stripPowerLine(await recognize(worker,textCrop(screen,Math.round(width*.219),top,Math.round(width*.50),end-top,{tight:true,dark:true}),PSM.SINGLE_LINE));
  } finally {URL.revokeObjectURL(url);if(worker&&!existingWorker)await worker.terminate();}
}
