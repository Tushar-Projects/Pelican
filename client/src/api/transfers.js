import apiClient from './client.js';

export async function recordTransfer(transferData) {
  const response = await apiClient.post('/transfers', transferData);
  return response.data.transfer;
}

export async function getTransfers(params = {}) {
  const response = await apiClient.get('/transfers', { params });
  return response.data; // { items, total, page }
}

export async function deleteTransfer(id) {
  await apiClient.delete(`/transfers/${id}`);
}

export async function clearAllTransfers() {
  await apiClient.delete('/transfers');
}
