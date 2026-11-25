import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

import {ROSTER_OCR_LANGUAGES as languages} from './src/foundry/rosterOcrLanguages.js';
const modelPath = language => resolve('../node_modules', '@tesseract.js-data', language, '4.0.0_best_int', language + '.traineddata.gz');
const models = {
  name: 'roster-ocr-models',
  configureServer(server) {
    server.middlewares.use('/ocr-data', (request, response, next) => {
      const language = languages.find(code => request.url === '/' + code + '.traineddata.gz');
      if (!language) return next();
      response.setHeader('Content-Type', 'application/octet-stream');
      response.end(readFileSync(modelPath(language)));
    });
  },
  generateBundle() {
    for (const language of languages) {
      this.emitFile({type:'asset', fileName:'ocr-data/' + language + '.traineddata.gz', source:readFileSync(modelPath(language))});
    }
  },
};

const includeProfilePreview = process.env.VERCEL_ENV === 'preview' || process.env.BUILD_PROFILE_FIXTURE === '1';

export default defineConfig({
  plugins:[react(),models],
  define:{'import.meta.env.VITE_ROSTER_API':JSON.stringify('true')},
  build:{
    outDir:'dist',
    ...(includeProfilePreview ? {
      rollupOptions:{input:{index:resolve('index.html'),profilePreview:resolve('profile-preview.html'),eventPreview:resolve('event-preview.html')}},
    } : {}),
  },
});
