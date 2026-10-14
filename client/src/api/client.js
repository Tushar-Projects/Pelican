import axios from 'axios';

let API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
if (
  typeof window !== 'undefined' &&
  window.location &&
  API_BASE.includes('localhost') &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1'
) {
  API_BASE = `${window.location.protocol}//${window.location.hostname}:5000`;
}

export const apiClient = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Standardize error message from { error: "message" }
    const message =
      error.response?.data?.error ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
