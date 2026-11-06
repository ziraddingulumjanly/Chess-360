// Stockfish 19 UCI strength settings. These are *not* copied from Checkers 360.
// Elo numbers are Stockfish calibration targets rather than guaranteed ratings.
export const LEVELS = Object.freeze({
  easy:   { label: 'Easy',   elo: 1320, thinkMs: 700,  description: 'A gentle introduction using Stockfish’s native strength limitation.' },
  medium: { label: 'Medium', elo: 1800, thinkMs: 1100, description: 'A balanced challenge using Stockfish’s native strength control.' },
  hard:   { label: 'Hard',   elo: 2400, thinkMs: 1800, description: 'A tough opponent with more time to calculate.' },
  expert: { label: 'Expert', elo: null, thinkMs: 5000, description: 'Unrestricted full Stockfish 19, with a five-second calculation budget per move.' },
});
export function getLevel(id) { return LEVELS[id] || LEVELS.medium; }
export function uciOptions(id, hardwareConcurrency = 4) {
  const level = getLevel(id);
  const threads = Math.min(8, Math.max(1, (Number.isFinite(hardwareConcurrency) ? hardwareConcurrency : 4) - 1));
  return [
    `setoption name Threads value ${threads}`,
    'setoption name Hash value 128',
    'setoption name Skill Level value 20',
    `setoption name UCI_LimitStrength value ${level.elo === null ? 'false' : 'true'}`,
    ...(level.elo === null ? [] : [`setoption name UCI_Elo value ${level.elo}`]),
  ];
}
