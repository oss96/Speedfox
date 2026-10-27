// SpeedSaver — shared core (loaded before youtube.js / generic.js)
// Exposes window.SpeedSaverCore

(function () {
  const POS_KEY = 'speedsaver_widget_pos';
  const FLUSH_INTERVAL_MS = 5000;
  const SEEK_TOLERANCE_SECONDS = 1;

  function fmtClock(date) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function fmtDuration(totalSeconds) {
    totalSeconds = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function fmtHours(totalSeconds) {
    const hrs = totalSeconds / 3600;
    if (hrs >= 10) return `${Math.round(hrs)}`;
    return hrs.toFixed(1);
  }

  // ---------- Stats (owned by background.js, which serializes all tabs) ----------
  function sendToStatsOwner(message) {
    if (!chrome.runtime?.id) return;
    chrome.runtime.sendMessage(message).catch(() => {});
  }

  const StatsStore = {
    _buffer: 0,
    _lastFlush: Date.now(),

    addSavedSeconds(seconds) {
      if (!seconds || seconds <= 0 || !isFinite(seconds)) return;
      this._buffer += seconds;
      if (Date.now() - this._lastFlush > FLUSH_INTERVAL_MS) {
        this.flush();
      }
    },

    flush() {
      const amount = this._buffer;
      this._buffer = 0;
      this._lastFlush = Date.now();
      if (amount > 0) sendToStatsOwner({ type: 'addSavedSeconds', seconds: amount });
    },

    registerVideoIfNew(videoKey) {
      if (videoKey) sendToStatsOwner({ type: 'registerVideo', videoKey });
    },
  };

  window.addEventListener('pagehide', () => StatsStore.flush());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) StatsStore.flush();
  });

  /**
   * Credits time saved from the video's own playback events, so it keeps counting in hidden tabs.
   * Seeks reset the baseline instead of counting as playback.
   */
  function createPlaybackAccountant(video) {
    let lastMediaTime = video.currentTime;
    let lastWallTime = performance.now();
    let rate = video.playbackRate || 1;

    function resetBaseline() {
      lastMediaTime = video.currentTime;
      lastWallTime = performance.now();
    }

    function creditPlayback() {
      const now = performance.now();
      const mediaDelta = video.currentTime - lastMediaTime;
      const plausibleDelta = ((now - lastWallTime) / 1000) * rate + SEEK_TOLERANCE_SECONDS;
      if (!video.seeking && mediaDelta > 0 && mediaDelta <= plausibleDelta) {
        StatsStore.addSavedSeconds(mediaDelta * (1 - 1 / rate));
      }
      lastMediaTime = video.currentTime;
      lastWallTime = now;
    }

    function onRateChange() {
      creditPlayback();
      rate = video.playbackRate || 1;
    }

    const listeners = {
      timeupdate: creditPlayback,
      pause: creditPlayback,
      ended: creditPlayback,
      ratechange: onRateChange,
      play: resetBaseline,
      seeking: resetBaseline,
      seeked: resetBaseline,
      emptied: resetBaseline,
    };
    for (const [type, fn] of Object.entries(listeners)) video.addEventListener(type, fn);

    return {
      video,
      destroy() {
        creditPlayback();
        for (const [type, fn] of Object.entries(listeners)) video.removeEventListener(type, fn);
      },
    };
  }

  // ---------- Widget DOM ----------
  const BUNDLED_FONTS = [
    { family: 'Geist', file: 'fonts/geist-latin.woff2', weight: '400 700' },
  ];

  let bundledFontsAdded = false;

  /** Registers the widget fonts from the extension package instead of a font CDN. */
  function addBundledFonts() {
    if (bundledFontsAdded) return;
    bundledFontsAdded = true;
    for (const { family, file, weight } of BUNDLED_FONTS) {
      document.fonts.add(new FontFace(family, `url(${chrome.runtime.getURL(file)})`, { weight, display: 'swap' }));
    }
  }

  function fmtSpeed(speed) {
    return `${Math.round(speed * 100) / 100}×`;
  }

  /** Builds the small draggable speed pill; the toolbar popup shows the details. */
  function buildWidget({ mascotUrl } = {}) {
    addBundledFonts();
    const el = document.createElement('div');
    el.id = 'speedsaver-widget';
    el.title = 'SpeedFox: open the toolbar popup for details';
    el.innerHTML = `
      ${mascotUrl ? `<img class="ss-mascot" src="${mascotUrl}" alt="" />` : '<span class="ss-dot"></span>'}
      <span class="ss-speed-value">1×</span>
    `;
    document.body.appendChild(el);

    let dragState = null;
    el.addEventListener('mousedown', (e) => {
      const rect = el.getBoundingClientRect();
      dragState = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
      el.classList.add('ss-dragging');
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragState) return;
      el.style.left = `${Math.max(4, e.clientX - dragState.offsetX)}px`;
      el.style.top = `${Math.max(4, e.clientY - dragState.offsetY)}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    });
    window.addEventListener('mouseup', () => {
      if (!dragState) return;
      dragState = null;
      el.classList.remove('ss-dragging');
      const rect = el.getBoundingClientRect();
      chrome.storage?.local.set({ [POS_KEY]: { left: rect.left, top: rect.top } });
    });

    chrome.storage?.local.get([POS_KEY], (res) => {
      const pos = res[POS_KEY];
      if (pos && typeof pos.left === 'number') {
        el.style.left = `${pos.left}px`;
        el.style.top = `${pos.top}px`;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
      }
    });

    return el;
  }

  /** Playback figures for the video, or null while its duration is unknown. */
  function videoStatus(video) {
    if (!video || !isFinite(video.duration) || video.duration <= 0) return null;
    const speed = video.playbackRate || 1;
    const remainingContent = Math.max(0, video.duration - video.currentTime);
    const actualRemaining = remainingContent / speed;
    return {
      speed,
      remainingContent,
      actualRemaining,
      finishAt: Date.now() + actualRemaining * 1000,
      remainingSaved: remainingContent * (1 - 1 / speed),
      wholeVideoEstimate: video.duration * (1 - 1 / speed),
    };
  }

  function updateWidget(widgetEl, status) {
    if (!status) {
      widgetEl.style.display = 'none';
      return;
    }
    widgetEl.style.display = '';
    widgetEl.querySelector('.ss-speed-value').textContent = fmtSpeed(status.speed);
    widgetEl.classList.toggle('ss-saving', status.speed > 1);
  }

  /** Answers the toolbar popup's requests for the current video's status and speed changes. */
  function serveVideoStatus(getState) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const { video, captionTracker } = getState();
      if (message?.type === 'getVideoStatus') {
        const status = videoStatus(video);
        sendResponse(status && { ...status, suggestion: suggestionFor(captionTracker, status.speed) });
      } else if (message?.type === 'applySpeed' && video && message.speed >= 0.25 && message.speed <= 4) {
        video.playbackRate = message.speed;
        sendResponse({ ok: true });
      }
    });
  }

  // ---------- Caption-pace heuristic ----------
  // Target comfortable *listening* rate once sped up (typical fluent speech
  // is ~130-160 wpm; most people can comfortably follow spoken audio up to
  // ~260-300 effective wpm). We measure real (1x-equivalent) words-per-minute
  // from captions, then suggest a speed that lands near the target.
  const TARGET_EFFECTIVE_WPM = 260;
  const MIN_WORDS_FOR_CONFIDENCE = 40;

  function suggestSpeedFromWpm(measuredWpm) {
    if (!measuredWpm || measuredWpm <= 0) return null;
    let suggested = TARGET_EFFECTIVE_WPM / measuredWpm;
    suggested = Math.max(1, Math.min(3, suggested));
    // round to nearest 0.25
    suggested = Math.round(suggested / 0.25) * 0.25;
    return suggested;
  }

  function suggestionFor(captionTracker, currentSpeed) {
    if (!captionTracker?.available()) return null;
    const wpm = captionTracker.getWpm();
    const suggestedSpeed = suggestSpeedFromWpm(wpm);
    if (!wpm || !suggestedSpeed || Math.abs(suggestedSpeed - currentSpeed) < 0.2) return null;
    return { wpm, suggestedSpeed };
  }

  // Generic: uses the native HTML5 TextTrack API (works on sites that use
  // real <track> elements — Vimeo, many course platforms, plain <video>).
  function createNativeCaptionRateTracker(video) {
    let wordCount = 0;
    let spanSeconds = 0;
    let lastCueEnd = null;

    function findActiveTrack() {
      const tracks = video.textTracks;
      if (!tracks) return null;
      for (const t of tracks) {
        if (t.mode === 'showing' || t.mode === 'hidden') return t;
      }
      return null;
    }

    const track = findActiveTrack();

    function onCueChange() {
      const active = track.activeCues;
      if (!active || !active.length) return;
      for (const cue of active) {
        const words = (cue.text || '').trim().split(/\s+/).filter(Boolean).length;
        if (!words) continue;
        const dur = Math.max(0.3, cue.endTime - cue.startTime);
        wordCount += words;
        spanSeconds += dur;
      }
      // keep a rolling window of ~last 200 words worth of data
      if (wordCount > 400) {
        wordCount *= 0.5;
        spanSeconds *= 0.5;
      }
    }

    if (track) track.addEventListener('cuechange', onCueChange);

    return {
      available: () => !!track,
      getWpm: () => (spanSeconds > 5 && wordCount >= MIN_WORDS_FOR_CONFIDENCE ? (wordCount / spanSeconds) * 60 : null),
      destroy: () => { if (track) track.removeEventListener('cuechange', onCueChange); },
    };
  }

  window.SpeedSaverCore = {
    fmtClock, fmtDuration, fmtHours, fmtSpeed,
    StatsStore, createPlaybackAccountant,
    buildWidget, videoStatus, updateWidget, serveVideoStatus,
    suggestSpeedFromWpm, createNativeCaptionRateTracker,
    MIN_WORDS_FOR_CONFIDENCE,
  };
})();
