import api from './api';

const POSITION_TITLE_OVERRIDES_KEY = 'shiftplanner_position_title_overrides';
export const POSITION_TITLES_CHANGED_EVENT = 'shiftplanner:position-titles-changed';

function notifyPositionTitlesChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(POSITION_TITLES_CHANGED_EVENT));
}

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
  notifyPositionTitlesChanged();
}

function clearLocalOverride(positionId) {
  const overrides = readOverrides();
  delete overrides[String(positionId)];
  writeOverrides(overrides);
  notifyPositionTitlesChanged();
}

export function getPositionTitleOverride(positionId) {
  if (positionId == null || positionId === '') return null;
  return readOverrides()[String(positionId)] || null;
}

function extractPositionId(source) {
  if (source == null || source === '') return null;
  if (typeof source === 'number') return source;
  if (typeof source === 'string' && /^\d+$/.test(source.trim())) return Number(source);
  return source.id
    ?? source.position_id
    ?? source.positionId
    ?? source.position?.id
    ?? null;
}

export function resolvePositionTitle(source, fallback = '') {
  if (source == null || source === '') return fallback;

  const positionId = extractPositionId(source);
  const override = getPositionTitleOverride(positionId);
  if (override) return override;

  if (typeof source === 'string') return source;

  const apiTitle = source.title
    || source.name
    || source.position_title
    || source.position_name
    || source.position?.title
    || source.position?.name
    || '';

  return apiTitle || fallback;
}

export function getEmployeePositionLabel(employee, fallback = '') {
  if (!employee) return fallback;

  return resolvePositionTitle({
    position_id: employee.position_id ?? employee.positionId,
    position_title: employee.position_title,
    title: employee.position?.title,
    name: employee.position?.name,
    position: employee.position,
  }, fallback);
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
