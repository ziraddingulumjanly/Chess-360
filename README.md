# Chess 360

A polished, standalone, browser-based chess site. Play against **full Stockfish 19 Multithreaded**. No sign-in, online matchmaking, cloud database, or API keys.

## Run (Node.js 22+)

```bash
npm start
```

Open **http://localhost:4173**. The server is dependency-free and includes the browser security headers required for Stockfish's multithreaded WebAssembly build. **Do not open `index.html` with `file://`**: the full engine requires an HTTP(S) origin, `SharedArrayBuffer`, and cross-origin isolation.

To run on a different port:

```bash
PORT=8080 npm start
```

On Windows PowerShell:

```powershell
$env:PORT=8080
npm start
```

Test the project with `npm test`. There are no `npm install` dependencies.

## Features

- **Stockfish 19 Full** (99 MB WASM) in a dedicated Web Worker, with full NNUE and multiple threads (no Lite variant).
- Computer play: Easy (~1320 target Elo), Medium (~1800), Hard (~2400), Expert (unrestricted Stockfish). Strength targets are approximate, device-dependent. Expert currently has a five-second think-time budget per move; this is not infinite search.
- Complete chess rules via bundled `chess.js`, including legal moves, checking, promotion, castling, en passant, checkmate, stalemate, repetition and draw detection.
- Click or pointer-drag chess pieces. Legal destinations, last-move highlight, check highlight, board flip and move-history review.
- New game, undo (the last AI exchange when available), resign, copy PGN, optional casual/rapid/blitz clocks.
- Light/dark mode, four board palettes, optional sounds/coordinates/highlights.
- **Training modes:** Play from real-game middlegame/endgame positions against Stockfish at the chosen difficulty, or solve curated Lichess tactical puzzles (Easy, Medium, Hard, Expert) with automatic replies, hints, and next-puzzle controls. The 16 built-in sample puzzles work offline. For the full **4,000-puzzle** rated library (1,000 per difficulty), run `npm run puzzles:build` once, or deploy through the included GitHub Pages workflow (which builds and caches it automatically). Progress, incorrect tries and hints are saved in your browser. All puzzles come from genuine Lichess records, not random arrangements.
- **Piece Theme Gallery:** 20 selectable piece styles (original + 2 shaded traditional Staunton-style sets + 7 Chess Art + 10 individually credited Lichess sets), independent White/Black selection, instant board/drag/promotion previews. Advanced controls for Chess Art Fantasy/Celtic/Spatial: white/black gradient colors, outlines, border thickness, shadows, blur, offset, slant, and flattening. Preferences persist in `localStorage`.
- Active-game autosave, most recent 40 finished games, local statistics and win rate. Stored in your browser's `localStorage`, only for that browser/profile.
- Accessible buttons, responsive desktop and mobile layouts, Lucide UI icons.

## Project structure

```
Chess-360/
├── index.html              Main interface
├── styles.css              Original CSS based on Checkers 360 visual patterns
├── server.mjs              Local HTTP server with COOP/COEP
├── src/app.js              UI and chess gameplay orchestration
├── src/training.js         Rated Lichess puzzles and position selection
├── training.css            Training controls
├── src/engine.js           Stockfish Web Worker protocol / engine lifecycle
├── src/difficulty.js       Stockfish-only difficulty parameters
├── src/storage.js          Browser-local state and statistics
├── engine/stockfish-19.js  Full engine JS loader
├── engine/stockfish-19.wasm Full engine binary / NNUE (99 MB)
├── vendor/chess.min.js     Chess rules, bundled from Stockfish.js example
├── assets/                 Original SVG pieces and PNGs, 19 additional piece themes, Chess Art templates, Lucide icons
└── licenses/               Credits, licenses, engine source archives
```

## Large, balanced puzzle library

The downloaded ZIP contains **16 offline starter puzzles**. It does not contain the complete rated catalog until the build step runs. **Building the expanded catalog** uses the official public-domain Lichess puzzle CSV (not puzzle generation or an artificial loop), selecting 4,000 **distinct, validated** positions:

