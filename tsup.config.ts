import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/katex/index.tsx', 'src/mermaid/index.tsx'],
  format: ['esm'],
  minify: true,
  dts: true,
  treeshake: true,
  splitting: false,
  clean: true,
  outDir: 'dist',
  target: 'es2022',
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'mermaid',
    'katex',
    'rehype-katex',
  ],
})
