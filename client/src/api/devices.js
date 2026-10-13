import apiClient from './client.js';

export async function registerDevice({ name, deviceKey }) {
  const response = await apiClient.post('/devices', { name, deviceKey });
  return response.data.device;
}

export async function getDevices() {
  const response = await apiClient.get('/devices');
  return response.data; // [device]
}

export async function updateDevice(id, data) {
  const response = await apiClient.patch(`/devices/${id}`, data);
  return response.data.device;
}

export async function deleteDevice(id) {
  await apiClient.delete(`/devices/${id}`);
}
