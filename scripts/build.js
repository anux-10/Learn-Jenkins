/**
 * Builds the static site into dist/.
 * No bundler is needed: the calculator is plain HTML/CSS/JS.
 */
const { cpSync, mkdirSync, rmSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

cpSync(resolve(root, 'index.html'), resolve(dist, 'index.html'));
cpSync(resolve(root, 'src'), resolve(dist, 'src'), { recursive: true });

console.log('Built dist/ from index.html and src/');
