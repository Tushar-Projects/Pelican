import apiClient from './client.js';

export function toLocalStartOfDayIso(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    const date = new Date(y, m - 1, d, 0, 0, 0, 0);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return dateStr;
}

export function toLocalEndOfDayIso(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    const date = new Date(y, m - 1, d, 23, 59, 59, 999);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return dateStr;
}

export async function recordTransfer(transferData) {
  const response = await apiClient.post('/transfers', transferData);
  return response.data.transfer;
}

export async function getTransfers(params = {}) {
  const queryParams = { ...params };
  if (queryParams.from) {
    queryParams.from = toLocalStartOfDayIso(queryParams.from);
  }
  if (queryParams.to) {
    queryParams.to = toLocalEndOfDayIso(queryParams.to);
  }
  const response = await apiClient.get('/transfers', { params: queryParams });
  return response.data; // { items, total, page }
}

export async function deleteTransfer(id) {
  await apiClient.delete(`/transfers/${id}`);
}

export async function clearAllTransfers() {
  await apiClient.delete('/transfers');
}
