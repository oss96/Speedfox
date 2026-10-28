const STATS_KEY = 'speedsaver_stats';
const OTHER_SITES = { origins: ['*://*/*'] };
const VIDEO_REFRESH_MS = 1000;
const Core = window.SpeedSaverCore;

function fmtHoursBig(totalSeconds) {
  const hrs = totalSeconds / 3600;
  if (hrs >= 10) return Math.round(hrs).toString();
  return (Math.round(hrs * 10) / 10).toString();
}

function fmtHoursSmall(totalSeconds) {
  const hrs = totalSeconds / 3600;
  if (hrs >= 1) return `${(Math.round(hrs * 10) / 10)}h`;
  return `${Math.round(totalSeconds / 60)}m`;
}

function lastNDaysTotal(daily, n) {
  const days = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() - 1);
  }
  return days.reduce((sum, key) => sum + (daily[key] || 0), 0);
}

function render(stats) {
  const total = stats.totalSecondsSaved || 0;
  const week = lastNDaysTotal(stats.daily || {}, 7);
  document.getElementById('totalHours').textContent = fmtHoursBig(total);
  document.getElementById('weekHours').textContent = fmtHoursSmall(week);
  document.getElementById('videoCount').textContent = stats.videosTracked || 0;
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) return null;
  return chrome.tabs.sendMessage(tab.id, message, { frameId: 0 }).catch(() => null);
}

function renderVideo(status) {
  document.getElementById('videoPanel').hidden = !status;
  document.getElementById('videoEmpty').hidden = !!status;
  if (!status) return;

  const changed = status.speed !== 1;
  setText('videoSpeed', Core.fmtSpeed(status.speed));
  setText('videoFinish', Core.fmtClock(new Date(status.finishAt)));
  setText('videoLeft', Core.fmtDuration(status.actualRemaining));
  setText('videoWas', changed ? `(was ${Core.fmtDuration(status.remainingContent)})` : '');
  setText('videoSaving', changed ? `${Core.fmtDuration(status.remainingSaved)} left to save` : 'Watching at 1×');
  setText('videoEstimate', changed ? `~${Core.fmtDuration(status.wholeVideoEstimate)} for the whole video at this speed` : '');

  const box = document.getElementById('videoSuggestion');
  const { suggestion } = status;
  box.hidden = !suggestion;
  if (!suggestion) return;
  const pace = suggestion.suggestedSpeed > status.speed ? 'slow-ish talker' : 'fast talker';
  setText('videoSuggestionText', `💡 Try ${Core.fmtSpeed(suggestion.suggestedSpeed)} — ${pace}, ~${Math.round(suggestion.wpm)} wpm`);
  document.getElementById('videoSuggestionApply').onclick = async () => {
    await sendToActiveTab({ type: 'applySpeed', speed: suggestion.suggestedSpeed });
    refreshVideo();
  };
}

async function refreshVideo() {
  renderVideo(await sendToActiveTab({ type: 'getVideoStatus' }));
}

refreshVideo();
setInterval(refreshVideo, VIDEO_REFRESH_MS);

function loadStats() {
  chrome.storage.local.get([STATS_KEY], (res) => {
    render(res[STATS_KEY] || { totalSecondsSaved: 0, videosTracked: 0, daily: {} });
  });
}

loadStats();

function localDateKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function downloadJson(filename, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.getElementById('exportBtn').addEventListener('click', () => {
  chrome.storage.local.get([STATS_KEY], (res) => {
    const now = new Date();
    downloadJson(`speedfox-stats-${localDateKey(now)}.json`, {
      exportedAt: now.toISOString(),
      stats: res[STATS_KEY] || { totalSecondsSaved: 0, videosTracked: 0, daily: {}, trackedKeys: [] },
    });
  });
});

document.getElementById('resetBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'resetStats' });
  loadStats();
});

const otherSitesToggle = document.getElementById('otherSitesToggle');

chrome.permissions.contains(OTHER_SITES).then((granted) => {
  otherSitesToggle.checked = granted;
});

otherSitesToggle.addEventListener('change', async () => {
  const granted = otherSitesToggle.checked
    ? await chrome.permissions.request(OTHER_SITES)
    : !(await chrome.permissions.remove(OTHER_SITES));
  otherSitesToggle.checked = granted;
});
