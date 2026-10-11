# Syntax Side by Side

A web page for choosing your next programming language. It shows the same program in as many languages as you like, side by side, with syntax highlighting.

Live at **https://shoshindev.github.io/syntax/**

- 25 programs from [Rosetta Code](https://rosettacode.org), from Hello world to Conway's Game of Life, in every language Rosetta Code has for them.
- Add languages from a searchable list. When a language has several solutions, its card lets you switch between them.
- Each card is as wide as its code. Comments wrap instead of widening it.
- 20 code themes and 20 coding fonts, on a light or dark page.
- Your languages, program, theme and font are remembered in the browser.

## Run it locally

```bash
git clone https://github.com/shoshindev/syntax.git
cd syntax
npm run dev
```

Then open http://127.0.0.1:8080. This needs Python 3, which macOS already has. Opening `index.html` straight from disk won't work, because browsers block it from loading the `data/` files.

## Update the code samples

The page reads ready-made JSON files from `data/`. To rebuild them from Rosetta Code:

```bash
npm install
npm run data          # reuses pages cached in .cache/rosetta/
npm run data:refresh  # downloads every page again
```

The program list is `TASKS` at the top of `scripts/build-data.mjs`. Keep the `shiki` version in `package.json` equal to the one in `SHIKI_URL` in `index.html`, or card widths drift.

## Publish your own copy

The site is plain static files with no build step.

1. Fork this repository on GitHub.
2. In your fork, open **Settings → Pages**, choose **Deploy from a branch**, then branch `main` and folder `/ (root)`.
3. After a minute the site is live at `https://<your-username>.github.io/syntax/`.

## Credits

Code samples are by Rosetta Code contributors and shared under the [GNU Free Documentation License 1.3](https://www.gnu.org/licenses/fdl-1.3.html). Each card links back to its source. Highlighting is by [Shiki](https://shiki.style).
