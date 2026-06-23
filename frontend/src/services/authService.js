import api, { TOKEN_STORAGE_KEY } from './api';

export async function loginRequest(email, password) {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
}

export async function registerRequest(payload) {
  const response = await api.post('/auth/register', payload);
  return response.data;
}

export async function getCurrentUserRequest() {
  const response = await api.get('/auth/me');
  return response.data;
}

export async function logoutRequest() {
  const response = await api.post('/auth/logout');
  return response.data;
}

export function persistToken(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function readStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}
