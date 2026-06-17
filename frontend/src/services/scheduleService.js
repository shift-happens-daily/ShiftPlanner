import api from './api';

export async function listRequirements(params = {}) {
  const response = await api.get('/schedule/requirements', { params });
  return response.data;
}

export async function createRequirement(payload) {
  const response = await api.post('/schedule/requirements', payload);
  return response.data;
}

export async function createBulkRequirements(payload) {
  const response = await api.post('/schedule/requirements/bulk', payload);
  return response.data;
}

export async function generateSchedule(payload) {
  const response = await api.post('/schedule/generate', payload);
  return response.data;
}

export async function getSchedule(scheduleId) {
  const response = await api.get(`/schedule/${scheduleId}`);
  return response.data;
}

export async function updateShift(scheduleId, shiftId, payload) {
  const response = await api.patch(`/schedule/${scheduleId}/shifts/${shiftId}`, payload);
  return response.data;
}

export async function publishSchedule(scheduleId) {
  const response = await api.post(`/schedule/${scheduleId}/publish`);
  return response.data;
}

export async function getMySchedule() {
  const response = await api.get('/schedule/my');
  return response.data;
}

export async function createExchangeRequest(payload) {
  const response = await api.post('/schedule/exchange-requests', payload);
  return response.data;
}
