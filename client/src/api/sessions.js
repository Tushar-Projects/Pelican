import apiClient from './client.js';

export async function createSession() {
  const response = await apiClient.post('/sessions', {});
  return response.data; // { code, expiresAt, status }
}

export async function getSessions(status) {
  const params = status ? { status } : {};
  const response = await apiClient.get('/sessions', { params });
  return response.data; // [session]
}

export async function getSession(code) {
  const response = await apiClient.get(`/sessions/${code}`);
  return response.data; // { code, status, expiresAt }
}

export async function updateSession(code, data) {
  const response = await apiClient.patch(`/sessions/${code}`, data);
  return response.data.session;
}

export async function deleteSession(code) {
  await apiClient.delete(`/sessions/${code}`);
}
