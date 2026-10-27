# speedfox 🦊

Fox watches your video. Fox does the math. Fox tells you how much time
you're saving by watching fast.

Free, open source, MIT licensed. No Chrome Web Store fee, just load it
from source.

## What it does

- Small draggable speed pill on the page while a video plays.
- Toolbar popup with the current tab's video: speed, real finish clock
  time, time left, time saved.
- Works on YouTube. Turn on **Also run on other video sites** in the
  popup to add generic HTML5 `<video>` anywhere else: Udemy, Coursera,
  Vimeo, plain web video.
- Lifetime stats in the same popup: total hours saved, this week,
  videos tracked.
- Smart speed suggestions from caption pace in the popup, when captions
  are on.
- Fox mascot, frosted glass look, Geist + Special Elite fonts bundled
  in `fonts/`, so no font CDN requests.

## Install (Chrome, from source)

1. Clone it or click **Code → Download ZIP** on GitHub
2. Open `chrome://extensions`
3. Turn on **Developer mode**
4. Click **Load unpacked**, select the `speedfox-extension` folder
5. Open a YouTube video, a small speed pill shows up bottom right
6. Click the toolbar icon for this video's details and lifetime stats

Reload from `chrome://extensions` after any update.

## Add your own fox art

Swap `assets/fox.png` for your own image. Same filename, roughly square,
PNG with transparency works best.

## Code layout

- `background.js`: owns lifetime stats so tabs never overwrite each
  other, and registers the generic driver when other sites are allowed
- `lib/widget-core.js`: shared logic, playback accounting, widget UI,
  caption based speed suggestions
- `youtube.js`: YouTube driver, handles SPA navigation and caption
  scraping
- `generic.js`: driver for every other site with a `<video>` tag
- `popup.html` / `popup.js`: current video details and lifetime stats

## Known limitations

- Other sites need the optional access to all websites, granted from
  the popup
- No captions on means no speed suggestion, just the normal stats
- The popup's "whole video" figure is an estimate at the current speed;
  the popup totals count only playback that actually happened

## Contributing

Fork it, change it, open a PR. Ideas: per playlist totals, auto apply a
preferred speed, weekly digest, Firefox support.

## License

MIT, see [LICENSE](LICENSE).
