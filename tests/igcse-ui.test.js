import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const get = path => readFileSync(new URL(path, root), 'utf8');

test('IGCSE-derived light/dark tokens and readable 14px base font are applied', () => {
  const html = get('index.html');
  const style = get('igcse-theme.css');
  const storage = get('src/storage.js');
  assert.match(html, /href="igcse-theme\.css"/);
  assert.match(style, /font-size:14px/);
  assert.match(style, /--background:#212121/);
  assert.match(style, /--background:#ffffff/);
  assert.match(style, /--hover:#393939/);
  assert.match(style, /--hover:#e9e9e9/);
  assert.match(storage, /theme:'dark'/);
  assert.match(html, /body data-theme="dark"/);
});

test('official Lucide icons cover referenced page symbols and chess piece files stay SVG', () => {
  const sprite = get('assets/icons.svg');
  const html = get('index.html');
  const js = get('src/app.js');
  const symbols = new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]));
  assert.ok(symbols.size >= 60);
  for (const match of (html + js).matchAll(/assets\/icons\.svg#([\w-]+)/g)) {
    assert.ok(symbols.has(match[1]), `missing Lucide symbol: ${match[1]}`);
  }
  assert.ok(symbols.has('settings'));
  assert.ok(symbols.has('chevrons-left'));
  assert.match(js, /\.svg/);
});

test('developer docs inherit the saved theme, while viewport board-fit CSS stays intact', () => {
  const refined = get('refined.css');
  assert.match(refined, /100dvh - var\(--board-vertical-reserve\)/);
  for (const page of ['docs','contact','privacy','cookies','terms','licenses']) {
    assert.match(get(page+'.html'), /chess360\.v1/,page);
  }
});
