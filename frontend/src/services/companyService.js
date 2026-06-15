import api from './api';

export async function listCompanies() {
  const response = await api.get('/companies/');
  return response.data;
}

export async function createCompany(payload) {
  const response = await api.post('/companies/', payload);
  return response.data;
}

export async function previewInviteCode(inviteCode) {
  const response = await api.get(`/companies/invite/${inviteCode}`);
  return response.data;
}

export async function joinCompany(payload) {
  const response = await api.post('/companies/join', payload);
  return response.data;
}
