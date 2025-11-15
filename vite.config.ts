import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve(__dirname, './src/core'),
      '@managers': resolve(__dirname, './src/managers'),
      '@loaders': resolve(__dirname, './src/loaders'),
      '@tools': resolve(__dirname, './src/tools'),
      '@ui': resolve(__dirname, './src/ui'),
      '@viewport': resolve(__dirname, './src/viewport'),
      '@data': resolve(__dirname, './src/data'),
      '@utils': resolve(__dirname, './src/utils'),
      '@config': resolve(__dirname, './src/config'),
      '@parametric': resolve(__dirname, './src/parametric'),
      '@framing': resolve(__dirname, './src/framing'),
    },
  },
  optimizeDeps: {
    exclude: ['@thatopen/components', '@thatopen/fragments', '@thatopen/ui'],
  },
  server: {
    port: 3000,
    open: true,
    cors: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: {
          three: ['three'],
          'thatopen-components': ['@thatopen/components'],
          'thatopen-fragments': ['@thatopen/fragments'],
          'thatopen-ui': ['@thatopen/ui', '@thatopen/ui-obc'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  worker: {
    format: 'es',
    plugins: [],
  },
});
