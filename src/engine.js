import { getLevel, uciOptions } from './difficulty.js';

// The engine runs entirely inside a Web Worker. We never run its heavy WASM on the UI thread.
export class StockfishEngine {
  constructor({ onStatus = () => {}, onProgress = () => {} } = {}) {
    this.onStatus = onStatus;
    this.onProgress = onProgress;
    this.worker = null;
    this.bootPromise = null;
    this.readyWaiters = [];
    this.currentSearch = null;
    this.tail = Promise.resolve();
    this.uciReady = false;
    this.resetNeeded = true;
    this.progressChannel = null;
    this.singleThread = false;
  }
  start() {
    if (this.bootPromise) return this.bootPromise;
    // GitHub Pages cannot configure COOP/COEP. Use the official full single-thread
    // Stockfish 19 there; on isolated hosts retain our original multithreaded build.
    this.singleThread = !globalThis.crossOriginIsolated || !globalThis.SharedArrayBuffer;
    this.onStatus(this.singleThread?'Loading full single-thread Stockfish 19…':'Loading full multithread Stockfish 19…');
    this.bootPromise = new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) { settled = true; reject(new Error('Engine startup timed out. Please reload the page.')); }
      }, 120000);
      try {
        this.worker = new Worker(this.singleThread?'engine/stockfish-19-single.js':'engine/stockfish-19.js');
        this.worker.onerror = (event) => {
          const error = new Error(event.message || 'Stockfish failed to start');
          this.onStatus(error.message, true);
          if (!settled) { settled = true; clearTimeout(timer); reject(error); }
          this._failPending(error);
        };
        this.worker.onmessage = ({ data }) => {
          if (typeof data !== 'string') return;
          for (const text of data.split(/\r?\n/)) {
            if (text === 'uciok') { this.uciReady = true; this.worker.postMessage('isready'); }
            else if (text === 'readyok') {
              const waiter = this.readyWaiters.shift(); if (waiter) waiter();
              else if (!settled && this.uciReady) { settled = true; clearTimeout(timer); this.onStatus(this.singleThread?'Stockfish 19 · Full single-thread ready':'Stockfish 19 · Full multithread ready'); resolve(); }
            }
            else if (text.startsWith('bestmove ')) {
              if (this.currentSearch) {
                const search = this.currentSearch; this.currentSearch = null;
                clearTimeout(search.timer);
                search.resolve(text.split(/\s+/)[1] || null);
              }
            }
          }
        };
        // Only the bundled multithread loader advertises this progress channel.
        if(!this.singleThread) {
          const channel = new MessageChannel();
          this.progressChannel = channel;
          channel.port2.onmessage = ({ data }) => {
            if (data && typeof data.percent === 'number') this.onProgress(Math.min(100, Math.round(data.percent * 100)));
          };
          this.worker.postMessage({ progressPort:channel.port1 }, [channel.port1]);
        }
        this.worker.postMessage('uci');
      } catch (error) { settled = true; clearTimeout(timer); reject(error); }
    });
    return this.bootPromise;
  }
  _failPending(error) {
    for (const done of this.readyWaiters.splice(0)) done(error);
    if (this.currentSearch) { clearTimeout(this.currentSearch.timer); this.currentSearch.reject(error); this.currentSearch = null; }
  }
  _ready() {
    return new Promise((resolve, reject) => {
      this.readyWaiters.push(error => error ? reject(error) : resolve());
      this.worker.postMessage('isready');
    });
  }
  stop() {
    if (this.currentSearch) this.worker?.postMessage('stop');
  }
  // Searches are serialized: a cancelled bestmove can never be mistaken for the next search's result.
  think(fen, levelName) {
    const task = this.tail.catch(() => {}).then(async () => {
      await this.start();
      if (this.resetNeeded) { this.worker.postMessage('ucinewgame'); this.resetNeeded = false; }
      for (const command of uciOptions(levelName, navigator.hardwareConcurrency || 4)) {
        if(this.singleThread && command.startsWith('setoption name Threads ')) continue;
        this.worker.postMessage(command);
      }
      await this._ready();
      this.worker.postMessage(`position fen ${fen}`);
      const ms = getLevel(levelName).thinkMs;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { this.worker?.postMessage('stop'); }, ms + 30000);
        this.currentSearch = { resolve, reject, timer };
        this.worker.postMessage(`go movetime ${ms}`);
      });
    });
    this.tail = task;
    return task;
  }
  newGame() {
    // Reset only after the previous search has finished. UCI commands must not race.
    this.resetNeeded = true;
    this.stop();
  }
  dispose() { this.worker?.terminate(); this.progressChannel?.port1.close(); this.progressChannel?.port2.close(); this.progressChannel = null; this.worker = null; this.bootPromise = null; }
}
