import { simd } from 'wasm-feature-detect';
import simdCorePath from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url';
import { createWorker, OEM, PSM } from 'tesseract.js';
import workerPath from 'tesseract.js/dist/worker.min.js?url';
import { ROSTER_OCR_LANGUAGES } from './rosterOcrLanguages.js';
import corePath from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url';
import { classifyRosterCheckboxes, pickScreenshotRows, readScreenshotLegion, readScreenshotPower, readScreenshotRow } from './rosterScreenshotModel.js';

function canvas(width, height) {
  return Object.assign(document.createElement('canvas'), { width, height });
}

function textCrop(source, left, top, width, height, { invert = false } = {}) {
  const border = 12;
  const output = canvas(width + 2 * border, height + 2 * border);
  const context = output.getContext('2d', { willReadFrequently: true });
  context.fillStyle = 'white';
  context.fillRect(0, 0, output.width, output.height);
  context.drawImage(source, left, top, width, height, border, border, width, height);
  const pixels = context.getImageData(border, border, width, height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const light = .213 * pixels.data[i] + .715 * pixels.data[i + 1] + .072 * pixels.data[i + 2];
    const red = pixels.data[i], green = pixels.data[i + 1], blue = pixels.data[i + 2];
    const blueText = light < 148 && blue - red > 50 && blue - green > 20;
    const ink = invert ? light > 183 : blueText;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = ink ? 0 : 255;
  }
  context.putImageData(pixels, border, border);
  return output;
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

// A cut-off row may contain only a formatted power and part of its icon.
const isPowerLine = value => /(?:^|\D)\d{1,3}(?:[.,]\d{3}){2,}\s*$/.test(value);

async function completeRosterRow(worker, screen, region, row) {
  const { left, top, textWidth, rowHeight } = region;
  const needsName = !row.name || isPowerLine(row.name);
  const originalPower = row.power;
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
  try {
    if (needsName) {
      const nameCrop = textCrop(screen, left, top, textWidth, Math.floor(rowHeight * .54));
      await worker.setParameters({ tessedit_pageseg_mode: PSM.RAW_LINE });
      const { data } = await worker.recognize(nameCrop);
      const name = data.text.trim();
      row.name = !isPowerLine(name) && /[\p{L}\p{N}]/u.test(name) ? name : '';
      // If the scroll area starts inside a row, the visible number alone
      // cannot identify a player. Keep unread names from fully visible rows.
      if (!row.name && top <= screen.height * .334) return null;
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    }
    const powerLeft = Math.round(screen.width * .265);
    const powerTop = top + Math.floor(rowHeight * .49);
    const powerCrop = textCrop(screen, powerLeft, powerTop, Math.round(screen.width * .32), top + rowHeight - powerTop);
    await worker.setParameters({ tessedit_char_whitelist: '0123456789,.KMBkmb' });
    const { data } = await worker.recognize(powerCrop);
    const text = data.text.trim();
    // The game prints full integers with groups of three. OCR can mistake
    // a comma for a dot. Leave compact decimals such as 1.25B alone.
    const value = /^\d{1,3}(?:[.,]\d{3})+$/.test(text) ? text.replace(/\./g, ',') : text;
    const independentPower = readScreenshotPower(value);
    row.power = originalPower ?? independentPower;
    if (originalPower !== null && independentPower !== null && originalPower !== independentPower) {
      row.powerConflict = [originalPower, independentPower];
    }
    return row;
  } finally {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, tessedit_char_whitelist: '' });
  }
}

export async function readRosterScreenshot(worker, file, kind) {
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
    const regions = pickScreenshotRows(pixels, width, height);
    const left = Math.round(width * .223);
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    const header = textCrop(screen, Math.round(width * .24), Math.round(height * .17),
      Math.round(width * .55), Math.round(height * .048), { invert: true });
    const result = await worker.recognize(header);
    const legion = readScreenshotLegion(result.data.text);
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const rows = [];
    for (const { top, bottom } of regions) {
      // The game places the green other-legion indicator under the power,
      // within the text column, even when the selected legion has no players.
      const marker = context.getImageData(Math.round(width * .24), top, Math.round(width * .28), bottom - top).data;
      let greenInk = 0;
      for (let i = 0; i < marker.length; i += 4) {
        if (marker[i + 1] - marker[i] > 40 && marker[i + 1] - marker[i + 2] > 38) greenInk++;
      }
      const otherLegionMarker = greenInk > width * (bottom - top) * .002;
      const textWidth = Math.round(width * .49);
      const rowHeight = bottom - top;
      const crop = textCrop(screen, left, top, textWidth, rowHeight);
      const reading = await worker.recognize(crop);
      const row = readScreenshotRow(reading.data.text);
      if (!row) continue;
      const completed = await completeRosterRow(worker, screen, { left, top, textWidth, rowHeight }, row);
      if (completed && otherLegionMarker) completed.otherLegionMarker = true;
      if (completed) {
        completed.registration = completed.otherLegion || otherLegionMarker ? 'other-legion' : classifyRosterCheckboxes(pixels,width,height,top,bottom);
        rows.push(completed);
      }
    }
    return { legion, rows };
  } finally {
    URL.revokeObjectURL(url);
  }
}
