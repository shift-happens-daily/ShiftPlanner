import api from './api';

const POSITION_TITLE_OVERRIDES_KEY = 'shiftplanner_position_title_overrides';

function readOverrides() {
  try {
    const raw = localStorage.getItem(POSITION_TITLE_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeOverrides(overrides) {
  localStorage.setItem(POSITION_TITLE_OVERRIDES_KEY, JSON.stringify(overrides));
}

function saveLocalOverride(positionId, title) {
  const overrides = readOverrides();
  overrides[String(positionId)] = title;
  writeOverrides(overrides);
}

function clearLocalOverride(positionId) {
  const overrides = readOverrides();
  delete overrides[String(positionId)];
  writeOverrides(overrides);
}

export function applyPositionTitleOverrides(positions) {
  const overrides = readOverrides();

  return (positions || []).map((position) => {
    const override = overrides[String(position.id)];
    if (!override) return position;

    return {
      ...position,
      title: override,
      name: override,
    };
  });
}

export async function listPositions() {
  const response = await api.get('/positions/');
  return applyPositionTitleOverrides(response.data);
}

export async function createPosition(payload) {
  const response = await api.post('/positions/', payload);
  return response.data;
}

export async function updatePosition(positionId, payload) {
  const title = String(payload?.title || '').trim();
  if (!title) {
    throw new Error('Title required');
  }

  try {
    const response = await api.patch(`/positions/${positionId}`, { title });
    clearLocalOverride(positionId);
    return applyPositionTitleOverrides([response.data])[0];
  } catch (error) {
    const status = error?.response?.status;
    if (status === 404 || status === 405 || status === 501) {
      saveLocalOverride(positionId, title);
      return { id: Number(positionId), title };
    }
    throw error;
  }
}

export async function deletePosition(positionId) {
  await api.delete(`/positions/${positionId}`);
  clearLocalOverride(positionId);
}
