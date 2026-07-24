const STATS_KEY = 'speedsaver_stats';

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

chrome.storage.local.get([STATS_KEY], (res) => {
  render(res[STATS_KEY] || { totalSecondsSaved: 0, videosTracked: 0, daily: {} });
});

document.getElementById('resetBtn').addEventListener('click', () => {
  chrome.storage.local.set({ [STATS_KEY]: { totalSecondsSaved: 0, videosTracked: 0, daily: {}, trackedKeys: [] } }, () => {
    render({ totalSecondsSaved: 0, videosTracked: 0, daily: {} });
  });
});
