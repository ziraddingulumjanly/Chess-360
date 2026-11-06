// A small offline selection from the public-domain (CC0) Lichess puzzle database.
// https://database.lichess.org/#puzzles
// FEN is BEFORE the first (opponent) move; the rest of `moves` is the solution.
export const PUZZLES = Object.freeze([
  {id:'000rZ',level:'easy',rating:662,theme:'Mate in one',stage:'Opening',fen:'2kr1b1r/p1p2pp1/2pqb3/7p/3N2n1/2NPB3/PPP2PPP/R2Q1RK1 w - - 2 13',moves:'d4e6 d6h2'},
  {id:'000pA',level:'easy',rating:1162,theme:'Back-rank mate',stage:'Endgame',fen:'5rk1/5pp1/7p/3p4/1ppPn3/1K2PPP1/1P2N1P1/r4R1R w - - 0 24',moves:'b3b4 f8b8'},
  {id:'000o3',level:'easy',rating:959,theme:'Pawn endgame',stage:'Endgame',fen:'8/2p1k3/6p1/1p1P1p2/1P3P2/3K2Pp/7P/8 b - - 1 43',moves:'e7d6 d3d4 g6g5 f4g5'},
  {id:'00sO1',level:'easy',rating:998,theme:'Discovered attack',stage:'Middlegame',fen:'1k1r4/pp3pp1/2p1p3/4b3/P3n1P1/8/KPP2PN1/3rBR1R b - - 2 31',moves:'b8c7 e1a5 b7b6 f1d1'},
  {id:'008Nz',level:'easy',rating:457,theme:'Back-rank mate',stage:'Middlegame',fen:'6k1/2p2ppp/pnp5/B7/2P3PP/1P1bPPR1/r6r/3R2K1 b - - 1 29',moves:'d3e2 d1d8'},
  {id:'00sHx',level:'medium',rating:1760,theme:'Mate in two',stage:'Middlegame',fen:'q3k1nr/1pp1nQpp/3p4/1P2p3/4P3/B1PP1b2/B5PP/5K2 b k - 0 17',moves:'e8d7 a2e6 d7d8 f7f8'},
  {id:'0000D',level:'medium',rating:1529,theme:'Winning material',stage:'Endgame',fen:'5rk1/1p3ppp/pq3b2/8/8/1P1Q1N2/P4PPP/3R2K1 w - - 2 27',moves:'d3d6 f8d8 d6d8 f6d8'},
  {id:'000Zo',level:'medium',rating:1363,theme:'Mate in two',stage:'Endgame',fen:'4r3/1k6/pp3r2/1b2P2p/3R1p2/P1R2P2/1P4PP/6K1 w - - 0 35',moves:'e5f6 e8e1 g1f2 e1f1'},
  {id:'000hf',level:'medium',rating:1391,theme:'Mate in two',stage:'Middlegame',fen:'r1bqk2r/pp1nbNp1/2p1p2p/8/2BP4/1PN3P1/P3QP1P/3R1RK1 b kq - 0 19',moves:'e8f7 e2e6 f7f8 e6f7'},
  {id:'000Pw',level:'medium',rating:1530,theme:'Knight fork',stage:'Endgame',fen:'6k1/5p1p/4p3/4q3/3nN3/2Q3P1/PP3P1P/6K1 w - - 2 37',moves:'e4d2 d4e2 g1f1 e2c3'},
  {id:'000h0',level:'hard',rating:2048,theme:'Interference',stage:'Middlegame',fen:'5rk1/p5p1/3bpr1p/1Pp4q/3pR3/1P1Q1N2/P4PPP/4R1K1 w - - 4 22',moves:'e4e6 f6f3 g2f3 h5h2 g1f1 h2h3 f1e2 h3e6'},
  {id:'000jr',level:'hard',rating:2152,theme:'Find the combination',stage:'Endgame',fen:'5k2/1p4pp/p5n1/5Q2/3BpP2/1P2PP1K/P1q4P/7r b - - 1 33',moves:'f8g8 f5d5 g8f8 d4c5 c2c5 d5c5'},
  {id:'000qP',level:'hard',rating:2167,theme:'Skewer',stage:'Endgame',fen:'8/7R/8/5p2/4bk1P/8/2r2K2/6R1 w - - 7 51',moves:'f2f1 f4f3 f1e1 c2c1 e1d2 c1g1'},
  {id:'00sJb',level:'hard',rating:2235,theme:'Fork',stage:'Middlegame',fen:'Q1b2r1k/p2np2p/5bp1/q7/5P2/4B3/PPP3PP/2KR1B1R w - - 1 17',moves:'d1d7 a5e1 d7d1 e1e3 c1b1 e3b6'},
  {id:'000VW',level:'expert',rating:2873,theme:'Deep calculation',stage:'Endgame',fen:'r4r2/1p3pkp/p5p1/3R1N1Q/3P4/8/P1q2P2/3R2K1 b - - 3 25',moves:'g6f5 d5c5 c2e4 h5g5 g7h8 g5f6'},
  {id:'00sJ9',level:'expert',rating:2671,theme:'Attraction and fork',stage:'Middlegame',fen:'r3r1k1/p4ppp/2p2n2/1p6/3P1qb1/2NQR3/PPB2PP1/R1B3K1 w - - 5 18',moves:'e3g3 e8e1 g1h2 e1c1 a1c1 f4h6 h2g1 h6c1'},
]);

