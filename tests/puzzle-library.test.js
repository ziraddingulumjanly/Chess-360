import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, readFileSync as read } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import vm from 'node:vm';
import { createZstdCompress } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createWriteStream } from 'node:fs';
import { createSampler, validatePuzzles, build } from '../scripts/build-puzzles.mjs';
import { PUZZLES, pickTraining, registerPuzzleCatalog, puzzleCount, getPuzzle } from '../src/training.js';
const sandbox={module:{exports:{}},exports:{}};
vm.runInNewContext(readFileSync(new URL('../vendor/chess.min.js',import.meta.url),'utf8'),sandbox);
const {Chess}=sandbox.exports;

function fixtureLines() {
  const lines=['PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl'];
  let i=1000;
  for(const [level,rating] of [['easy',850],['medium',1550],['hard',2120],['expert',2700]]) {
    for(const stage of ['opening','middlegame','endgame']) {
      for(let j=0;j<12;j++) {
        const base=PUZZLES[(i+j)%PUZZLES.length];
        lines.push(`${String(i++).padStart(5,'0')},${base.fen},${base.moves},${rating},75,90,200,${stage} fork short,https://lichess.org/game`);
      }
    }
  }
  return lines;
}

test('sampler enforces rating bands, uniqueness, stage quotas and stable 40-puzzle result',()=>{
  const sampler=createSampler(10,()=>.5);
  for(const line of fixtureLines().slice(1))sampler.add(line.split(','));
  const data=sampler.finish();
  assert.equal(data.length,40);
  assert.equal(new Set(data.map(p=>p.id)).size,40);
  for(const level of ['easy','medium','hard','expert']){
    const group=data.filter(p=>p.level===level);
    assert.equal(group.length,10);
    assert.equal(group.filter(p=>p.stage==='Opening').length,1);
    assert.equal(group.filter(p=>p.stage==='Middlegame').length,6);
    assert.equal(group.filter(p=>p.stage==='Endgame').length,3);
  }
  validatePuzzles(Chess,data);
});

test('import rejects unreliable data and incomplete difficulty bands',()=>{
  const sampler=createSampler(10);
  const source=fixtureLines();
  for(const line of source.slice(1,20))sampler.add(line.replace(',75,90,200,',',220,1,5,').split(','));
  assert.throws(()=>sampler.finish(),/Only 0\/10 easy/);
});

test('build parses an offline CSV file, validates moves and emits a browser catalog', async()=>{
  const dir=mkdtempSync(join(tmpdir(),'chess360-puzzles-'));
  try {
    const input=join(dir,'sample.csv'),output=join(dir,'catalog.json');
    writeFileSync(input,fixtureLines().join('\n'));
    await build(input,output,10);
    const data=JSON.parse(read(output,'utf8'));
    assert.equal(data.version,1);assert.equal(data.total,40);
    registerPuzzleCatalog(data);
    assert.equal(puzzleCount('expert'),12); // 10 generated + 2 original originals
    const played={seen:[],solved:[]};
    let picked=[];
    for(let k=0;k<10;k++){
      const candidate=pickTraining('expert','puzzle','random',picked.at(-1),played);
      assert.equal(candidate.level,'expert');
      assert(!picked.includes(candidate.id));
      picked.push(candidate.id);played.seen.push(candidate.id);
    }
    assert(getPuzzle(picked[0]));
  } finally {rmSync(dir,{recursive:true,force:true});}
});


test('build also reads Zstandard-compressed official-format CSV offline', async()=>{
  const dir=mkdtempSync(join(tmpdir(),'chess360-zstd-'));
  try{
    const input=join(dir,'sample.csv.zst'),output=join(dir,'catalog.json');
    await pipeline(Readable.from([fixtureLines().join('\n')]),createZstdCompress(),createWriteStream(input));
    await build(input,output,10);
    const data=JSON.parse(read(output,'utf8'));
    assert.equal(data.total,40);
    assert.equal(data.puzzles.filter(p=>p.level==='easy').length,10);
  } finally {rmSync(dir,{recursive:true,force:true});}
});


test('sampler fills missing stage quotas with distinct verified puzzles',()=>{
  const sampler=createSampler(10,()=>.5);
  for(const line of fixtureLines().slice(1)) {
    const row=line.split(',');
    if(row[3]==='850' && row[7].startsWith('opening '))continue;
    sampler.add(row);
  }
  const result=sampler.finish();
  const easy=result.filter(p=>p.level==='easy');
  assert.equal(easy.length,10);
  assert.equal(easy.filter(p=>p.stage==='Opening').length,0);
  assert.equal(new Set(result.map(p=>p.id)).size,result.length);
});

test('build reports missing or malformed input instead of an unexplained zero-puzzle count',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'chess360-invalid-csv-'));
  try {
    const input=join(dir,'invalid.csv'),output=join(dir,'catalog.json');
    writeFileSync(input,fixtureLines()[0]+'\n');
    await assert.rejects(build(input,output,10),/has no records/);
    writeFileSync(input,'Not really a CSV\n');
    await assert.rejects(build(input,output,10),/Unexpected Lichess puzzle CSV header/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
