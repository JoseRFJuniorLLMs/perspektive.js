import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "Perspektive",
      fileName: (format) => `perspektive.${format}.js`,
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "three",
        "@react-three/fiber",
        "@react-three/drei",
        "@react-three/postprocessing",
        "zustand",
        "@tanstack/react-query",
        "flatbuffers",
      ],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "ReactJSXRuntime",
          three: "THREE",
          "@react-three/fiber": "ReactThreeFiber",
          "@react-three/drei": "Drei",
          "@react-three/postprocessing": "ReactThreePostprocessing",
          zustand: "zustand",
          "@tanstack/react-query": "ReactQuery",
          flatbuffers: "flatbuffers",
        },
      },
    },
  },
});
