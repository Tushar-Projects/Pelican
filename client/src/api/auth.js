import apiClient from './client.js';

export async function register({ name, email, password }) {
  const response = await apiClient.post('/auth/register', { name, email, password });
  return response.data;
}

export async function login({ email, password }) {
  const response = await apiClient.post('/auth/login', { email, password });
  return response.data;
}

export async function getMe() {
  const response = await apiClient.get('/auth/me');
  return response.data.user;
}
