# speedfox 🦊

Fox watch your video. Fox do math. Fox tell you how much time you save
by watching fast.

Free, open source, MIT licensed. No Chrome Web Store fee — install from
source in a few clicks.

## What it does

- Floating widget on any video: current speed, real finish clock-time,
  time left, time saved.
- Works on YouTube (purpose-built driver) and generic HTML5 `<video>`
  anywhere else — Udemy, Coursera, Vimeo, plain web video.
- Toolbar popup with lifetime stats: total hours saved, this week, videos
  tracked.
- Smart speed suggestions from caption pace, when captions are on.
- Fox mascot. Frosted-glass look, Geist + Special Elite fonts.

## Add your fox art

There's a placeholder at `assets/fox.png`. Overwrite it with your own —
keep the filename `fox.png`, roughly square (128×128 or 256×256, PNG with
transparency looks best). Widget and popup already point at it.

## Install (Chrome, from source)

1. Get the code: `git clone https://github.com/<your-username>/speedfox.git`,
   or click **Code → Download ZIP** on GitHub
2. Open `chrome://extensions`
3. Turn on **Developer mode**
4. Click **Load unpacked**, select the `speedfox-extension` folder
5. Open a video, any video — widget shows up bottom-right, draggable,
   minimizable (–)
6. Click the toolbar icon for lifetime stats

Reload from `chrome://extensions` after pulling updates or swapping in
your own `fox.png`.

## Landing page

`docs/index.html` is a small, single-file landing page (no build step) —
point GitHub Pages at `/docs` on the `main` branch and it's live for free.
Before publishing, edit the `REPO_URL` / `ZIP_URL` / `LICENSE_URL`
constants near the bottom of the file's `<script>` tag.

## How the extension code is organized

- `lib/widget-core.js` — shared: formatting, stats store
  (`chrome.storage.local`), widget DOM/drag logic, caption-pace →
  speed-suggestion math.
- `youtube.js` — YouTube driver. Handles SPA navigation
  (`yt-navigate-finish`), scrapes YouTube's own caption layer since it
  doesn't use native `<track>`.
- `generic.js` — driver for everywhere else. Watches for `<video>` over
  45s (skips ad snippets), uses native `TextTrack`/`cuechange` for caption
  pacing.
- `popup.html` / `popup.js` — reads aggregated stats, renders totals.

## Known limitations

- Generic driver needs `<all_urls>` host permission. Fine for personal
  use/open source; a Chrome Web Store listing would need justification or
  narrower domains.
- No captions on (or no native track) = no speed suggestion, just stats.
- Same video open in two tabs at once can undercount slightly (last write
  wins on the 5s flush window).

## Contributing

Fork it, change it, open a PR. Ideas: per-playlist totals, auto-apply
preferred speed on load, weekly digest, Firefox support.

## License

MIT — see [LICENSE](LICENSE).
