# speedfox 🦊

Fox watches your video. Fox does the math. Fox tells you how much time
you're saving by watching fast.

Free, open source, MIT licensed. No Chrome Web Store fee, just load it
from source.

## What it does

- Floating widget on any video: current speed, real finish clock time,
  time left, time saved.
- Works on YouTube plus generic HTML5 `<video>` anywhere else: Udemy,
  Coursera, Vimeo, plain web video.
- Toolbar popup with lifetime stats: total hours saved, this week,
  videos tracked.
- Smart speed suggestions from caption pace, when captions are on.
- Fox mascot, frosted glass look, Geist + Special Elite fonts.

## Install (Chrome, from source)

1. Clone it or click **Code → Download ZIP** on GitHub
2. Open `chrome://extensions`
3. Turn on **Developer mode**
4. Click **Load unpacked**, select the `speedfox-extension` folder
5. Open any video, widget shows up bottom right
6. Click the toolbar icon for lifetime stats

Reload from `chrome://extensions` after any update.

## Add your own fox art

Swap `assets/fox.png` for your own image. Same filename, roughly square,
PNG with transparency works best.

## Code layout

- `lib/widget-core.js`: shared logic, stats storage, widget UI, caption
  based speed suggestions
- `youtube.js`: YouTube driver, handles SPA navigation and caption
  scraping
- `generic.js`: driver for every other site with a `<video>` tag
- `popup.html` / `popup.js`: lifetime stats popup

## Known limitations

- Needs broad host permissions to detect video on any site
- No captions on means no speed suggestion, just the normal stats
- Same video open in two tabs can undercount savings slightly

## Contributing

Fork it, change it, open a PR. Ideas: per playlist totals, auto apply a
preferred speed, weekly digest, Firefox support.

## License

MIT, see [LICENSE](LICENSE).
