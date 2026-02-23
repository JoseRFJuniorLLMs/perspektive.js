import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Perspektive',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        'react', 'react-dom', 'three',
        '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing',
        '@tanstack/react-query',
      ],
    },
  },
});
