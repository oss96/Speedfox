// SpeedSaver — YouTube driver
(function () {
  const Core = window.SpeedSaverCore;
  const MASCOT_URL = chrome.runtime.getURL('assets/fox.png');

  let widgetEl = null;
  let video = null;
  let rafId = null;
  let statsInterval = null;
  let lastTime = 0;
  let currentVideoKey = null;

  // YouTube renders captions itself rather than using native <track> cues,
  // so we scrape the caption layer with a rolling wall-clock word buffer.
  function createYoutubeCaptionTracker() {
    let buffer = []; // { t, words }
    const container = () => document.querySelector('.ytp-caption-window-container');
    let observer = null;
    let seenText = '';

    function attach() {
      const c = container();
      if (!c || observer) return;
      observer = new MutationObserver(() => {
        const text = c.textContent.trim();
        if (!text || text === seenText) return;
        seenText = text;
        const words = text.split(/\s+/).filter(Boolean).length;
        buffer.push({ t: Date.now(), words });
        const cutoff = Date.now() - 20000;
        buffer = buffer.filter((b) => b.t >= cutoff);
      });
      observer.observe(c, { childList: true, subtree: true, characterData: true });
    }

    return {
      available: () => !!container(),
      tick: attach,
      getWpm: () => {
        if (buffer.length < 3) return null;
        const totalWords = buffer.reduce((s, b) => s + b.words, 0);
        if (totalWords < Core.MIN_WORDS_FOR_CONFIDENCE) return null;
        const spanMs = buffer[buffer.length - 1].t - buffer[0].t;
        if (spanMs < 5000) return null;
        return totalWords / (spanMs / 60000);
      },
    };
  }

  let captionTracker = null;

  function findVideo() {
    return document.querySelector('video.html5-main-video') || document.querySelector('video');
  }

  function videoKeyFromUrl() {
    const params = new URLSearchParams(location.search);
    return params.get('v') || location.pathname;
  }

  function update() {
    rafId = requestAnimationFrame(update);
    if (!widgetEl) return;

    if (!video || !video.isConnected) {
      video = findVideo();
      lastTime = video ? video.currentTime : 0;
      captionTracker = createYoutubeCaptionTracker();
    }
    if (!video) {
      widgetEl.style.display = 'none';
      return;
    }

    const result = Core.updateWidgetStats(widgetEl, video);
    if (!result) return;

    // Accumulate real time-saved for lifetime stats (ignore seeks/pauses).
    if (!video.paused && !video.seeking) {
      const delta = video.currentTime - lastTime;
      if (delta > 0 && delta < 2) {
        const saved = delta * (1 - 1 / result.speed);
        Core.StatsStore.addSavedSeconds(saved);
      }
    }
    lastTime = video.currentTime;

    const key = videoKeyFromUrl();
    if (key !== currentVideoKey && video.duration > 30) {
      currentVideoKey = key;
      Core.StatsStore.registerVideoIfNew(key);
    }

    // Caption-based speed suggestion (best-effort).
    if (captionTracker) {
      captionTracker.tick();
      if (captionTracker.available()) {
        const wpm = captionTracker.getWpm();
        const suggested = Core.suggestSpeedFromWpm(wpm);
        if (wpm && suggested) {
          Core.showSuggestion(widgetEl, { wpm, suggestedSpeed: suggested, currentSpeed: result.speed }, (s) => {
            video.playbackRate = s;
          });
        } else {
          Core.hideSuggestion(widgetEl);
        }
      } else {
        Core.hideSuggestion(widgetEl);
      }
    }
  }

  function init() {
    if (widgetEl) return;
    widgetEl = Core.buildWidget({ mascotUrl: MASCOT_URL });
    lastTime = 0;
    update();
    statsInterval = setInterval(() => Core.StatsStore.flush(), 5000);
  }

  function teardown() {
    if (rafId) cancelAnimationFrame(rafId);
    if (statsInterval) clearInterval(statsInterval);
    Core.StatsStore.flush();
    rafId = null;
    statsInterval = null;
    if (widgetEl) {
      widgetEl.remove();
      widgetEl = null;
    }
    video = null;
    captionTracker = null;
    currentVideoKey = null;
  }

  function isWatchPage() {
    return location.pathname === '/watch';
  }

  function handleNav() {
    if (isWatchPage()) init();
    else teardown();
  }

  document.addEventListener('yt-navigate-finish', handleNav);
  window.addEventListener('load', handleNav);
  handleNav();

  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      handleNav();
    }
  }, 1000);
})();
