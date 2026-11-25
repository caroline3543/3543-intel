import { createWorker, OEM, PSM } from 'tesseract.js';
import workerPath from 'tesseract.js/dist/worker.min.js?url';
import corePath from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url';
import { pickScreenshotRows, readScreenshotLegion, readScreenshotRow } from './rosterScreenshotModel.js';

function canvas(width, height) {
  return Object.assign(document.createElement('canvas'), { width, height });
}

function textCrop(source, left, top, width, height, invert = false) {
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

export async function createRosterReader(language, onProgress) {
  let rejectWorker;
  const failure = new Promise((_, reject) => { rejectWorker = reject; });
  const worker = createWorker(language === 'kor' ? ['eng', 'kor'] : ['eng'], OEM.LSTM_ONLY, {
    workerPath, corePath, workerBlobURL: false,
    langPath: new URL('ocr-data/', new URL(import.meta.env.BASE_URL, window.location.href)).href,
    logger: message => onProgress(message.status),
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

export async function readRosterScreenshot(worker, file) {
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
    const regions = pickScreenshotRows(context.getImageData(0, 0, width, height).data, width, height);
    const left = Math.round(width * .223);
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    const header = textCrop(screen, Math.round(width * .24), Math.round(height * .17),
      Math.round(width * .55), Math.round(height * .048), true);
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
      if (greenInk > width * (bottom - top) * .002) continue;
      const crop = textCrop(screen, left, top, Math.round(width * .49), bottom - top);
      const reading = await worker.recognize(crop);
      const row = readScreenshotRow(reading.data.text);
      if (row) rows.push(row);
    }
    return { legion, rows };
  } finally {
    URL.revokeObjectURL(url);
  }
}
