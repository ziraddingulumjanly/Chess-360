import { StockfishEngine } from './engine.js';
import { LEVELS, getLevel } from './difficulty.js';
import { loadStore, saveStore, aggregate } from './storage.js';
import { PIECE_THEMES, isCustomTheme, staticPieceUrl, customizeChessArtSvg, DEFAULT_PAINT } from './pieces.js';
import { PUZZLES, getPuzzle, pickTraining, trainingStart, uciParts, registerPuzzleCatalog, puzzleCount } from './training.js';
import { playWoodSound } from './sounds.js';

// The bundled BSD-licensed chess.js owns all rules, legal moves, FEN, and PGN.
// Stockfish owns chess intelligence; this module owns only display and game orchestration.
const Chess = globalThis.Chess;
if (!Chess) throw new Error('The bundled chess.js library failed to load.');

const $ = id => document.getElementById(id);
const icon = name => `<svg class="icon"><use href="assets/icons.svg#${name}"></use></svg>`;
const FILES = 'abcdefgh';
const PIECE_NAMES = { p:'Pawn',n:'Knight',b:'Bishop',r:'Rook',q:'Queen',k:'King' };
const PROMOTIONS = ['q','r','b','n'];
const game = new Chess();
const store = loadStore();
let options = store.options;
let gameState;
let toastTimeout = 0;
let dragging = null;
let suppressClick = false;
let arrows = [];
let arrowMode = false;
let arrowSource = null;
let rightArrowGesture = null;
let lastClockSave = 0;
let counter = 0;
let pieceTarget = 'both';
let pieceSourceFilter = 'all';
let pieceGalleryReady = false;
let pieceRevision = 0;
let paintTimer = 0;
const generatedPieces = {w:null,b:null};
const artTemplates = new Map();
function selectedTheme(side) { return side==='w'?options.pieceWhite:options.pieceBlack; }
function pieceImage(side,type) {
  const id=selectedTheme(side);
  const active=generatedPieces[side];
  if (active?.key===id+'|'+JSON.stringify(options.piecePaint)) return active.urls[type.toLowerCase()];
  return staticPieceUrl(id,side,type);
}
async function loadArtTemplate(theme,type) {
  const key=theme+':'+type;
  if (!artTemplates.has(key)) {
    const request=fetch(`assets/chess-art/${theme.slice(4)}/${type}.svg`).then(response=>{
      if(!response.ok) throw Error('Chess Art SVG not found: '+key);
      return response.text();
    });
    artTemplates.set(key,request);
  }
  return artTemplates.get(key);
}
async function refreshCustomPieces() {
  const revision=++pieceRevision;
  const ready={w:null,b:null};
  try {
    for(const side of ['w','b']) {
      const theme=selectedTheme(side);
      if(!isCustomTheme(theme)) continue;
      const images={};
      const sources=await Promise.all([...Object.keys(PIECE_NAMES)].map(async type=>[type,await loadArtTemplate(theme,type)]));
      if(revision!==pieceRevision) {for(const color of ['w','b']) Object.values(ready[color]?.urls||{}).forEach(URL.revokeObjectURL);return;}
      for(const [type,source] of sources) {
        const svg=customizeChessArtSvg(source,side,options.piecePaint);
        images[type]=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
      }
      ready[side]={key:theme+'|'+JSON.stringify(options.piecePaint),urls:images};
    }
    if(revision!==pieceRevision) { for(const side of ['w','b']) Object.values(ready[side]?.urls||{}).forEach(URL.revokeObjectURL);return; }
    for(const side of ['w','b']) {
      const previous=generatedPieces[side];generatedPieces[side]=ready[side];
      if(previous) setTimeout(()=>Object.values(previous.urls).forEach(URL.revokeObjectURL),2500);
    }
    renderBoard();renderPiecePreview();
    if(gameState?.pending) $('promotionOptions').querySelectorAll('img[data-promotion-type]').forEach(img=>img.src=pieceImage(game.turn(),img.dataset.promotionType));
  } catch(error) {
    for(const side of ['w','b']) Object.values(ready[side]?.urls||{}).forEach(URL.revokeObjectURL);
    if(revision===pieceRevision) notify('Unable to customize pieces: '+error.message);
  }
}
function syncPiecePaint() {
  document.querySelectorAll('[data-paint]').forEach(input=>{
    const val=options.piecePaint[input.dataset.paint];
    if(input.type==='checkbox') input.checked=!!val;
    else input.value=val;
  });
  document.querySelectorAll('[data-paint-output]').forEach(el=>el.textContent=options.piecePaint[el.dataset.paintOutput]);
  document.querySelectorAll('.piece-shadow-colors input,.piece-range-grid input[data-paint="blur"],.piece-range-grid input[data-paint="offset"],.piece-range-grid input[data-paint="slant"],.piece-range-grid input[data-paint="flatten"]').forEach(input=>input.disabled=!options.piecePaint.shadow);
}
function renderPiecePreview() {
  const preview=$('pieceLivePreview');
  if(!preview) return;
  preview.replaceChildren();
  for(const side of ['w','b']) {
    const item=document.createElement('div');item.className='piece-preview-side';
    const label=document.createElement('strong');label.textContent=(side==='w'?'White':'Black')+' · '+PIECE_THEMES.find(t=>t.id===selectedTheme(side)).name;
    const images=document.createElement('div');images.className='piece-preview-images';
    for(const type of ['k','q','n','p']) {const img=document.createElement('img');img.alt=PIECE_NAMES[type];img.src=pieceImage(side,type);images.append(img);}
    item.append(label,images);preview.append(item);
  }
}
function renderPieceGallery() {
  const gallery=$('pieceGallery');if(!gallery)return;
  gallery.replaceChildren();
  for(const theme of PIECE_THEMES.filter(t=>pieceSourceFilter==='all'||t.source===pieceSourceFilter)) {
    const btn=document.createElement('button');btn.type='button';btn.className='piece-theme-card';
    btn.dataset.pieceTheme=theme.id;
    const white=selectedTheme('w')===theme.id,black=selectedTheme('b')===theme.id;
    const active=pieceTarget==='both'?white&&black:pieceTarget==='w'?white:black;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',String(active));
    btn.title=`${theme.name} · ${theme.source} · ${theme.license}`;
    for(const [color,type] of [['w','N'],['b','K']]) {const img=document.createElement('img');img.alt='';img.loading='lazy';img.src=staticPieceUrl(theme.id,color,type);btn.append(img);}
    const title=document.createElement('strong');title.textContent=theme.name;
    const source=document.createElement('small');source.textContent=theme.source;
    btn.append(title,source);
    btn.addEventListener('click',()=>{
      if(pieceTarget!=='b')options.pieceWhite=theme.id;
      if(pieceTarget!=='w')options.pieceBlack=theme.id;
      persist();renderPieceGallery();renderBoard();renderPiecePreview();refreshCustomPieces();
    });gallery.append(btn);
  }
  $('pieceSelectionLabel').textContent='White: '+PIECE_THEMES.find(t=>t.id===options.pieceWhite).name+' · Black: '+PIECE_THEMES.find(t=>t.id===options.pieceBlack).name;
  $('pieceAdvanced').hidden=![options.pieceWhite,options.pieceBlack].some(isCustomTheme);
}
function initPieceSettings() {
  if(pieceGalleryReady)return;pieceGalleryReady=true;
  document.querySelectorAll('[data-piece-for]').forEach(button=>button.addEventListener('click',()=>{
    pieceTarget=button.dataset.pieceFor;
    document.querySelectorAll('[data-piece-for]').forEach(el=>{const active=el===button;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
    renderPieceGallery();
  }));
  document.querySelectorAll('[data-piece-source]').forEach(button=>button.addEventListener('click',()=>{
    pieceSourceFilter=button.dataset.pieceSource;
    document.querySelectorAll('[data-piece-source]').forEach(el=>{const active=el===button;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
    renderPieceGallery();
  }));
  document.querySelectorAll('[data-paint]').forEach(input=>input.addEventListener('input',()=>{
    options.piecePaint[input.dataset.paint]=input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value;
    syncPiecePaint();persist();
    clearTimeout(paintTimer);paintTimer=setTimeout(refreshCustomPieces,90);
  }));
  $('resetPiecePaint').addEventListener('click',()=>{
    options.piecePaint={...DEFAULT_PAINT};syncPiecePaint();persist();refreshCustomPieces();
  });
  renderPieceGallery();renderPiecePreview();syncPiecePaint();
}

const engine = new StockfishEngine({
  onStatus: (message, isError) => {
    $('engineStatus').textContent = isError ? 'Unavailable' : /ready/i.test(message) ? 'Ready' : 'Loading…';
    $('engineChip').title = message;
    $('engineChip').classList.toggle('error', !!isError);
    if (isError) notify(`Engine unavailable: ${message}`);
  },
  onProgress: percent => { if (percent < 100) $('engineStatus').textContent = `Loading ${percent}%`; },
});

function makeState(from = {}) {
  const mode = from.mode || 'computer';
  const difficulty = from.difficulty || options.difficulty;
  const desiredColor = from.desiredColor || options.color;
  const actualColor = from.actualColor || (desiredColor === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : desiredColor);
  const time = from.time || options.time;
  const duration = time === 'none' ? null : Number(time);
  return {
    id: from.id || `game-${Date.now()}-${++counter}`,
    mode,difficulty,desiredColor,actualColor,time,
    startFen:from.startFen||null,trainingId:from.trainingId||null,puzzleId:from.puzzleId||null,
    seconds: from.seconds && duration !== null ? {w:Math.max(0,Number(from.seconds.w)||0),b:Math.max(0,Number(from.seconds.b)||0)} : {w:duration,b:duration},
    moves: [], selected:null, pending:null, flipped:from.flipped ?? (actualColor === 'b'),
    finished:null, viewPly:null, thinking:false, clockRunning:from.clockRunning === true, lastTick:performance.now(),
    session:(gameState?.session||0)+1,
  };
}
function restoreActive() {
  const previous = store.active;
  game.reset();
  if (!previous || previous.mode === 'local' || !Array.isArray(previous.moves) || previous.moves.length > 500) { gameState=makeState(); return; }
  try {
    if(previous.mode==='puzzle' && !getPuzzle(previous.puzzleId)) throw Error('Unknown saved puzzle');
    if(previous.startFen && !game.load(previous.startFen)) throw Error('Invalid saved starting position');
    const restored = makeState(previous);
    for (const uci of previous.moves) {
      if (!uci || !/^[a-h][1-8]$/.test(uci.from) || !/^[a-h][1-8]$/.test(uci.to)) throw Error('Invalid saved move');
      const move = game.move({from:uci.from,to:uci.to,promotion:uci.promotion||'q'});
      if (!move) throw Error('Illegal saved move');
      restored.moves.push({from:move.from,to:move.to,...(move.promotion?{promotion:move.promotion}:{})});
    }
    if (game.game_over()) throw Error('Finished game saved as active');
    gameState=restored;
  } catch { game.reset(); store.active=null; gameState=makeState(); }
}
function persist() {
  store.options=options;
  store.active=gameState.finished ? null : {
    id:gameState.id,mode:gameState.mode,difficulty:gameState.difficulty,
    desiredColor:gameState.desiredColor,actualColor:gameState.actualColor,time:gameState.time,
    moves:gameState.moves,flipped:gameState.flipped,seconds:gameState.seconds,clockRunning:gameState.clockRunning,
    startFen:gameState.startFen,trainingId:gameState.trainingId,puzzleId:gameState.puzzleId,
  };
  saveStore(store);
}
function notify(message) {
  $('toast').textContent=message;
  $('toast').hidden=false;
  clearTimeout(toastTimeout);
  toastTimeout=setTimeout(()=>{ $('toast').hidden=true; },3500);
}
function updatePreferences() {
  document.body.dataset.theme=options.theme;
  document.body.dataset.boardTheme=options.boardTheme;
  $('settingDark').checked=options.theme==='dark';
  $('settingSounds').checked=options.sounds;
  $('settingLegal').checked=options.legal;
  $('settingCoords').checked=options.coords;
  $('themeToggle').innerHTML=icon(options.theme==='dark'?'sun':'moon');
  $('railThemeToggle').querySelector('svg use').setAttribute('href','assets/icons.svg#'+(options.theme==='dark'?'sun':'moon'));
  document.querySelectorAll('[data-board]').forEach(b=>b.classList.toggle('active',b.dataset.board===options.boardTheme));
  persist();
  renderBoard();
}
function openModal(id) { $(id).hidden=false; document.body.style.overflow='hidden'; $(id).querySelector('button')?.focus(); }
function closeModal(id) { $(id).hidden=true; if (!document.querySelector('.modal-backdrop:not([hidden])')) document.body.style.overflow=''; }
function closeAllModals() { for(const el of document.querySelectorAll('.modal-backdrop')) { if(el.id!=='promotionModal') closeModal(el.id); } }

function syncControls() {
  $('difficulty').value=options.difficulty;
  $('trainingMode').value=options.trainingMode;
  document.body.dataset.trainingKind=options.trainingMode;
  $('newGameLabel').textContent=options.trainingMode==='puzzle'?'New puzzle':options.trainingMode==='position'?'New position':'New game';
  const help=$('trainingInfo');
  help.hidden=options.trainingMode==='computer';
  help.textContent=options.trainingMode==='puzzle'?'Solve rated Lichess tactics at the selected level. The puzzle determines whose turn it is; opponent replies are scripted.':'Enter a real middlegame or endgame position and continue against Stockfish at the selected strength.';
  $('difficultyHint').textContent=getLevel(options.difficulty).description;
  $('timeControl').value=options.time;
  document.querySelectorAll('[data-color]').forEach(button=>{
    button.classList.toggle('selected',button.dataset.color===options.color);
    button.setAttribute('aria-pressed',String(button.dataset.color===options.color));
  });
}
function sideColor() { return gameState.actualColor; }
function userCanMove() { return !gameState.finished && gameState.viewPly === null && !gameState.pending && game.turn()===sideColor(); }
function displayGame() {
  if (gameState.viewPly===null) return game;
  const review=new Chess(gameState.startFen||undefined);
  for (const move of gameState.moves.slice(0,gameState.viewPly)) review.move(move);
  return review;
}
function currentMoves() { return game.history({verbose:true}); }
function lastVisibleMove() {
  const ply=gameState.viewPly===null ? gameState.moves.length : gameState.viewPly;
  return ply ? gameState.moves[ply-1] : null;
}
function squareColor(square) {
  const file=FILES.indexOf(square[0]),rank=Number(square[1]);
  return (file+rank)%2 ? 'dark' : 'light';
}
function kingUnderCheck(position) {
  if (!position.in_check()) return null;
  for (const file of FILES) for(let rank=1;rank<=8;rank++) {
    const square=file+rank,p=position.get(square);
    if (p && p.type==='k' && p.color===position.turn()) return square;
  }
  return null;
}
function annotationPoint(square) {
  const file=FILES.indexOf(square[0]);
  const rank=Number(square[1]);
  return {
    x:(gameState.flipped?7-file:file)*100+50,
    y:(gameState.flipped?rank-1:8-rank)*100+50,
  };
}
function renderArrows() {
  const paths=$('arrowPaths');
  if(!paths || !gameState) return;
  paths.replaceChildren();
  for(const [from,to] of arrows) {
    const a=annotationPoint(from),b=annotationPoint(to);
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    if(from===to) {
      const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
      circle.setAttribute('cx',a.x);circle.setAttribute('cy',a.y);
      circle.setAttribute('r',41);circle.setAttribute('fill','none');
      circle.setAttribute('stroke','#61a32e');circle.setAttribute('stroke-width','9');
      circle.setAttribute('stroke-opacity','.8');paths.append(circle);
      continue;
    }
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
    // Stop short of the destination center, leaving space for the arrow head.
    const inset=34;
    line.setAttribute('x1',a.x);line.setAttribute('y1',a.y);
    line.setAttribute('x2',b.x-dx/d*inset);
    line.setAttribute('y2',b.y-dy/d*inset);
    line.setAttribute('stroke','#61a32e');line.setAttribute('stroke-width','16');
    line.setAttribute('stroke-opacity','.72');line.setAttribute('stroke-linecap','round');
    line.setAttribute('marker-end','url(#annotationHead)');
    paths.append(line);
  }
  $('clearArrows').disabled=arrows.length===0;
  $('drawArrows').classList.toggle('active',arrowMode);
  $('drawArrows').setAttribute('aria-pressed',String(arrowMode));
}
function toggleArrow(from,to) {
  const existing=arrows.findIndex(a=>a[0]===from&&a[1]===to);
  if(existing>=0) arrows.splice(existing,1);
  else arrows.push([from,to]);
  renderArrows();
}
function clearArrows() { arrows=[];arrowSource=null;renderArrows(); }
function renderBoard() {
  if (!gameState) return;
  const position=displayGame();
  const reverse=gameState.flipped;
  const files=reverse?[...FILES].reverse():[...FILES];
  const ranks=reverse?[1,2,3,4,5,6,7,8]:[8,7,6,5,4,3,2,1];
  const last=lastVisibleMove(),check=kingUnderCheck(position);
  const selection=gameState.viewPly===null ? gameState.selected : null;
  const destinations=selection && options.legal ? game.moves({square:selection,verbose:true}) : [];
  const legalDest=new Set(destinations.map(move=>move.to));
  const html=[];
  for (let row=0;row<8;row++) for(let col=0;col<8;col++) {
    const square=files[col]+ranks[row];
    const p=position.get(square);
    const legal=legalDest.has(square);
    const classes=['square',squareColor(square)];
    if (last && (last.from===square||last.to===square)) classes.push('last');
    if (square===selection) classes.push('selected');
    if (square===check) classes.push('in-check');
    html.push(`<button type="button" class="${classes.join(' ')}" data-square="${square}" aria-label="${square}, ${p?(p.color==='w'?'White ':'Black ')+PIECE_NAMES[p.type]:'empty'}${legal?', legal destination':''}" title="${square}">`);
    if (p) html.push(`<img class="piece-img" alt="" draggable="false" src="${pieceImage(p.color,p.type)}">`);
    if (legal) html.push(p?'<span class="ring"></span>':'<span class="dot"></span>');
    if (options.coords && col===0) html.push(`<span class="coord rank">${ranks[row]}</span>`);
    if (options.coords && row===7) html.push(`<span class="coord file">${files[col]}</span>`);
    html.push('</button>');
  }
  $('board').innerHTML=html.join('');
  renderArrows();
}
function clockText(seconds) {
  if (seconds===null) return '';
  const safe=Math.max(0,Math.ceil(seconds)),mins=Math.floor(safe/60),sec=safe%60;
  return `${String(mins).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function renderClock() {
  const timed=gameState.time!=='none';
  $('clockGroup').hidden=!timed;
  if (!timed) return;
  const lower=gameState.flipped?'b':'w',upper=lower==='w'?'b':'w';
  $('topClockLabel').textContent=upper==='w'?'White':'Black';
  $('bottomClockLabel').textContent=lower==='w'?'White':'Black';
  $('topClock').textContent=clockText(gameState.seconds[upper]);
  $('bottomClock').textContent=clockText(gameState.seconds[lower]);
  $('topClock').classList.toggle('active',gameState.clockRunning&&!gameState.finished&&game.turn()===upper);
  $('bottomClock').classList.toggle('active',gameState.clockRunning&&!gameState.finished&&game.turn()===lower);
  for(const [el,side] of [[$('topClock'),upper],[$('bottomClock'),lower]]) el.classList.toggle('low',gameState.seconds[side]!==null&&gameState.seconds[side]<30);
}
function renderPlayers() { renderClock(); }
function renderStatus() {
  let text;
  if (gameState.finished) text=gameState.finished.reason;
  else if (gameState.viewPly!==null) text='Reviewing move history · Return to latest to play';
  else if (gameState.thinking) text=gameState.mode==='puzzle'?'Puzzle opponent replies…':'Stockfish is calculating…';
  else if (gameState.mode==='puzzle') text='Puzzle · '+getLevel(gameState.difficulty).label+' · '+getPuzzle(gameState.puzzleId).theme;
  else if (gameState.mode==='position') text='Position practice · '+getLevel(gameState.difficulty).label;
  else if(game.in_check()) text=(game.turn()==='w'?'White':'Black')+' is in check';
  else text=game.turn()===gameState.actualColor?'Your move':'Stockfish to move';
  $('gameStatus').textContent=text;
  $('boardHelp').textContent=gameState.finished?'Start another challenge to continue':gameState.viewPly!==null?'Return to the latest move to continue':gameState.mode==='puzzle'?'Find the best move':gameState.thinking?'Stockfish is thinking…':'Right-drag for arrows';
  $('puzzleHint').hidden=gameState.mode!=='puzzle'||!!gameState.finished;
  $('nextChallenge').hidden=gameState.mode!=='puzzle';
  renderPuzzleProgress();
  const canUndo=gameState.moves.length>0&&!gameState.finished;
  $('undoMove').disabled=!canUndo;
  $('resignGame').disabled=!!gameState.finished||gameState.mode==='puzzle';
}
function renderPuzzleProgress() {
  const el=$('puzzleProgress');
  if(!el)return;
  const active=options.trainingMode==='puzzle'||gameState?.mode==='puzzle';
  el.hidden=!active;
  if(!active)return;
  const level=options.difficulty;
  const records=store.puzzleProgress;
  const solved=records.solved.filter(id=>getPuzzle(id)?.level===level).length;
  const tried=records.seen.filter(id=>getPuzzle(id)?.level===level).length;
  const total=puzzleCount(level);
  const milestone=20;
  const progression=solved>=milestone ? ' · Milestone reached — try the next level!' : ` · ${milestone-solved} to 20-solve milestone`;
  el.textContent=`${getLevel(level).label} · ${solved}/${total} solved · ${tried} attempted${progression}`;
}
function renderHistory() {
  const container=$('moveHistory'),history=currentMoves();
  if (!history.length) { container.innerHTML=`<div class="empty-state"><span>Play a move to begin.</span></div>`; }
  else {
    container.replaceChildren();
    const fen=(gameState.startFen||new Chess().fen()).split(' ');
    const firstBlack=fen[1]==='b',firstMove=Number(fen[5])||1;
    let row=null,lastNumber=-1;
    for(let j=0;j<history.length;j++) {
      const moveNumber=firstMove+Math.floor((j+(firstBlack?1:0))/2);
      if(moveNumber!==lastNumber) {
        row=document.createElement('div');row.className='history-row';
        const number=document.createElement('span');number.className='history-num';number.textContent=String(moveNumber)+'.';row.append(number);
        if(history[j].color==='b') row.append(document.createElement('span'));
        container.append(row);lastNumber=moveNumber;
      }
      const button=document.createElement('button');button.type='button';button.className='history-move';
      if ((gameState.viewPly??history.length)===j+1) button.classList.add('active');
      button.textContent=history[j].san;
      button.title=`View position after ${history[j].san}`;
      button.addEventListener('click',()=>setView(j+1));row.append(button);
    }
    if (gameState.viewPly===null) container.scrollTop=container.scrollHeight;
  }
  const total=history.length,p=gameState.viewPly??total;
  $('moveCount').textContent=`Move ${p} / ${total}`;
  $('firstMove').disabled=p===0;
  $('previousMove').disabled=p===0;
  $('nextMove').disabled=p>=total;
  $('lastMove').disabled=p>=total;
}
function renderStats() {
  const {wins,losses,draws,winRate}=aggregate(store.record);
  $('statWins').textContent=wins;
  $('statLosses').textContent=losses;
  $('statDraws').textContent=draws;
  $('statWinRate').textContent=winRate+'%';
  $('winBar').style.width=winRate+'%';
  $('fullStats').innerHTML=`<div class="big-stat"><strong>${wins}</strong><span>AI wins</span></div><div class="big-stat"><strong>${draws}</strong><span>AI draws</span></div><div class="big-stat"><strong>${losses}</strong><span>AI losses</span></div>`;
  const recent=$('recentGames');recent.replaceChildren();
  if (!store.record.length) { const empty=document.createElement('div');empty.className='empty-state';empty.textContent='Finished games will appear here.';empty.style.minHeight='95px';recent.append(empty);return; }
  for (const entry of store.record.slice(0,10)) {
    const row=document.createElement('div');row.className='recent-game';
    const label=document.createElement('strong');label.textContent=getLevel(entry.difficulty).label+' AI';
    const date=document.createElement('span');date.textContent=entry.result.toUpperCase()+' · '+new Date(entry.date).toLocaleDateString();
    row.append(label,date);recent.append(row);
  }
}
function render() { renderBoard();renderPlayers();renderStatus();renderHistory();renderStats(); }
function setView(ply) { clearArrows(); const total=gameState.moves.length;gameState.viewPly=ply>=total?null:Math.max(0,ply);gameState.selected=null;render(); }
function beginNewGame() {
  clearArrows();
  engine.newGame();
  game.reset();
  const mode=options.trainingMode;
  let from={mode};
  if(mode!=='computer') {
    const entry=pickTraining(options.difficulty,mode,mode==='puzzle'?'random':options.color,gameState?.trainingId,store.puzzleProgress);
    const position=trainingStart(Chess,entry,mode);
    if(!game.load(position.startFen)) throw Error('Invalid training position');
    from={...from,...position,trainingId:entry.id,desiredColor:position.actualColor,time:mode==='puzzle'?'none':options.time};
  }
  gameState=makeState(from);
  if(mode==='puzzle'&&!store.puzzleProgress.seen.includes(gameState.puzzleId))store.puzzleProgress.seen.push(gameState.puzzleId);
  persist();syncControls();render();
  notify(mode==='puzzle'?`Find the best move · ${getLevel(gameState.difficulty).label}`:mode==='position'?`Play this ${getPuzzle(gameState.trainingId).stage.toLowerCase()} position against Stockfish`:`New game · ${getLevel(gameState.difficulty).label} · ${gameState.actualColor==='w'?'White':'Black'}`);
  maybeThink();
}
function selectSquare(square) {
  if (!userCanMove()) return;
  const piece=game.get(square);
  if (gameState.selected===square) { gameState.selected=null; renderBoard();return; }
  if (gameState.selected && tryPlayerMove(gameState.selected,square)) return;
  gameState.selected=piece&&piece.color===game.turn()?square:null;
  if(gameState.selected)playSound('pickup');
  renderBoard();
}
function tryPlayerMove(from,to) {
  if (!userCanMove()) return false;
  const matching=game.moves({square:from,verbose:true}).filter(m=>m.to===to);
  if (!matching.length) return false;
  if (matching.some(m=>m.flags.includes('p'))) { promptPromotion(from,to);return true; }
  return applyMove(from,to);
}
function promptPromotion(from,to) {
  gameState.pending={from,to};
  const panel=$('promotionOptions');panel.replaceChildren();
  for(const type of PROMOTIONS) {
    const button=document.createElement('button');button.type='button';
    const image=document.createElement('img');image.src=pieceImage(game.turn(),type);image.dataset.promotionType=type;image.alt='';
    button.append(image,document.createTextNode(PIECE_NAMES[type]));
    button.addEventListener('click',()=>{gameState.pending=null;closeModal('promotionModal');applyMove(from,to,type);});
    panel.append(button);
  }
  openModal('promotionModal');
}
function playSound(kind='move') {
  if(options.sounds)playWoodSound(kind);
}
function applyMove(from,to,promotion) {
  if (gameState.finished) return false;
  const puzzle=gameState.mode==='puzzle'?getPuzzle(gameState.puzzleId):null;
  if(puzzle) {
    const expected=puzzle.moves.split(' ')[gameState.moves.length+1];
    const proposed=from+to+(promotion||'');
    let correct=proposed===expected;
    if(!correct && puzzle.theme.toLowerCase().includes('mate in one')) {
      const test=new Chess(game.fen());
      if(test.move({from,to,promotion:promotion||'q'}) && test.in_checkmate()) correct=true;
    }
    if(!correct) {store.puzzleProgress.wrong++;persist();renderPuzzleProgress();notify('Not the best move. Try another idea, or use Hint.');return false;}
  }
  const move=game.move({from,to,promotion:promotion||'q'});
  if(!move) return false;
  gameState.moves.push({from:move.from,to:move.to,...(move.promotion?{promotion:move.promotion}:{})});
  clearArrows();
  gameState.selected=null;gameState.viewPly=null;
  gameState.clockRunning=gameState.time!=='none';gameState.lastTick=performance.now();
  playSound(move.captured?'capture':'move');
  if(puzzle) {
    if(gameState.moves.length===puzzle.moves.split(' ').length-1) {
      if(!store.puzzleProgress.solved.includes(puzzle.id))store.puzzleProgress.solved.push(puzzle.id);
      gameState.finished={winner:gameState.actualColor,reason:'Puzzle solved'};
      engine.stop();persist();render();
      $('resultTitle').textContent='Puzzle solved!';
      $('resultDescription').textContent=`${puzzle.theme} · Rated ${puzzle.rating} · ${gameState.moves.length} moves in the solution.`;
      openModal('resultModal');
    } else {persist();render();maybeThink();}
  } else if (!checkEnd()) { persist();render();maybeThink(); }
  return true;
}
function checkEnd() {
  if(!game.game_over()) return false;
  const winner=game.in_checkmate()?(game.turn()==='w'?'b':'w'):null;
  const reason=game.in_checkmate()?'Checkmate':game.in_stalemate()?'Stalemate':game.in_threefold_repetition()?'Threefold repetition':game.insufficient_material()?'Insufficient material':'Draw by move rule';
  finishGame(winner,reason);return true;
}
function finishGame(winner,reason) {
  if (gameState.finished) return;
  gameState.thinking=false;engine.stop();
  gameState.finished={winner,reason};
  const player=gameState.actualColor;
  const result=winner===null?'draw':winner===player?'win':'loss';
  store.record.unshift({id:gameState.id,date:new Date().toISOString(),mode:gameState.mode,difficulty:gameState.difficulty,result,winner,reason,pgn:game.pgn()});
  store.record=store.record.slice(0,40);
  persist();render();
  const summary=winner===null?'It’s a draw!':winner===player?'You won!':'Stockfish wins!';
  $('resultTitle').textContent=summary;
  $('resultDescription').textContent=`${reason} · ${gameState.moves.length} moves played. Your game has been saved locally.`;
  openModal('resultModal');
}
function tickClock() {
  if (!gameState||gameState.finished||!gameState.clockRunning||gameState.time==='none') return;
  const now=performance.now(),diff=Math.max(0,(now-gameState.lastTick)/1000);
  gameState.lastTick=now;
  const current=game.turn();
  gameState.seconds[current]=Math.max(0,gameState.seconds[current]-diff);
  if(gameState.seconds[current]===0) {finishGame(current==='w'?'b':'w','Time expired');return;}
  renderClock();
  if(now-lastClockSave>4000){lastClockSave=now;persist();}
}
async function maybeThink() {
  if (!gameState||gameState.finished||game.turn()===gameState.actualColor||gameState.thinking) return;
  const session=gameState.session;
  const fen=game.fen();
  gameState.thinking=true;renderPlayers();renderStatus();
  try {
    if(gameState.mode==='puzzle') {
      const reply=getPuzzle(gameState.puzzleId).moves.split(' ')[gameState.moves.length+1];
      await new Promise(resolve=>setTimeout(resolve,350));
      if(session!==gameState?.session||gameState.finished)return;
      gameState.thinking=false;
      if(!reply||!applyMove(...Object.values(uciParts(reply))))throw Error('Invalid scripted puzzle reply');
      return;
    }
    const uci=await engine.think(fen,gameState.difficulty);
    if (!gameState || session!==gameState.session || gameState.finished || game.turn()===gameState.actualColor) return;
    if (!uci || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw Error('Engine returned no legal move');
    gameState.thinking=false;
    if (!applyMove(uci.slice(0,2),uci.slice(2,4),uci[4])) throw Error('Engine returned an illegal move');
  } catch(error) {
    if (session!==gameState?.session) return;
    gameState.thinking=false;
    $('engineChip').classList.add('error');
    $('engineStatus').textContent='Engine unavailable';
    notify(error.message || 'Could not calculate an engine move');
    render();
  }
}
function undo() {
  if(gameState.finished||!gameState.moves.length) return;
  engine.stop();
  clearArrows();
  gameState.session++;
  gameState.thinking=false;
  const count=(game.turn()===gameState.actualColor?2:1);
  for(let i=0;i<count;i++){ if(!game.undo()) break;gameState.moves.pop(); }
  // Allow the user to resume after taking back both sides of an AI exchange.
  gameState.selected=null;gameState.viewPly=null;
  gameState.lastTick=performance.now();
  persist();render();maybeThink();
}
function flip() {gameState.flipped=!gameState.flipped;persist();render();}
function resign() {
  if(gameState.finished) return;
  if(!confirm('Resign this game?')) return;
  const resigning=gameState.actualColor;
  finishGame(resigning==='w'?'b':'w','Resignation');
}
async function copyPgn() {
  const pgn=game.pgn()||'[Event "Chess 360"]\n\n*';
  try{await navigator.clipboard.writeText(pgn);notify('PGN copied to clipboard');}
  catch{window.prompt('Copy your PGN:',pgn);}
}

function bindBoardEvents() {
  const board=$('board');
  board.addEventListener('click',event=>{
    if(suppressClick){suppressClick=false;return;}
    const button=event.target.closest('[data-square]');
    if(!button) return;
    if(arrowMode) {
      if(arrowSource) { toggleArrow(arrowSource,button.dataset.square); arrowSource=null; }
      else { arrowSource=button.dataset.square; }
      return;
    }
    selectSquare(button.dataset.square);
  });
  board.addEventListener('contextmenu',event=>event.preventDefault());
  board.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse' && event.button===2) {
      const square=event.target.closest('[data-square]')?.dataset.square;
      if(square) { rightArrowGesture={from:square,pointer:event.pointerId};event.preventDefault(); }
      return;
    }
    if(arrowMode) return;
    if(!userCanMove()||event.button!==0&&event.pointerType==='mouse')return;
    const button=event.target.closest('[data-square]');if(!button)return;
    const piece=game.get(button.dataset.square);
    if(!piece||piece.color!==game.turn())return;
    dragging={from:button.dataset.square,startX:event.clientX,startY:event.clientY,moved:false,pointer:event.pointerId};
  });
  board.addEventListener('pointermove',event=>{
    if(!dragging||dragging.pointer!==event.pointerId)return;
    const dx=event.clientX-dragging.startX,dy=event.clientY-dragging.startY;
    if(!dragging.moved&&Math.hypot(dx,dy)<9)return;
    if(!dragging.moved)playSound('pickup');
    if(!dragging.moved) {
      dragging.moved=true;
      board.setPointerCapture(event.pointerId);
      gameState.selected=dragging.from;
      renderBoard();
      const piece=game.get(dragging.from);
      dragging.ghost=document.createElement('img');
      dragging.ghost.className='drag-ghost';dragging.ghost.alt='';
      dragging.ghost.src=pieceImage(piece.color,piece.type);
      document.body.append(dragging.ghost);
    }
    dragging.ghost.style.left=event.clientX+'px';dragging.ghost.style.top=event.clientY+'px';
  });
  board.addEventListener('pointerup',event=>{
    if(rightArrowGesture && rightArrowGesture.pointer===event.pointerId) {
      const from=rightArrowGesture.from;rightArrowGesture=null;
      const to=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-square]')?.dataset.square;
      if(to) toggleArrow(from,to);
      return;
    }
    if(!dragging||dragging.pointer!==event.pointerId)return;
    const gesture=dragging;dragging=null;
    if(gesture.ghost)gesture.ghost.remove();
    if(!gesture.moved)return;
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-square]');
    suppressClick=true;
    if(target&&target.dataset.square!==gesture.from) {
      if(!tryPlayerMove(gesture.from,target.dataset.square)) {gameState.selected=null;renderBoard();}
    } else { gameState.selected=gesture.from;renderBoard(); }
    setTimeout(()=>{suppressClick=false;},50);
  });
  board.addEventListener('pointercancel',()=>{dragging?.ghost?.remove();dragging=null;rightArrowGesture=null;});
}
function bindControls() {
  $('difficulty').addEventListener('change',e=>{options.difficulty=e.target.value;syncControls();renderPuzzleProgress();persist();});
  $('trainingMode').addEventListener('change',e=>{options.trainingMode=e.target.value;syncControls();renderPuzzleProgress();persist();});
  $('puzzleHint').addEventListener('click',()=>{
    if(gameState.mode!=='puzzle'||gameState.finished||gameState.thinking)return;
    const next=getPuzzle(gameState.puzzleId).moves.split(' ')[gameState.moves.length+1];
    if(!next)return;
    store.puzzleProgress.hints++;persist();
    gameState.selected=next.slice(0,2);renderBoard();notify('Hint: look at the highlighted piece.');
  });
  $('nextChallenge').addEventListener('click',()=>{options.trainingMode='puzzle';beginNewGame();});
  $('timeControl').addEventListener('change',e=>{options.time=e.target.value;persist();});
  document.querySelectorAll('[data-color]').forEach(button=>button.addEventListener('click',()=>{options.color=button.dataset.color;syncControls();persist();}));
  $('newGame').addEventListener('click',beginNewGame);
  $('undoMove').addEventListener('click',undo);
  $('flipBoard').addEventListener('click',flip);
  $('resignGame').addEventListener('click',resign);
  $('copyPgn').addEventListener('click',copyPgn);
  $('drawArrows').addEventListener('click',()=>{arrowMode=!arrowMode;arrowSource=null;renderArrows();});
  $('clearArrows').addEventListener('click',clearArrows);
  $('firstMove').addEventListener('click',()=>setView(0));
  $('previousMove').addEventListener('click',()=>setView(Math.max(0,(gameState.viewPly??gameState.moves.length)-1)));
  $('nextMove').addEventListener('click',()=>setView(Math.min(gameState.moves.length,(gameState.viewPly??gameState.moves.length)+1)));
  $('lastMove').addEventListener('click',()=>setView(gameState.moves.length));
  for(const id of ['navStats','railStats','mobileStats','viewStats']) $(id).addEventListener('click',()=>{renderStats();openModal('statsModal');});
  $('movesToggle').addEventListener('click',()=>{
    const expanded=$('moveHistoryPanel').classList.toggle('mobile-open');
    $('movesToggle').setAttribute('aria-expanded',String(expanded));
  });
  $('movesClose').addEventListener('click',()=>{
    $('moveHistoryPanel').classList.remove('mobile-open');
    $('movesToggle').setAttribute('aria-expanded','false');
  });
  for(const id of ['navSettings','railSettings']) $(id).addEventListener('click',()=>openModal('settingsModal'));
  initPieceSettings();
  for(const id of ['themeToggle','railThemeToggle']) $(id).addEventListener('click',()=>{options.theme=options.theme==='dark'?'light':'dark';updatePreferences();});
  $('settingDark').addEventListener('change',e=>{options.theme=e.target.checked?'dark':'light';updatePreferences();});
  $('settingSounds').addEventListener('change',e=>{options.sounds=e.target.checked;updatePreferences();});
  $('settingLegal').addEventListener('change',e=>{options.legal=e.target.checked;updatePreferences();});
  $('settingCoords').addEventListener('change',e=>{options.coords=e.target.checked;updatePreferences();});
  document.querySelectorAll('[data-board]').forEach(button=>button.addEventListener('click',()=>{options.boardTheme=button.dataset.board;updatePreferences();}));
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>closeModal(button.closest('.modal-backdrop').id)));
  document.querySelectorAll('.modal-backdrop').forEach(el=>el.addEventListener('click',event=>{if(event.target===el&&el.id!=='promotionModal')closeModal(el.id);}));
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){closeAllModals();$('moveHistoryPanel').classList.remove('mobile-open');$('movesToggle').setAttribute('aria-expanded','false');}
    if(event.key==='ArrowLeft'&&document.activeElement?.closest('.board-column'))setView(Math.max(0,(gameState.viewPly??gameState.moves.length)-1));
    if(event.key==='ArrowRight'&&document.activeElement?.closest('.board-column'))setView(Math.min(gameState.moves.length,(gameState.viewPly??gameState.moves.length)+1));
  });
  $('dismissNotice').addEventListener('click',()=>{$('engineNotice').hidden=true;});
  $('playAgain').addEventListener('click',()=>{closeModal('resultModal');beginNewGame();});
  $('closeResult').addEventListener('click',()=>closeModal('resultModal'));
  bindBoardEvents();
}
// The large prevalidated library is static and works on GitHub Pages without an API.
// If absent (e.g. an unbuilt development checkout), retain the 16 offline samples.
try {
  const response=await fetch('assets/puzzles/catalog.json');
  if(response.ok)registerPuzzleCatalog(await response.json());
} catch(error) { console.info('Using built-in puzzle sample:',error.message); }
restoreActive();
syncControls();bindControls();updatePreferences();render();refreshCustomPieces();
setInterval(tickClock,250);
// The computer-only game needs the full Stockfish engine.
engine.start().then(()=>maybeThink()).catch(error=>{
  $('engineNotice').hidden=false;
  $('engineNoticeText').textContent=error.message;
});
