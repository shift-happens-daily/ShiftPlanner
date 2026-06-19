import api from './api';

const MOCK = [
  {
    date: new Date().toISOString(),
    shifts: [
      {
        id: 's1',
        start_time: '09:00',
        end_time: '13:00',
        position_title: 'Cashier',
        candidate_employees: [
          { id: 'e1', full_name: 'Alice' },
          { id: 'e2', full_name: 'Bob' },
        ],
        assigned_employee_ids: ['e1'],
      },
      {
        id: 's2',
        start_time: '13:00',
        end_time: '18:00',
        position_title: 'Cook',
        candidate_employees: [
          { id: 'e3', full_name: 'Charlie' },
          { id: 'e4', full_name: 'Dana' },
        ],
        assigned_employee_ids: [],
      },
    ],
  },
  {
    date: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    shifts: [],
  },
];

export async function listGeneratedSchedules() {
  try {
    const { data } = await api.get('/schedules/generated');
    // expect data to be array of { date, shifts: [...] }
    if (!Array.isArray(data) || data.length === 0) return MOCK;
    return data;
  } catch (error) {
    // fallback to mock data
    return MOCK;
  }
}

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
