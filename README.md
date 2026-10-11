# Syntax Side by Side

A web page for choosing your next programming language. It shows the same program in as many languages as you like, side by side, with syntax highlighting.

- Five programs of different sizes, taken from [Rosetta Code](https://rosettacode.org): Hello world, FizzBuzz, Quicksort, Anagrams and Conway's Game of Life.
- Every language Rosetta Code has for a program, from 140 for Anagrams to 624 for Hello world.
- Each card is as wide as its code. Comments wrap instead of widening the card.
- Five code themes (GitHub, One Dark Pro, Dracula, Ayu, Monokai) and a light or dark page.
- Remembers your languages, program and theme in the browser.

## Run it locally

```bash
npm start
```

Then open http://localhost:8080. This uses Python 3, which macOS already has; any static file server works too. Opening `index.html` straight from the Finder won't work, because browsers block pages opened from disk from loading the `data/` files.

## Update the code samples

The page reads ready-made JSON files from `data/`. To rebuild them from Rosetta Code:

```bash
npm install
npm run data
```

`npm run data` reuses pages already downloaded to `.cache/rosetta/`. Use `npm run data:refresh` to download everything again and pick up recent edits on Rosetta Code.

The script also measures how wide each solution is, ignoring comments, using the same highlighter as the page. Keep the `shiki` version in `package.json` equal to the one in `SHIKI_URL` in `index.html`, or card widths can drift.

To change which programs are included, edit the `TASKS` list at the top of `scripts/build-data.mjs`.

## Publish it for free

The site is plain static files, so free static hosting works. With GitHub Pages:

1. Create an empty repository named `syntax-side-by-side` on GitHub and push this folder to it.
2. In the repository, open **Settings → Pages**, choose **Deploy from a branch**, then branch `main` and folder `/ (root)`.
3. After a minute the site is live at `https://<your-username>.github.io/syntax-side-by-side/`.

Cloudflare Pages and Netlify also work: point them at the repository with no build command and `/` as the output folder.

## How it's built

- `index.html` holds the whole page: layout, styles and script. There is no framework and no build step.
- Highlighting is [Shiki](https://shiki.style), loaded from the jsDelivr CDN. Fonts come from Google Fonts.
- `scripts/build-data.mjs` downloads the Rosetta Code pages (including subpages such as `FizzBuzz/Basic`), splits them into one entry per language, picks a highlighter grammar for each, and writes `data/*.json`.

## Credits

Code samples are by Rosetta Code contributors and shared under the [GNU Free Documentation License 1.3](https://www.gnu.org/licenses/fdl-1.3.html). Each card links back to its source.
