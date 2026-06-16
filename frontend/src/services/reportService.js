import api from './api';

export async function getEmployeeReports(params = {}) {
  const response = await api.get('/reports/employees', { params });
  return response.data;
}

export async function getMyReport(params = {}) {
  const response = await api.get('/reports/me', { params });
  return response.data;
}
