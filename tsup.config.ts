import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  sourcemap: true,
  minify: false,
  bundle: true,
  dts: false,
});
