# LexForge

English | [简体中文](./README.zh-CN.md)

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](./LICENSE)

A **fully offline** English vocabulary trainer. It doesn't drill flashcards — it trains words **through reading**: it picks words smartly from your dictionary, generates a passage built around exactly those words (text, questions, glossary, answer key), and schedules follow-up reviews after you're done.

No server, no account, no network dependency (except the optional fetch tool): double-click `index.html` and it works. All data lives in your browser's localStorage.

## Features

- **Dictionary**: the first stop for every word; edit senses / collocations / examples, delete entries, one-click sync from the library
- **Fetch tool**: grab entries from the Collins / Oxford **official websites** straight into your library — senses, collocations, examples and phonetics included (see below)
- **Build a passage**: paragraph / question / target-word counts scale with the length automatically, or fix them manually; the generated prompt feeds your favorite AI, and the AI writes the reading material
- **Smart word picking**: weighted by due date, mastery, part-of-speech spread and unfamiliarity; supports per-sense weaknesses (drill only the senses you don't know)
- **Review check-in**: mark words one by one after reading; the next review is scheduled automatically
- **Data management**: CSV import/export, full backup/restore, wordpack import
- **Bilingual UI (English / Chinese)**, light & dark themes

## Quick start

1. Open `index.html` (Edge / Chrome recommended)
2. Add a few words via **Import** (type them by hand, paste a list, or use the fetch tool below)
3. In **Dictionary**, pick words into a word bank
4. In **Build a passage**: smart-pick words → generate the prompt → paste it to an AI → paste the AI's passage back and practice

> Tip: data lives in your browser — **export a backup now and then from the Data page**.

## Fetch tool (optional)

For words missing from your library, a small command-line tool can fetch entries from the Collins / Oxford **official websites** (needs Node 18+ and internet). It uses no third-party API or service — it visits the dictionary sites directly. Fetched content is for personal study only; please respect each site's terms of use.

**Way 1 · Manual**: double-click `tools/fetch-words.cmd` and type ONE line: the first character is a digit picking the dictionary (`1` Oxford, default, **recommended** / `2` Collins website), followed by the words to fetch, separated by spaces, then press Enter. The JSON pack is copied to your clipboard automatically — go back to the page, **Import → paste the pack**.

- **Oxford (recommended)**: plain HTTP requests, one word per second, supports `--concurrency`.
- **Collins**: the site sits behind Cloudflare, so the tool opens a hidden window with your local Chrome/Edge to load pages (playwright-core is installed automatically on first run; about 10 seconds per word — use Oxford if you're in a hurry).

**Way 2 · One click from the page**: double-click `tools/register-fetch-protocol.cmd` to register the `lexforge-fetch://` protocol; afterwards the "Open fetch tool" button on the page runs it directly. Unregister with `tools/register-fetch-protocol.cmd -u`.

You can also skip all tools entirely: **Import → Add a word** to type entries by hand, or paste a plain word list — see the import dialog for details.

## Project layout

```
index.html            App entry (single page)
assets/
  dictstore.js        Library storage / entry deletion (tombstone) mechanism
  store.js            Word banks & review scheduling
  word.js             Entry data model
  scheduler.js        Smart word-picking scores
  promptgen.js        Prompt generation
  i18n.js             UI strings (EN / ZH)
  ui.js               UI rendering
  app.js              Event wiring
  style.css           Styles (light / dark)
tools/
  fetch-words.cmd     One-line fetch entry (Windows; installs deps on first run)
  fetch-words.js      Fetch logic (Node 18+)
  collins.js          Collins website page parser
  register-fetch-protocol.cmd  Register / unregister the lexforge-fetch:// protocol
package.json          Dependency manifest for the fetch tool (playwright-core)
```

> README, LICENSE and .gitignore are repository meta files and are not listed above.

## Privacy

All data stays in your own browser. The fetch tool only visits the dictionary websites when you run it, and uploads nothing.

## License

This project is released under **CC BY-NC-SA 4.0** (Attribution–NonCommercial–ShareAlike 4.0 International); see [LICENSE](./LICENSE) for the full text.

- ✅ Free to **use, study, modify and redistribute**, including publishing your own fork
- ✍️ Attribution **must be preserved** when using, modifying or redistributing (the copyright notice and license link at the top of LICENSE may not be removed or replaced)
- ❌ **Non-commercial only** — selling the tool, building it into paid services or commercial products, etc. is not allowed
- 🔄 Forks must be distributed **under the same license** (ShareAlike), without additional restrictions

> The human-readable summary is on [creativecommons.org](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.en) — informational only; [LICENSE](./LICENSE) is the binding text.

> Also note: dictionary content fetched with the tool (entries, senses, examples, etc.) is copyrighted by Oxford University Press, HarperCollins Publishers and their respective rights holders. This license covers only this project's code, UI strings and documentation.
