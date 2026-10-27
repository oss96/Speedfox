// SpeedSaver — generic driver (any site with an HTML5 <video>)
(function () {
  const Core = window.SpeedSaverCore;
  const MASCOT_URL = chrome.runtime.getURL('assets/fox.png');
  const MIN_DURATION_SECONDS = 45; // skip tiny ad/preview clips

  let widgetEl = null;
  let video = null;
  let rafId = null;
  let statsInterval = null;
  let accountant = null;
  let captionTracker = null;
  let currentVideoKey = null;

  function pickBestVideo() {
    const videos = Array.from(document.querySelectorAll('video'));
    // Prefer the largest, currently-playing (or longest) video on the page.
    const candidates = videos.filter((v) => isFinite(v.duration) && v.duration >= MIN_DURATION_SECONDS);
    if (!candidates.length) return null;
    candidates.sort((a, b) => {
      const areaA = a.clientWidth * a.clientHeight;
      const areaB = b.clientWidth * b.clientHeight;
      return areaB - areaA;
    });
    return candidates[0];
  }

  function keyForVideo(v) {
    return v.currentSrc || v.src || location.href;
  }

  function update() {
    rafId = requestAnimationFrame(update);
    if (!widgetEl) return;

    if (!video || !video.isConnected) {
      video = pickBestVideo();
      captionTracker?.destroy();
      captionTracker = video ? Core.createNativeCaptionRateTracker(video) : null;
    }
    if (accountant?.video !== video) {
      accountant?.destroy();
      accountant = video ? Core.createPlaybackAccountant(video) : null;
    }
    const status = Core.videoStatus(video);
    Core.updateWidget(widgetEl, status);
    if (!status) return;

    const key = keyForVideo(video);
    if (key !== currentVideoKey) {
      currentVideoKey = key;
      Core.StatsStore.registerVideoIfNew(key);
    }
  }

  function init() {
    if (widgetEl) return;
    widgetEl = Core.buildWidget({ mascotUrl: MASCOT_URL });
    update();
    statsInterval = setInterval(() => Core.StatsStore.flush(), 5000);
  }

  function teardown() {
    if (rafId) cancelAnimationFrame(rafId);
    if (statsInterval) clearInterval(statsInterval);
    accountant?.destroy();
    accountant = null;
    captionTracker?.destroy();
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

  Core.serveVideoStatus(() => ({ video, captionTracker }));

  // Watch for a qualifying video appearing/disappearing on the page.
  const observer = new MutationObserver(() => {
    const found = pickBestVideo();
    if (found && !widgetEl) init();
    if (!found && widgetEl && (!video || !video.isConnected)) teardown();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Initial check (in case video is already present at load).
  if (pickBestVideo()) init();
})();
