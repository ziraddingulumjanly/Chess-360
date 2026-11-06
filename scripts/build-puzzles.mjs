#!/usr/bin/env node
// Reproducibly sample real, rated Lichess puzzles. No runtime dependency.
// Input: the official CSV or .zst export; omitted input downloads the latest archive.
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createZstdDecompress } from 'node:zlib';
import { createInterface } from 'node:readline';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEVELS = Object.freeze({easy:[500,1199],medium:[1200,1799],hard:[1800,2399],expert:[2400,3299]});
const STAGES = ['Opening','Middlegame','Endgame'];
const QUOTA = [100,600,300]; // out of 1000 per difficulty
const THEMES = {mateIn1:'Mate in one',mateIn2:'Mate in two',mateIn3:'Mate in three',fork:'Fork',pin:'Pin',skewer:'Skewer',discoveredAttack:'Discovered attack',backRankMate:'Back-rank mate',deflection:'Deflection',sacrifice:'Sacrifice',advancedPawn:'Advanced pawn',promotion:'Promotion',hangingPiece:'Winning material',interference:'Interference',clearance:'Clearance',attraction:'Attraction'};
function levelFor(rating) { return Object.keys(LEVELS).find(k=>rating>=LEVELS[k][0]&&rating<=LEVELS[k][1]) || null; }
function stageFor(tags) { return tags.includes('endgame')?'Endgame':tags.includes('opening')?'Opening':'Middlegame'; }
function themeFor(tags) { return Object.keys(THEMES).find(t=>tags.includes(t)) || 'Tactical combination'; }
function normalize(row) {
  const [id,fen,moves,rawRating,rawDeviation,rawPopularity,rawPlays,tags=''] = row;
  const rating=Number(rawRating),deviation=Number(rawDeviation),popularity=Number(rawPopularity),plays=Number(rawPlays);
  const level=levelFor(rating);
  if(!level || !/^[a-zA-Z0-9]{5}$/.test(id) || !fen || !moves || !Number.isFinite(deviation) || !Number.isFinite(popularity) || !Number.isFinite(plays) || deviation>140 || popularity<55 || plays<50) return null;
  const line=moves.trim().split(/\s+/);
  if(line.length<2 || line.length>18 || !line.every(m=>/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m))) return null;
  const themes=tags.split(/\s+/);
  return {id,level,rating,theme:THEMES[themeFor(themes)]||'Tactical combination',stage:stageFor(themes),fen,moves};
}
function rng(seed=0x3602026) { return ()=> {seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;}; }
export function createSampler(perLevel=1000, random=rng()) {
  const targets = [Math.floor(perLevel*QUOTA[0]/1000),Math.floor(perLevel*QUOTA[1]/1000)];
  targets.push(perLevel-targets[0]-targets[1]);
  // Keep sampling memory bounded even with Lichess's multi-million-row CSV.
  // IDs are validated for uniqueness in the final selected catalog.
  const pools=new Map(),counts=new Map();
  for(const level of Object.keys(LEVELS)) for(let i=0;i<STAGES.length;i++) {
    const k=level+'-'+STAGES[i];pools.set(k,[]);counts.set(k,0);
  }
  return {
    add(row) {
      const p=normalize(row);
      if(!p)return;
      const k=p.level+'-'+p.stage,n=counts.get(k)+1,limit=perLevel;
      counts.set(k,n);
      const arr=pools.get(k);
      if(arr.length<limit)arr.push(p);
      else {const j=Math.floor(random()*n);if(j<limit)arr[j]=p;}
    },
    finish({requireFull=true}={}) {
      const result=[];
      for(const level of Object.keys(LEVELS)) {
        const chosen=[],spares=[];
        for(let i=0;i<STAGES.length;i++) {
          const pool=pools.get(level+'-'+STAGES[i]);
          chosen.push(...pool.slice(0,targets[i]));
          spares.push(...pool.slice(targets[i]));
        }
        // Preserve the stage targets when possible, but don't reject real puzzles
        // just because a particular difficulty/stage combination is scarce.
        for(let i=spares.length-1;i>0;i--) {
          const j=Math.floor(random()*(i+1));
          [spares[i],spares[j]]=[spares[j],spares[i]];
        }
        chosen.push(...spares.slice(0,Math.max(0,perLevel-chosen.length)));
        if(requireFull && chosen.length<perLevel)
          throw Error(`Only ${chosen.length}/${perLevel} ${level} puzzles passed the quality/stage filters. Available: ${STAGES.map(stage=>stage+'='+counts.get(level+'-'+stage)).join(', ')}`);
        result.push(...chosen);
      }
      if(new Set(result.map(p=>p.id)).size!==result.length) throw Error('Duplicate puzzle IDs in selected catalog');
      return result.sort((a,b)=>a.level.localeCompare(b.level)||a.id.localeCompare(b.id));
    },
    counts
  };
}
function chessClass(source) {
  const sandbox={module:{exports:{}},exports:{}};
  vm.runInNewContext(source,sandbox);
  return sandbox.exports.Chess;
}
export function validatePuzzles(Chess, puzzles) {
  const unique=new Set();
  for(const p of puzzles){
    if(unique.has(p.id))throw Error('Duplicate puzzle '+p.id);unique.add(p.id);
    const game=new Chess(p.fen);
    const moves=p.moves.split(' ');
    for(const uci of moves){
      const moved=game.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'});
      if(!moved)throw Error(`Invalid solution for ${p.id}: ${uci}`);
    }
  }
}
async function downloadArchive(path) {
  const url='https://database.lichess.org/lichess_db_puzzle.csv.zst';
  await new Promise((resolve,reject)=>{
    const child=spawn('curl',['--fail','--location','--retry','3','--retry-delay','5','--output',path,url],{stdio:'inherit'});
    child.on('error',reject);
    child.on('close',code=>code===0?resolve():reject(Error(`Lichess download failed (curl exit ${code})`)));
  });
  // An empty/partial HTTP response must never silently produce an empty catalog.
  if((await stat(path)).size<1_000_000)throw Error('Lichess puzzle archive download is unexpectedly small');
}
export async function build(input,output,perLevel=1000) {
  const sampler=createSampler(perLevel);
  let temporaryDir;
  try {
    if(!input) {
      temporaryDir=await mkdtemp(join(tmpdir(),'chess360-lichess-'));
      input=join(temporaryDir,'lichess_db_puzzle.csv.zst');
      await downloadArchive(input);
    }
    let stream=createReadStream(input);
    if(input.endsWith('.zst')) {
      if(!createZstdDecompress)throw Error('Node.js 22+ is needed for Zstandard imports.');
      stream=stream.pipe(createZstdDecompress());
    }
    const columns=['PuzzleId','FEN','Moves','Rating','RatingDeviation','Popularity','NbPlays','Themes'];
    let scanned=0,headerSeen=false;
    for await(const line of createInterface({input:stream,crlfDelay:Infinity})) {
      if(!headerSeen){
        if(!line.trim())continue;
        const fields=line.replace(/^\uFEFF/,'').split(',');
        if(!columns.every((name,i)=>fields[i]===name))throw Error('Unexpected Lichess puzzle CSV header: '+line.slice(0,120));
        headerSeen=true;
        continue;
      }
      if(!line.trim())continue;
      sampler.add(line.split(','));
      scanned++;
    }
    if(!scanned)throw Error('Lichess puzzle CSV has no records. Check the dataset download.');
    console.log(`Scanned ${scanned} Lichess records. Eligible counts: ${Array.from(sampler.counts).map(([key,value])=>key+'='+value).join(' ')}`);
    const puzzles=sampler.finish();
    const source=await readFile(resolve(ROOT,'vendor/chess.min.js'),'utf8');
    validatePuzzles(chessClass(source),puzzles);
    await mkdir(dirname(output),{recursive:true});
    await writeFile(output,JSON.stringify({source:'Lichess CC0 puzzle database',version:1,total:puzzles.length,puzzles}));
    console.log(`Validated ${puzzles.length} distinct rated puzzles from ${scanned} Lichess records → ${output}`);
    return puzzles;
  } finally {
    if(temporaryDir)await rm(temporaryDir,{recursive:true,force:true});
  }
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  const source=args.includes('--input')?args[args.indexOf('--input')+1]:null;
  const output=args.includes('--output')?resolve(args[args.indexOf('--output')+1]):resolve(ROOT,'assets/puzzles/catalog.json');
  const count=args.includes('--per-level')?Number(args[args.indexOf('--per-level')+1]):1000;
  if(!Number.isInteger(count)||count<10||count>5000)throw Error('--per-level must be an integer from 10 to 5000');
  await build(source,output,count);
}