| Level | Lichess rating | Number |
| --- | --- | ---: |
| Easy | 500–1199 | 1,000 |
| Medium | 1200–1799 | 1,000 |
| Hard | 1800–2399 | 1,000 |
| Expert | 2400–3299 | 1,000 |

Within each level, sampling targets 10% openings, 60% middlegames and 30% endgames. It also rejects low-confidence (rating deviation above 140), low-popularity (below 55) or rarely played (fewer than 50 plays) records. Every retained solution is replayed against bundled `chess.js` at build time; insufficient samples cause the build to **fail**, never silently substitute easier or duplicated puzzles.

```bash
npm run puzzles:build
```

The first build downloads the large official Zstandard archive and saves only the final compact `assets/puzzles/catalog.json`. Requires Node.js 22+ and internet access once. Subsequent game sessions are entirely offline. For an already downloaded archive, use `node scripts/build-puzzles.mjs --input path/to/lichess_db_puzzle.csv.zst` (plain `.csv` also works). `npm start` continues to work without downloading anything; without the generated catalog it offers 16 starter puzzles.

New Puzzle selects unseen puzzles in your selected level first and avoids repeating the immediately previous one. Once all available puzzles have been attempted, it prioritizes unsolved ones. The displayed progress tracks attempts and unique solves per level in local storage, with a 20-solve milestone that encourages moving up a level (but never locks or changes your selection). Puzzle difficulty remains separate from Stockfish AI difficulty.

## GitHub Pages (included workflow)

Use the included `.github/workflows/pages.yml`. It builds and caches the 4,000 puzzles and downloads the official **full, single-thread Stockfish 19** for hosts without the required isolation headers. This preserves full NNUE (not the weaker Lite build); only the thread count changes. Local `npm start` retains the full multithreaded build. The single-thread engine is downloaded by GitHub Actions at build time and is not in this source ZIP.

1. Push this project to the root of a GitHub repository on branch `main`.
2. In GitHub **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. Open **Actions → Deploy Chess 360 to GitHub Pages** (the push also triggers it). The build uploads the static website; it needs no server, account backend, or secrets.

The first workflow build downloads approximately 300 MB of compressed puzzle records and the large extra engine. This can take time; the puzzle cache avoids redownloading the database on later pushes. Keep `licenses/` with the published files to meet third-party obligations.

## Deployment

