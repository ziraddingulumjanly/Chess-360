import { themeById, cleanPaint } from './pieces.js';
const KEY = 'chess360.v1';
const DEFAULTS = {
  options: { mode:'computer', trainingMode:'computer', difficulty:'medium', color:'w', time:'none', theme:'dark', boardTheme:'walnut', sounds:true, legal:true, coords:true, pieceWhite:'classic', pieceBlack:'classic', piecePaint:cleanPaint() },
  record: [],
  puzzleProgress: { seen:[], solved:[], wrong:0, hints:0 },
  active: null,
};
function cleanOptions(x = {}) {
  const valid = (value, options, fallback) => options.includes(value) ? value : fallback;
  return {
    mode: 'computer',
    trainingMode: valid(x.trainingMode,['computer','position','puzzle'],'computer'),
    difficulty: valid(x.difficulty,['easy','medium','hard','expert'],'medium'),
    color: valid(x.color,['w','b','random'],'w'),
    time: valid(x.time,['none','180','300','600'],'none'),
    theme: valid(x.theme,['light','dark'],'dark'),
    boardTheme: valid(x.boardTheme,['walnut','blue','sage','slate'],'walnut'),
    sounds: x.sounds !== false,
    legal: x.legal !== false,
    coords: x.coords !== false,
    pieceWhite: themeById(x.pieceWhite) ? x.pieceWhite : 'classic',
    pieceBlack: themeById(x.pieceBlack) ? x.pieceBlack : 'classic',
    piecePaint: cleanPaint(x.piecePaint),
  };
}
export function initialStore() { return structuredClone(DEFAULTS); }
export function loadStore(storage) {
  try {
    storage ||= globalThis.localStorage;
    const raw = JSON.parse(storage.getItem(KEY));
    if (!raw || typeof raw !== 'object') return initialStore();
    const progress=raw.puzzleProgress && typeof raw.puzzleProgress==='object' ? raw.puzzleProgress : {};
    const ids=items=>Array.isArray(items)?[...new Set(items.filter(x=>typeof x==='string'&&/^[a-zA-Z0-9]{5}$/.test(x)))].slice(0,20000):[];
    return { options: cleanOptions(raw.options), record: Array.isArray(raw.record) ? raw.record.slice(0, 40) : [],
      puzzleProgress:{seen:ids(progress.seen),solved:ids(progress.solved),wrong:Math.max(0,Number(progress.wrong)||0),hints:Math.max(0,Number(progress.hints)||0)},
      active: raw.active && typeof raw.active === 'object' ? raw.active : null };
  } catch { return initialStore(); }
}
export function saveStore(state, storage) {
  try {
    storage ||= globalThis.localStorage; storage.setItem(KEY, JSON.stringify(state)); return true; }
  catch { return false; } // private mode or full storage: play remains available
}
export function aggregate(records) {
  const games = records.filter(r => r && r.mode === 'computer');
  const wins = games.filter(r => r.result === 'win').length;
  const losses = games.filter(r => r.result === 'loss').length;
  const draws = games.filter(r => r.result === 'draw').length;
  const total = wins + losses + draws;
  return { wins, losses, draws, total, winRate: total ? Math.round(100 * wins / total) : 0 };
}
