# Chess 360 — interface rules

**Product:** A board-first local chess app with a full browser-based Stockfish opponent. It is a game screen, not a promotional landing page.

## Design direction
- The **board** is the hero. Prefer more board pixels over extra panels, hero copy, badges, charts or large margins.
- One neutral app background, quiet white/charcoal panels, and **one blue primary action**. No colorful gradients, glowing surfaces, or pseudo-analytics.
- Two columns on wide screens: board first, compact game controls and history second. At tablet/mobile sizes, show the board before the controls.
- Preserve the optional settings and statistics as dialogs, not permanent dashboard cards.
- Chess analysis annotations are real: draw/remove arrows with right-drag or the Arrows control. No invented evaluations or recommendations.
- Board palettes (Walnut, Ocean, Sage and Slate) are distinct from the app theme (light/dark). Never change the chess rules or engine difficulty to fit a visual treatment.
- Controls must work with keyboard focus, touch, and reduced motion. Keep hit areas clear and form labels readable.

## Implementation
`refined.css` contains the design adjustments over the existing `styles.css` so the original look can be traced and working game behavior remains isolated. Additional UI changes belong in `index.html` or `refined.css`. Move/rules code stays in `src/app.js` and the chess.js vendor file; engine logic stays in `src/engine.js`/`src/difficulty.js`.

## Reference acknowledgements
The design audit draws on [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky (CC BY 4.0) and [OpenDesigner](https://github.com/ckryptickunal/OpenDesigner) (MIT). Neither repository was copied into the runtime.
