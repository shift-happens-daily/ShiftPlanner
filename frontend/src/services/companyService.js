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
  const response = await api.get(`/companies/invite/${encodeURIComponent(inviteCode.trim())}`);
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

export async function joinCompanyAsManager(payload) {
  const response = await api.post('/companies/join-as-manager', payload);
  return response.data;
}

export async function listManagerRequests() {
  const response = await api.get('/companies/me/manager-requests');
  return response.data;
}

export async function acceptManagerRequest(requestId) {
  const response = await api.post(`/companies/me/manager-requests/${requestId}/accept`);
  return response.data;
}

export async function declineManagerRequest(requestId) {
  const response = await api.post(`/companies/me/manager-requests/${requestId}/decline`);
  return response.data;
}

export async function listEmployeeRequests() {
  const response = await api.get('/companies/me/employee-requests');
  return response.data;
}

export async function acceptEmployeeRequest(requestId, payload = {}) {
  const response = await api.post(`/companies/me/employee-requests/${requestId}/accept`, payload);
  return response.data;
}

export async function declineEmployeeRequest(requestId) {
  const response = await api.post(`/companies/me/employee-requests/${requestId}/decline`);
  return response.data;
}

export async function linkUserToCompany(payload) {
  const response = await api.post('/companies/me/link-user', payload);
  return response.data;
}
