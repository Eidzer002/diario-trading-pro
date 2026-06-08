import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Plotly y Tailwind se cargan desde CDN, no necesitan bundle
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