// The validated CC0 catalog supplements the built-in offline starter set.
let catalog = PUZZLES;
let byId = new Map(catalog.map(p=>[p.id,p]));
export const puzzleCount = level => catalog.filter(p=>!level||p.level===level).length;
export function registerPuzzleCatalog(data) {
  if(!data || data.version!==1 || !Array.isArray(data.puzzles) || data.puzzles.length<16) throw Error('Invalid puzzle catalog');
  const ids=new Set();
  for(const p of data.puzzles) {
    if(!p || !/^[a-zA-Z0-9]{5}$/.test(p.id) || !['easy','medium','hard','expert'].includes(p.level) || !p.fen || !p.moves || ids.has(p.id))throw Error('Invalid or duplicate puzzle');
    ids.add(p.id);
  }
  // Keep the original 16 IDs so saved training games remain recoverable.
  catalog=[...data.puzzles,...PUZZLES.filter(p=>!ids.has(p.id))];
  byId=new Map(catalog.map(p=>[p.id,p]));
}
export const uciParts = move => ({from:move.slice(0,2),to:move.slice(2,4),...(move[4]?{promotion:move[4]}:{})});
export const getPuzzle = id => byId.get(id);
export function pickTraining(level, mode, requestedColor='random', excludeId='', progress=null) {
  let pool=catalog.filter(p=>p.level===level);
  if(requestedColor!=='random') {
    const matching=pool.filter(p=>{
      const before=p.fen.split(' ')[1];
      return (mode==='puzzle'?(before==='w'?'b':'w'):before)===requestedColor;
    });
    if(matching.length) pool=matching;
  }
  const other=pool.filter(p=>p.id!==excludeId);
  if(other.length) pool=other;
  if(mode==='puzzle'&&progress) {
    const seen=new Set(progress.seen||[]),solved=new Set(progress.solved||[]);
    const newPuzzles=pool.filter(p=>!seen.has(p.id));
    if(newPuzzles.length)pool=newPuzzles;
    else {
      const unsolved=pool.filter(p=>!solved.has(p.id));
      if(unsolved.length)pool=unsolved;
    }
  }
  return pool[Math.floor(Math.random()*pool.length)];
}
export function trainingStart(Chess, item, mode) {
  const position=new Chess(item.fen);
  if(mode==='puzzle') {
    const first=position.move(uciParts(item.moves.split(' ')[0]));
    if(!first) throw Error('Invalid puzzle setup');
  }
  return {startFen:position.fen(),actualColor:position.turn(),puzzleId:mode==='puzzle'?item.id:null};
}
