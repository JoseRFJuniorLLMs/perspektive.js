import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
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
