import api from './client.js';

export function loadExcel(file) {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/jobs/load-excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function dryRun(channelId, items) {
  return api.post('/jobs/dry-run', { channelId, items });
}

export function startUpdate(sessionId) {
  return api.post('/jobs/start', { sessionId });
}

export function processNow(channelId) {
  return api.post('/jobs/process-now', { channelId });
}

export function fetchSummary(channelId) {
  const params = channelId ? { channelId } : {};
  return api.get('/jobs/summary', { params });
}

export function fetchLogs(params) {
  return api.get('/jobs/logs', { params });
}

export function downloadCsv(status, channelId) {
  const search = new URLSearchParams();
  if (status) search.set('status', status);
  if (channelId) search.set('channelId', channelId);
  const qs = search.toString();
  const url = `${api.defaults.baseURL}/jobs/report.csv${qs ? `?${qs}` : ''}`;
  window.open(url, '_blank');
}

export function downloadDryRunCsv(sessionId, action) {
  if (!sessionId) return;
  const params = action ? `?action=${encodeURIComponent(action)}` : '';
  const url = `${api.defaults.baseURL}/jobs/dry-run/${encodeURIComponent(
    sessionId
  )}/report.csv${params}`;
  window.open(url, '_blank');
}

