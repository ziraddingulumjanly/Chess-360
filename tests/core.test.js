import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { getLevel, uciOptions } from '../src/difficulty.js';
import { loadStore, saveStore, aggregate } from '../src/storage.js';
const sandbox={module:{exports:{}},exports:{}};
vm.runInNewContext(readFileSync(new URL('../vendor/chess.min.js',import.meta.url),'utf8'),sandbox);
const {Chess}=sandbox.exports;

test('all four AI difficulties use Stockfish UCI strength settings, Expert is unrestricted',()=>{
  assert.equal(getLevel('easy').elo,1320);
  assert.equal(getLevel('medium').elo,1800);
  assert.equal(getLevel('hard').elo,2400);
  assert.equal(getLevel('expert').elo,null);
  assert(uciOptions('easy',8).includes('setoption name UCI_LimitStrength value true'));
  assert(uciOptions('hard',8).includes('setoption name UCI_Elo value 2400'));
  assert(uciOptions('expert',8).includes('setoption name UCI_LimitStrength value false'));
  assert(!uciOptions('expert',8).some(s=>s.startsWith('setoption name UCI_Elo')));
  assert(uciOptions('expert',8).includes('setoption name Threads value 7'));
  assert(uciOptions('expert',64).includes('setoption name Threads value 8'));
  assert(uciOptions('expert',1).includes('setoption name Threads value 1'));
});
test('browser settings survive a persistence round trip',()=>{
 const map=new Map();const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 const state=loadStore(storage);state.options.mode='computer';state.options.theme='dark';state.active={moves:[]};
 assert.equal(saveStore(state,storage),true);
 assert.equal(loadStore(storage).options.mode,'computer');
 assert.equal(loadStore(storage).options.theme,'dark');
 assert.deepEqual(loadStore(storage).active.moves,[]);
});
test('legacy local multiplayer preference is migrated to computer-only',()=>{
 const data=JSON.stringify({options:{mode:'local',difficulty:'hard'},record:[],active:null});
 const storage={getItem:()=>data,setItem:()=>{}};
 assert.equal(loadStore(storage).options.mode,'computer');
 assert.equal(loadStore(storage).options.difficulty,'hard');
});
test('corrupt local data is reset rather than crashing chess',()=>{
 const storage={getItem:()=>'{broken',setItem:()=>{}};
 assert.equal(loadStore(storage).options.mode,'computer');
});
test('stats count only computer games',()=>{
 assert.deepEqual(aggregate([{mode:'computer',result:'win'},{mode:'computer',result:'loss'},{mode:'computer',result:'draw'},{mode:'local',result:'win'}]),{wins:1,losses:1,draws:1,total:3,winRate:33});
});
test('starting position has 20 legal moves; illegal self-exposing move rejected',()=>{
 const c=new Chess();assert.equal(c.moves().length,20);
 assert.equal(c.move({from:'e2',to:'e5'}),null);
 assert.equal(c.turn(),'w');
});
test('castling is correctly recognized',()=>{
 const c=new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
 assert(c.moves({square:'e1'}).includes('O-O'));
 assert(c.moves({square:'e1'}).includes('O-O-O'));
 const m=c.move({from:'e1',to:'g1'});
 assert.equal(m.san,'O-O');assert.equal(c.get('f1').type,'r');
});
test('en passant captures the pawn on the bypassed square',()=>{
 const c=new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
 const m=c.move({from:'e5',to:'d6'});
 assert(m.flags.includes('e'));assert.equal(c.get('d5'),null);assert.equal(c.get('d6').type,'p');
});
test('all promotion choices are legal and a promotion changes the piece',()=>{
 const c=new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
 const m=c.moves({square:'a7',verbose:true}).filter(x=>x.to==='a8');
 assert.deepEqual(new Set(m.map(x=>x.promotion)),new Set(['q','r','b','n']));
 c.move({from:'a7',to:'a8',promotion:'n'});
 assert.equal(c.get('a8').type,'n');
});
test('checkmate is detected and last move can be undone cleanly',()=>{
 const c=new Chess();for(const m of ['f3','e5','g4','Qh4#']) assert(c.move(m));
 assert.equal(c.in_checkmate(),true);
 assert.equal(c.game_over(),true);
 c.undo();assert.equal(c.in_checkmate(),false);
 assert.equal(c.turn(),'b');
});
