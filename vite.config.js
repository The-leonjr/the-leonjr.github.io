import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // three.js and ShaderGradient load lazily in their own chunk, so a large chunk is expected.
    chunkSizeWarningLimit: 1600,
  },
});
