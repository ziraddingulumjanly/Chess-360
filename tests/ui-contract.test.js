import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path,root),'utf8');

test('board uses viewport height and preserves the complete 64-square UI', () => {
  const css = read('refined.css');
  const html = read('index.html');
  assert.match(css,/--board-fit:min\(calc\(100dvh - var\(--board-vertical-reserve\)\)/);
  assert.match(css,/\.board-shell\s*\{\s*aspect-ratio:1/);
  assert.match(html,/id="board"/);
  assert.match(html,/class="resource-rail"/);
  assert.doesNotMatch(html,/<footer\b/);
  const shell=read('app-shell.css');
  assert.match(shell,/html, body \{ width:100%; height:100%; overflow:hidden/);
  assert.match(shell,/\.board-shell \{width:min\(calc\(100vw - 14px\),calc\(100dvh - 278px\)\)/);
});

test('all six documentation routes exist and site has no status dots', () => {
  const html = read('index.html');
  for (const page of ['docs','contact','privacy','cookies','terms','licenses']) {
    assert.ok(existsSync(new URL(`${page}.html`,root)),`${page}.html`);
    assert.match(html,new RegExp(`href="${page}\\.html"`));
  }
  assert.doesNotMatch(html,/class="(?:pulse|status-dot)"/);
  assert.doesNotMatch(read('src/app.js'),/class="status-dot"/);
});

test('all twelve chess pieces use SVG and rendering does not reference PNG', () => {
  const app=read('src/app.js');
  for(const color of ['w','b']) for(const piece of 'KQRBNP') {
    const f=`assets/pieces/${color}${piece}.svg`;
    assert.ok(existsSync(new URL(f,root)),f);
    assert.match(read(f),/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  }
  assert.doesNotMatch(app,/assets\/pieces\/[^`]*\.png/);
  assert.match(app,/pieceImage\(p\.color,p\.type\)/);
  assert.match(read('src/pieces.js'),/assets\/pieces\/\$\{file\}/);
});

test('game view is non-scrolling with sidebar links and always-visible actions', () => {
  const html=read('index.html');
  const css=read('app-shell.css');
  const js=read('src/app.js');
  for (const id of ['undoMove','flipBoard','resignGame','copyPgn','newGame','movesToggle','movesClose']) {
    assert.match(html,new RegExp(`id="${id}"`),id);
  }
  assert.match(html,/class="resource-rail"/);
  assert.match(css,/overflow:hidden; overscroll-behavior:none/);
  assert.match(css,/100dvh - 278px/);
  assert.match(css,/\.history-panel\.mobile-open/);
  assert.match(js,/\$\('movesToggle'\)\.addEventListener/);
  assert.doesNotMatch(html,/<footer\b/);
});

test('navigation is consolidated into the desktop rail and game modes remain accessible on mobile', () => {
  const html=read('index.html');
  const css=read('app-shell.css');
  const app=read('src/app.js');
  for (const id of ['railStats','railSettings','railThemeToggle','mobileStats']) {
    assert.match(html,new RegExp(`id="${id}"`),id);
    assert.match(app,new RegExp(`'${id}'`),`${id} handler`);
  }
  assert.match(css,/@media \(min-width:1281px\)\s*\{\s*\.header\s*\{display:none;/);
  assert.match(css,/calc\(100dvh - 52px\)/);
  assert.match(css,/minmax\(315px,410px\)/);
  assert.match(css,/grid-template-areas:'difficulty mode'/);
  assert.match(html,/href="docs\.html"/);
  assert.match(html,/href="licenses\.html"/);
});
