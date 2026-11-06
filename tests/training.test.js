import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { PUZZLES, getPuzzle, pickTraining, trainingStart, uciParts } from '../src/training.js';
const sandbox={module:{exports:{}},exports:{}};
vm.runInNewContext(readFileSync(new URL('../vendor/chess.min.js',import.meta.url),'utf8'),sandbox);
const {Chess}=sandbox.exports;

test('every Lichess puzzle has a legal complete solution line from its original FEN',()=>{
 const ids=new Set();const levels=new Map();
 for(const puzzle of PUZZLES){
  assert(!ids.has(puzzle.id),`duplicate id ${puzzle.id}`);ids.add(puzzle.id);
  levels.set(puzzle.level,(levels.get(puzzle.level)||0)+1);
  const original=new Chess(puzzle.fen);
  assert.equal(original.fen().split(' ')[0],puzzle.fen.split(' ')[0]);
  const moves=puzzle.moves.split(' ');
  assert(moves.length>=2,`at least one user move: ${puzzle.id}`);
  for(const [i,uci] of moves.entries()){
   assert.match(uci,/^[a-h][1-8][a-h][1-8][qrbn]?$/);
   assert(original.move(uciParts(uci)),`${puzzle.id} illegal ply ${i}: ${uci}`);
  }
  const training=trainingStart(Chess,puzzle,'puzzle');
  const position=new Chess(training.startFen);
  assert.equal(position.turn(),training.actualColor);
  assert.equal(position.history().length,0,'training begins at the shown FEN');
  assert(position.move(uciParts(moves[1])));
  assert.equal(training.puzzleId,puzzle.id);
  assert.equal(getPuzzle(puzzle.id),puzzle);
 }
 for(const level of ['easy','medium','hard','expert']) assert((levels.get(level)||0)>=2,`${level} needs multiple puzzles`);
});

test('position practice begins from a genuine source position and respects requested side',()=>{
 for(const level of ['easy','medium','hard','expert']) for(const side of ['w','b']) {
  for(let i=0;i<15;i++) {
   const puzzle=pickTraining(level,'position',side);
   assert.equal(puzzle.fen.split(' ')[1],side);
   const result=trainingStart(Chess,puzzle,'position');
   assert.equal(result.startFen,new Chess(puzzle.fen).fen());
   assert.equal(result.puzzleId,null);
  }
 }
});

test('puzzle selection follows the requested level and avoids immediate repeats',()=>{
 for(const level of ['easy','medium','hard','expert']){
  const first=pickTraining(level,'puzzle');
  for(let i=0;i<30;i++){
   const next=pickTraining(level,'puzzle','random',first.id);
   assert.equal(next.level,level);
   assert.notEqual(next.id,first.id);
  }
 }
});
