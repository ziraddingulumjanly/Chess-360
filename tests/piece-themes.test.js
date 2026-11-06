import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {PIECE_THEMES,themeById,staticPieceUrl,isCustomTheme,cleanPaint,DEFAULT_PAINT} from '../src/pieces.js';
import {initialStore,loadStore,saveStore} from '../src/storage.js';

const root=new URL('../',import.meta.url);

test('every listed collection has all 12 correctly formatted piece images',()=>{
  assert.equal(PIECE_THEMES.length,20);
  for(const theme of PIECE_THEMES) for(const color of 'wb') for(const type of 'kqrbnp') {
    const url=staticPieceUrl(theme.id,color,type);
    const asset=new URL('../'+url,import.meta.url);
    assert.ok(existsSync(asset),`Missing ${theme.name}: ${url}`);
    if (theme.format==='png') assert.equal(readFileSync(asset).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  }
});

test('traditional Staunton artwork is available in two offline finishes',()=>{
  assert.equal(PIECE_THEMES.filter(t=>t.source==='Traditional').length,2);
  assert.match(staticPieceUrl('staunton-ivory','w','k'),/staunton-ivory\/wK\.png$/);
  assert.match(staticPieceUrl('staunton-wood','b','q'),/staunton-wood\/bQ\.png$/);
});

test('all serious Chess Art designs ship their original editable SVG templates',()=>{
  assert.equal(PIECE_THEMES.filter(t=>t.source==='Chess Art').length,7);
  for(const theme of PIECE_THEMES.filter(t=>isCustomTheme(t.id))) for(const type of 'kqrbnp') {
    const path=new URL(`../assets/chess-art/${theme.id.slice(4)}/${type}.svg`,import.meta.url);
    const svg=readFileSync(path,'utf8');
    assert.match(svg,/id="fillGradient"/);
    assert.match(svg,/id="shadow"/);
  }
});

test('theme choice and appearance persist, while invalid options fall back safely',()=>{
  const x=initialStore();
  x.options.pieceWhite='art-fantasy';
  x.options.pieceBlack='lila-papercut';
  x.options.piecePaint.w1='#abcdef';
  x.options.piecePaint.blur=42;
  let json='';const storage={getItem:()=>json,setItem:(key,value)=>{json=value;}};
  assert.equal(saveStore(x,storage),true);
  const loaded=loadStore(storage).options;
  assert.equal(loaded.pieceWhite,'art-fantasy');
  assert.equal(loaded.pieceBlack,'lila-papercut');
  assert.equal(loaded.piecePaint.w1,'#abcdef');
  assert.equal(loaded.piecePaint.blur,42);
  json=JSON.stringify({options:{pieceWhite:'../../bad',pieceBlack:'bad',piecePaint:{w1:'url(javascript:evil)',blur:999}}});
  const clean=loadStore(storage).options;
  assert.equal(clean.pieceWhite,'classic');assert.equal(clean.pieceBlack,'classic');
  assert.equal(clean.piecePaint.w1,DEFAULT_PAINT.w1);
  assert.equal(clean.piecePaint.blur,60);
});

test('author/license notices are bundled alongside the chosen SVGs',()=>{
  for(const name of ['PIECE-THEMES.md','Chess-Art-MIT.txt','Lichess-COPYING.md','GPLv2-Piece-Themes.txt','Apache-2.0-Piece-Themes.txt'])
    assert.ok(existsSync(new URL('../licenses/'+name,import.meta.url)),name);
  assert.ok(themeById('art-skulls'));
  assert.equal(cleanPaint({shadow:false}).shadow,false);
});
