import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { StockfishEngine } from '../src/engine.js';

// Fake UCI transport isolates our Worker command-handling logic from the 99 MB native engine.
test('UCI Worker initializes, sets strength, searches and safely resets for new games', async () => {
  const originalWorker=globalThis.Worker,originalIsolation=globalThis.crossOriginIsolated,originalNavigator=globalThis.navigator;
  const messages=[];
  class FakeWorker {
    postMessage(value) {
      if (typeof value!=='string') return;
      messages.push(value);
      if (value==='uci') queueMicrotask(()=>this.onmessage({data:'uciok'}));
      if (value==='isready') queueMicrotask(()=>this.onmessage({data:'readyok'}));
      if (value.startsWith('go movetime ')) queueMicrotask(()=>this.onmessage({data:'bestmove e7e5 ponder g1f3'}));
    }
    terminate() {}
  }
  try {
    globalThis.Worker=FakeWorker;
    globalThis.crossOriginIsolated=true;
    Object.defineProperty(globalThis,'navigator',{value:{hardwareConcurrency:5},configurable:true});
    const engine=new StockfishEngine();
    await engine.start();
    const answer=await engine.think('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1','medium');
    assert.equal(answer,'e7e5');
    assert(messages.includes('setoption name Threads value 4'));
    assert(messages.includes('setoption name UCI_Elo value 1800'));
    assert(messages.includes('position fen rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'));
    assert(messages.some(s=>s==='go movetime 1100'));
    engine.newGame();
    const next=await engine.think('startpos','expert');
    assert.equal(next,'e7e5');
    assert(messages.filter(s=>s==='ucinewgame').length===2);
    assert(messages.includes('setoption name UCI_LimitStrength value false'));
    assert(messages.includes('go movetime 5000'));
    engine.dispose();
  } finally {
    globalThis.Worker=originalWorker;
    if(originalIsolation===undefined) delete globalThis.crossOriginIsolated; else globalThis.crossOriginIsolated=originalIsolation;
    Object.defineProperty(globalThis,'navigator',{value:originalNavigator,configurable:true});
  }
});

test('nonisolated GitHub Pages chooses the full single-thread Stockfish variant', async()=>{
  const oldWorker=globalThis.Worker,oldIsolated=globalThis.crossOriginIsolated,oldNavigator=globalThis.navigator;
  let url,commands=[];
  class FakeWorker {
    constructor(path){url=path;}
    postMessage(value){
      if(typeof value!=='string')return;
      commands.push(value);
      if(value==='uci')queueMicrotask(()=>this.onmessage({data:'uciok'}));
      if(value==='isready')queueMicrotask(()=>this.onmessage({data:'readyok'}));
      if(value.startsWith('go movetime'))queueMicrotask(()=>this.onmessage({data:'bestmove e7e5'}));
    }
    terminate(){}
  }
  try{
    globalThis.Worker=FakeWorker;globalThis.crossOriginIsolated=false;
    Object.defineProperty(globalThis,'navigator',{value:{hardwareConcurrency:4},configurable:true});
    const engine=new StockfishEngine();
    await engine.start();
    assert.equal(url,'engine/stockfish-19-single.js');
    assert.equal(await engine.think('startpos','easy'),'e7e5');
    assert(!commands.some(s=>s.includes('name Threads')));
    assert(commands.includes('setoption name UCI_Elo value 1320'));
    engine.dispose();
  }finally{
    globalThis.Worker=oldWorker;
    if(oldIsolated===undefined)delete globalThis.crossOriginIsolated;else globalThis.crossOriginIsolated=oldIsolated;
    Object.defineProperty(globalThis,'navigator',{value:oldNavigator,configurable:true});
  }
});


test('GitHub Pages workflow provisions both the catalog and the single-thread engine',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
  assert.match(workflow,/Build 4,000 balanced and verified Lichess puzzles/);
  assert.match(workflow,/node scripts\/build-puzzles\.mjs/);
  assert.match(workflow,/stockfish@19\.0\.1/);
  assert.match(workflow,/stockfish-19-single\.wasm/);
  assert.match(workflow,/assets src engine vendor licenses _site/);
});
