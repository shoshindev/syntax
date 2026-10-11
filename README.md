# Syntax Side by Side

A web page for choosing your next programming language. It shows the same program in as many languages as you like, side by side, with syntax highlighting.

Live at **https://shoshindev.github.io/syntax-comparison/**

- 25 programs from [Rosetta Code](https://rosettacode.org), listed from shortest to longest: from Hello world and string basics through classes, exceptions and sorting to N-queens and Conway's Game of Life.
- Every language Rosetta Code has for a program, from 118 for Exceptions to 624 for Hello world. When a language has several solutions, the card lets you switch between them.
- Starts with JavaScript, Python, Go and Rust. Add more from a searchable list with popular languages on top; it works from the keyboard.
- Each card is as wide as its code. Comments wrap instead of widening the card.
- Each card shows its line and character count and links to its source. Its menu moves it left or right or copies the code.
- 20 code themes, split into light and dark: the most-installed VS Code themes plus VS Code's own Light+ and Dark+.
- 20 coding fonts, such as JetBrains Mono, Fira Code, Cascadia Code and Source Code Pro.
- A light or dark page. Until you pick a code theme, the code follows the page (GitHub Light or GitHub Dark).
- The program list can be hidden to give the cards more room.
- Remembers your languages, the solution each card shows, the program, theme, font and whether the list is hidden, in the browser.

## Run it locally

```bash
git clone https://github.com/shoshindev/syntax-comparison.git
cd syntax-comparison
npm run dev
```

Then open http://127.0.0.1:8080. Stop it with Ctrl+C. This uses Python 3, which macOS already has; any static file server works too. Opening `index.html` straight from the Finder won't work, because browsers block pages opened from disk from loading the `data/` files.

## Update the code samples

The page reads ready-made JSON files from `data/`. To rebuild them from Rosetta Code:

```bash
npm install
npm run data
```

`npm run data` reuses pages already downloaded to `.cache/rosetta/`. Use `npm run data:refresh` to download everything again and pick up recent edits on Rosetta Code.

The script also measures how wide each solution is, ignoring comments, using the same highlighter as the page. Keep the `shiki` version in `package.json` equal to the one in `SHIKI_URL` in `index.html`, or card widths can drift.

To change which programs are included, edit the `TASKS` list at the top of `scripts/build-data.mjs`.

## Publish your own copy

The site is plain static files. The live site is GitHub Pages serving the `main` branch as is, with no build step. To publish your own copy for free:

1. Fork this repository on GitHub.
2. In your fork, open **Settings → Pages**, choose **Deploy from a branch**, then branch `main` and folder `/ (root)`.
3. After a minute the site is live at `https://<your-username>.github.io/syntax-comparison/`.

Cloudflare Pages and Netlify also work: point them at the repository with no build command and `/` as the output folder.

## How it's built

- `index.html` holds the whole page: layout, styles and script. There is no framework and no build step.
- Highlighting is [Shiki](https://shiki.style), loaded from the jsDelivr CDN. Fonts come from Google Fonts; a code font is only downloaded when you pick it.
- `scripts/build-data.mjs` downloads the Rosetta Code pages (including subpages such as `FizzBuzz/Basic`), splits them into one entry per language, picks a highlighter grammar for each, and writes `data/*.json`.

## Credits

Code samples are by Rosetta Code contributors and shared under the [GNU Free Documentation License 1.3](https://www.gnu.org/licenses/fdl-1.3.html). Each card links back to its source.
