import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'layouts/index': 'src/layouts/index.ts',
    'edges/index': 'src/edges/index.ts',
    'validators/index': 'src/validators/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['@tempots/core'],
  onSuccess: 'cp src/styles/flow.css dist/flow.css',
})
