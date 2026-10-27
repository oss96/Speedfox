// SpeedFox — background owner of lifetime stats and optional site access
const STATS_KEY = 'speedsaver_stats';
const MAX_DAILY_DAYS = 30;
const MAX_TRACKED_KEYS = 500;
const GENERIC_SCRIPT_ID = 'speedfox-generic';
const OTHER_SITES = { origins: ['*://*/*'] };
const YOUTUBE_MATCHES = ['*://www.youtube.com/*', '*://m.youtube.com/*'];
const YOUTUBE_HOSTS = ['www.youtube.com', 'm.youtube.com'];
const GENERIC_JS = ['lib/widget-core.js', 'generic.js'];

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
      js: GENERIC_JS,
      css: ['content.css'],
      runAt: 'document_idle',
    }]);
  } else if (!granted && registered.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [GENERIC_SCRIPT_ID] });
  }
}

async function injectGenericDriver(tabId) {
  const target = { tabId };
  const [{ result: alreadyLoaded }] = await chrome.scripting.executeScript({ target, func: () => !!window.SpeedSaverCore });
  if (alreadyLoaded) return;
  await chrome.scripting.insertCSS({ target, files: ['content.css'] });
  await chrome.scripting.executeScript({ target, files: GENERIC_JS });
}

/** Starts the generic driver in tabs that were already open when access was granted. */
async function injectIntoOpenTabs() {
  if (!(await chrome.permissions.contains(OTHER_SITES))) return;
  const tabs = await chrome.tabs.query({ url: OTHER_SITES.origins });
  const otherSiteTabs = tabs.filter((tab) => !YOUTUBE_HOSTS.includes(new URL(tab.url).hostname));
  await Promise.allSettled(otherSiteTabs.map((tab) => injectGenericDriver(tab.id)));
}

let syncQueue = Promise.resolve();

function queueSiteAccessTask(task) {
  syncQueue = syncQueue
    .then(task)
    .catch((err) => console.error('SpeedFox site access sync failed', err));
}

chrome.runtime.onInstalled.addListener(() => queueSiteAccessTask(syncGenericScript));
chrome.runtime.onStartup.addListener(() => queueSiteAccessTask(syncGenericScript));
chrome.permissions.onAdded.addListener(() => {
  queueSiteAccessTask(syncGenericScript);
  queueSiteAccessTask(injectIntoOpenTabs);
});
chrome.permissions.onRemoved.addListener(() => queueSiteAccessTask(syncGenericScript));
