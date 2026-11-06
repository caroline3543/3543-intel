import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],define:{'import.meta.env.VITE_ROSTER_API':JSON.stringify('true')},build:{outDir:'dist'}});
