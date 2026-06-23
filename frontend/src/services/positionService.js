import api from './api';

export async function listPositions() {
  const response = await api.get('/positions/');
  return response.data;
}

export async function createPosition(payload) {
  const response = await api.post('/positions/', payload);
  return response.data;
}
