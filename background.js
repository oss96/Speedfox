// SpeedFox — background owner of lifetime stats and optional site access
const STATS_KEY = 'speedsaver_stats';
const MAX_DAILY_DAYS = 30;
const MAX_TRACKED_KEYS = 500;
const GENERIC_SCRIPT_ID = 'speedfox-generic';
const OTHER_SITES = { origins: ['*://*/*'] };
const YOUTUBE_MATCHES = ['*://www.youtube.com/*', '*://m.youtube.com/*'];

function emptyStats() {
  return { totalSecondsSaved: 0, videosTracked: 0, daily: {}, trackedKeys: [] };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

let statsQueue = Promise.resolve();

/** Applies mutate to the stored stats, one update at a time across all tabs. */
function updateStats(mutate) {
  const run = statsQueue.then(async () => {
    const res = await chrome.storage.local.get(STATS_KEY);
    const stats = res[STATS_KEY] || emptyStats();
    mutate(stats);
    await chrome.storage.local.set({ [STATS_KEY]: stats });
  });
  statsQueue = run.catch((err) => console.error('SpeedFox stats update failed', err));
  return run;
}

function addSavedSeconds(stats, seconds) {
  stats.totalSecondsSaved = (stats.totalSecondsSaved || 0) + seconds;
  stats.daily = stats.daily || {};
  const key = todayKey();
  stats.daily[key] = (stats.daily[key] || 0) + seconds;
  const days = Object.keys(stats.daily).sort();
  while (days.length > MAX_DAILY_DAYS) {
    delete stats.daily[days.shift()];
  }
}

function registerVideo(stats, videoKey) {
  stats.trackedKeys = stats.trackedKeys || [];
  if (stats.trackedKeys.includes(videoKey)) return;
  stats.trackedKeys.push(videoKey);
  while (stats.trackedKeys.length > MAX_TRACKED_KEYS) stats.trackedKeys.shift();
  stats.videosTracked = (stats.videosTracked || 0) + 1;
}

function resetStats(stats) {
  Object.assign(stats, emptyStats());
}

function mutationFor(message) {
  switch (message?.type) {
    case 'addSavedSeconds':
      if (!(message.seconds > 0) || !isFinite(message.seconds)) return null;
      return (stats) => addSavedSeconds(stats, message.seconds);
    case 'registerVideo':
      if (typeof message.videoKey !== 'string' || !message.videoKey) return null;
      return (stats) => registerVideo(stats, message.videoKey);
    case 'resetStats':
      return resetStats;
    default:
      return null;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const mutate = mutationFor(message);
  if (!mutate) return false;
  updateStats(mutate).then(
    () => sendResponse({ ok: true }),
    () => sendResponse({ ok: false }),
  );
  return true;
});

/** Registers the generic-site driver only while the user has granted access to other sites. */
async function syncGenericScript() {
  const granted = await chrome.permissions.contains(OTHER_SITES);
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [GENERIC_SCRIPT_ID] });
  if (granted && !registered.length) {
    await chrome.scripting.registerContentScripts([{
      id: GENERIC_SCRIPT_ID,
      matches: OTHER_SITES.origins,
      excludeMatches: YOUTUBE_MATCHES,
      js: ['lib/widget-core.js', 'generic.js'],
      css: ['content.css'],
      runAt: 'document_idle',
    }]);
  } else if (!granted && registered.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [GENERIC_SCRIPT_ID] });
  }
}

let syncQueue = Promise.resolve();

function queueGenericScriptSync() {
  syncQueue = syncQueue
    .then(syncGenericScript)
    .catch((err) => console.error('SpeedFox site access sync failed', err));
}

chrome.runtime.onInstalled.addListener(queueGenericScriptSync);
chrome.runtime.onStartup.addListener(queueGenericScriptSync);
chrome.permissions.onAdded.addListener(queueGenericScriptSync);
chrome.permissions.onRemoved.addListener(queueGenericScriptSync);
