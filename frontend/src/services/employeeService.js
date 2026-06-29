import api from './api';

const DEMO_SEED_EMPLOYEE_EMAIL = /^employee\d+@example\.com$/i;

export function isDemoSeedEmployee(employee) {
  const email = String(employee?.email || '').trim();
  return DEMO_SEED_EMPLOYEE_EMAIL.test(email);
}

export function filterRealEmployees(employees) {
  return (employees || []).filter((employee) => !isDemoSeedEmployee(employee));
}

export async function listEmployees() {
  const response = await api.get('/employees/');
  return response.data;
}

export async function createEmployee(payload) {
  const response = await api.post('/employees/', payload);
  return response.data;
}

export async function updateEmployeePosition(employeeId, payload) {
  const response = await api.patch(`/employees/${employeeId}/position`, payload);
  return response.data;
}

export async function updateEmployeeBranch(employeeId, payload) {
  const response = await api.patch(`/employees/${employeeId}/branch`, payload);
  return response.data;
}

export async function getEmployeeBranches(employeeId) {
  const response = await api.get(`/employees/${employeeId}/branches`);
  return response.data;
}

export async function replaceEmployeeBranches(employeeId, payload) {
  const response = await api.put(`/employees/${employeeId}/branches`, payload);
  return response.data;
}

export async function deleteEmployee(employeeId) {
  const response = await api.delete(`/employees/${employeeId}`);
  return response.data;
}

export async function leaveCompany() {
  const response = await api.delete('/employees/me');
  return response.data;
}

export async function updateMyPosition(payload) {
  const response = await api.patch('/employees/me/position', payload);
  return response.data;
}

export async function getEmployeeAvailability(employeeId) {
  const response = await api.get(`/employees/${employeeId}/availability`);
  return response.data;
}

export async function updateEmployeeAvailability(employeeId, payload) {
  const response = await api.post(`/employees/${employeeId}/availability`, payload);
  return response.data;
}

export async function listEmployeeAbsences(employeeId, params = {}) {
  const response = await api.get(`/employees/${employeeId}/absences`, { params });
  return response.data;
}

export async function createEmployeeAbsence(employeeId, payload) {
  const response = await api.post(`/employees/${employeeId}/absences`, payload);
  return response.data;
}

export async function deleteEmployeeAbsence(employeeId, absenceId) {
  const response = await api.delete(`/employees/${employeeId}/absences/${absenceId}`);
  return response.data;
}

export async function getEmployeeCalendarSummary(employeeId, params = {}) {
  const response = await api.get(`/employees/${employeeId}/calendar-summary`, { params });
  return response.data;
}

export async function getMyAbsences(params = {}) {
  const response = await api.get('/employees/me/absences', { params });
  return response.data;
}

export async function createMyAbsence(payload) {
  const response = await api.post('/employees/me/absences', payload);
  return response.data;
}

export async function getMyCalendarSummary(params = {}) {
  const response = await api.get('/employees/me/calendar-summary', { params });
  return response.data;
}

export async function getMyEmployeeSchedule() {
  const response = await api.get('/employees/me/schedule');
  return response.data;
}
