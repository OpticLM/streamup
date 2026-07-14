import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/katex/index.tsx',
    'src/mermaid/index.tsx',
    'src/code-block/index.tsx',
  ],
  format: ['esm'],
  minify: true,
  dts: true,
  treeshake: true,
  clean: true,
  outDir: 'dist',
  target: 'es2022',
  sourcemap: false,
  deps: {
    onlyBundle: false,
    neverBundle: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'mermaid',
      'katex',
    ],
  },
})
