import api from './api';

export async function listBranches(companyId) {
  const { data } = await api.get(`/companies/${companyId}/branches`);
  return data;
}

export async function createBranch(companyId, payload) {
  const { data } = await api.post(`/companies/${companyId}/branches`, payload);
  return data;
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

export async function joinCompany(payload) {
  const response = await api.post('/companies/join', payload);
  return response.data;
}

const USER_DIRECTORY_KEY = 'shiftplanner_mock_user_directory';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function getMockUserDirectory() {
  return readJson(USER_DIRECTORY_KEY, {});
}

export async function linkUserToCompany(companyId, payload) {
  const { user_id, branch_id, position_id } = payload;

  if (!user_id) {
    throw new Error('User ID is required');
  }

  // Реальный API запрос (когда бэкенд готов)
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const token = localStorage.getItem('shiftplanner_token');

  try {
    const response = await fetch(`${baseUrl}/companies/${companyId}/link-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || 'Failed to link user');
    }

    return await response.json();
  } catch (error) {
    // Если API недоступен — используем мок
    console.warn('API unavailable, using mock linkUserToCompany', error);

    const directory = getMockUserDirectory();
    const entry = directory[String(user_id)] || {};

    directory[String(user_id)] = {
      ...entry,
      company_id: companyId,
      branch_id: branch_id || entry.branch_id,
      position_id: position_id || entry.position_id,
      linked_at: new Date().toISOString(),
    };

    writeJson(USER_DIRECTORY_KEY, directory);

    return {
      success: true,
      user_id: user_id,
      company_id: companyId,
      branch_id: branch_id || entry.branch_id,
      position_id: position_id || entry.position_id,
      _mock: true,
    };
  }
}

export async function getMockLinkedEmployees(companyId) {
  const directory = getMockUserDirectory();
  const result = [];

  Object.entries(directory).forEach(([userId, data]) => {
    if (String(data.company_id) === String(companyId)) {
      result.push({
        user_id: userId,
        ...data,
      });
    }
  });

  return result;
}
