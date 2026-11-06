# Publish Chess 360 to GitHub Pages

The repository `ziraddingulumjanly/Chess360` was confirmed **empty** on 2026-11-06.

On Windows, extract the ZIP, open the `Chess-360` folder, and double-click
`publish-to-github.bat` (or run `publish-to-github.ps1` in PowerShell).
Git must be installed; Git will request GitHub login if necessary.

The script only creates a local commit and pushes it to the known repository.
It refuses to replace a different existing Git remote, and does not force-push.

Once the script reports a successful push:

1. Open https://github.com/ziraddingulumjanly/Chess360/settings/pages
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open https://github.com/ziraddingulumjanly/Chess360/actions
4. Confirm the **Deploy Chess 360 to GitHub Pages** workflow succeeded.
5. Open https://ziraddingulumjanly.github.io/Chess360/

Deployment requires GitHub Actions to download Lichess puzzle data and the
single-threaded Stockfish 19 build. There may be an initial build failure if
Pages is not enabled before the first push; after selecting GitHub Actions,
re-run the workflow from its Actions page.

The source ZIP includes the large, local multithreaded Stockfish WASM file.
GitHub rejects individual files >= 100 MB; the engine file is currently just
under that limit. Do not make the engine file bigger without changing delivery.
