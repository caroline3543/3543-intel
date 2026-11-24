import {resolve} from 'node:path';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

const includeProfilePreview = process.env.VERCEL_ENV === 'preview' || process.env.BUILD_PROFILE_FIXTURE === '1';

export default defineConfig({
  plugins:[react()],
  define:{'import.meta.env.VITE_ROSTER_API':JSON.stringify('true')},
  build:{
    outDir:'dist',
    ...(includeProfilePreview ? {
      rollupOptions:{input:{index:resolve('index.html'),profilePreview:resolve('profile-preview.html'),eventPreview:resolve('event-preview.html')}},
    } : {}),
  },
});
