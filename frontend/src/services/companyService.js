import api from './api';

export async function listBranches(companyId) {
  const { data } = await api.get(`/companies/${companyId}/branches`);
  return data;
}

export async function createBranch(companyId, payload) {
  const { data } = await api.post(`/companies/${companyId}/branches`, payload);
  return data;
}

export async function deleteBranch(branchId) {
  await api.delete(`/companies/branches/${branchId}`);
}

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

export async function regenerateInviteCode() {
  const response = await api.post('/companies/me/invite-code/regenerate');
  return response.data;
}

export async function joinCompany(payload) {
  const response = await api.post('/companies/join', payload);
  return response.data;
}

export async function linkUserToCompany(payload) {
  const response = await api.post('/companies/me/link-user', payload);
  return response.data;
}
