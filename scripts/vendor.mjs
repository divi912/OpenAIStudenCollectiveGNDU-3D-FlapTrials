import { mkdirSync, copyFileSync } from 'node:fs';
for (const lib of ['glslang', 'twgsl']) {
  mkdirSync(`public/vendor/${lib}`, { recursive: true });
  for (const extension of ['js', 'wasm']) copyFileSync(`node_modules/@babylonjs/core/assets/${lib}/${lib}.${extension}`, `public/vendor/${lib}/${lib}.${extension}`);
}
console.log('WebGPU shader compilers copied locally. No runtime CDN dependency.');