This is a **static site**: deploy `index.html`, CSS, JS, `vendor/`, `engine/`, `assets/` and `licenses/` to any host that lets you configure HTTP response headers. You must serve these headers on the site and Worker/WASM resources:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```

Serve `stockfish-19.wasm` as `application/wasm`, ensure the Worker and WASM URLs resolve on the same origin, and serve the site via HTTPS (or localhost for development). Cross-origin resources, if introduced later, will also need compatible CORP/CORS policies. Prefer HTTP caching for the engine download: the first load is large, repeat visits can use the browser cache.

**Cloudflare Pages**: create `_headers` with the three header rules above for `/*`. Static hosts lacking these headers use the full single-thread engine *when* `engine/stockfish-19-single.js` and `.wasm` are present. The GitHub Pages workflow installs them automatically. Computer-only games require a working full engine.

## Known scope limits

- No online multiplayer, Supabase, accounts, or server-side game saving.
- No opening book, analysis graphs, cloud synchronization, public tournaments, or Syzygy tablebases.
- Difficulty Elo targets aren't guaranteed ratings. Search time and device performance affect strength.
- The first visit downloads about 94–99 MB of WASM. Cross-origin isolated browsers use the multithreaded full build; non-isolated browsers use the full single-thread build if it was provisioned by the GitHub Pages workflow.
- State is local to the browser and can be erased by clearing site data. Clock persistence uses periodic checkpoints rather than server-authoritative timing.
- Full engine and artwork licenses matter for redistribution: review `licenses/NOTICE.txt` and the source archives before publishing.

## License and provenance

Stockfish/Stockfish.js: GPLv3. `chess.js`: BSD. Lucide: ISC. Chess piece artwork: see Cburnett attribution in `licenses/NOTICE.txt`, plus `licenses/PIECE-THEMES.md` for the 19 additional sets, original creators, and individual licenses. Attribution alone does not supersede a license. The Checkers 360 source was used as an interaction and visual reference only; its game engine, AI difficulty logic, proprietary code, Supabase, authentication, and multiplayer features are **not included**.


## Chess-first UI refinement

The interface uses a single board-first layout and one compact side rail. Navigation and statistics are preserved, but decorative hero content and redundant dashboard cards are not displayed. The design uses quiet neutral surfaces, clear focus outlines, and a restrained blue action color. These decisions followed an audit inspired by the supplied *unslop* and OpenDesigner repositories; those packages are **not** runtime dependencies.

### Board annotations

- **Desktop:** right-drag from any square to another to draw a green arrow; right-click on a square adds a ring. Right-drag again to remove the same arrow.
- **Touch or mouse:** press **Arrows** below the board, then tap/click a starting square and a destination. Tap **Arrows** again to return to normal chess moves.
- Use the small **×** next to Arrows to clear annotations. Moving a piece, undoing, starting another game, or navigating move history automatically clears them.

In **Settings**, choose among Walnut, Ocean, Sage, or Slate board colors. No engine behavior or difficulty logic was altered in this UI update.

## Compact board-first layout

The board sits directly below the compact header, with no player or engine strip above it. Untimed games show no clocks or infinity symbols. Blitz/Rapid games display both timers in a small bar **below** the board. The site supports play against Stockfish only; previously saved local two-player games are not resumed.

## Viewport-fit UI and website resources

The board is constrained by both available width and visible viewport height to avoid vertical cropping at normal browser zoom. Documentation, contact, privacy, cookies, terms, and license pages are shipped as static HTML; the compact link footer comes after gameplay and never counts against board height. No green visual status dots are rendered. The navbar GitHub link leads to the official Stockfish.js engine repository; a Chess 360 repository URL has not been provided. Website-owner contact details also need to be configured before publication. SVG piece silhouettes are traced derivatives of the existing Cburnett artwork and remain attributed under CC BY-SA 3.0.

## UI styling

The interface adopts the typography and neutral button/panel palette from the user's IGCSE Chat app (`igcse-chat.css`): 14px Inter/system base, light `#fff` / dark `#212121`, dark surfaces `#2f2f2f`, subtle 8px button radii, and muted hover states. All UI icons are rebuilt from the bundled official Lucide SVG source under ISC. The 12 chess-piece SVGs remain independent from interface icons. Existing saved theme preferences still take precedence.

## One-screen game layout

The game page keeps the board, action buttons and setup within the opening viewport. On desktop, project/legal links are in a left rail; below 1150 px they move into the navigation Resources menu, and on mobile into the site-links menu. Mobile move history is opened from **Moves** near the chessboard. Documentation pages remain separate and can scroll normally.

## Customizing chess piece artwork

Go to **Settings → Chess piece styles**. Select All, Traditional, Chess Art, or Lichess to filter the gallery. Classic Ivory and Classic Wood supply two shaded Staunton-style options. Apply a style to Both sides, White, or Black. If either side uses Fantasy, Celtic, or Spatial, use **Chess Art customization** for independent gradient and outline colors, shadow toggle and colors, blur, position, slant, and stroke sizes. Changes update the live board without restarting the game, and are saved locally. **Reset colors and effects** restores the default paint palette. These styles are visual only: the Stockfish 19 engine and `chess.js` remain unchanged.

The underlying Chess Art source SVGs are copied from the supplied `chess-art-main.zip` into `assets/chess-art/`. Default rendered SVGs for Fantasy/Celtic/Spatial come from the same Chess Art author via Lichess. Other Lichess SVGs are copied from the supplied `lila-master.zip`. Individual artists are named in the [theme license manifest](licenses/PIECE-THEMES.md). No external libraries, CDNs, user accounts, or API keys are required to use the themes.
