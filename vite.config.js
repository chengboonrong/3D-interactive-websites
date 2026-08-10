import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    cssMinify: true,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        // One chunk. At this payload size an extra request costs more than
        // the caching granularity buys back.
        manualChunks: undefined,
      },
    },
  },
});
