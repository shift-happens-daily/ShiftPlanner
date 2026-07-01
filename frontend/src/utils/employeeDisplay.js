// Safe display helpers for employee-related data.
// Keeps /employee page from crashing when API returns incomplete or new values.

export const DEFAULT_STATUS_STYLE = Object.freeze({
  color: '#4f646f',
  background: '#eef3f6',
  border: '1px solid #dbe6f0',
});

export const DEFAULT_POSITION_STYLE = Object.freeze({
  color: '#4f646f',
  background: '#ffffff',
  border: '1px dashed #dbe6f0',
});

export const DEFAULT_AVAILABILITY_STYLE = Object.freeze({
  background: '#eef3f6',
  border: 0,
  borderRight: '1px solid #dbe6f0',
  borderBottom: '1px solid #dbe6f0',
});

const AVAILABILITY_STATUSES = new Set(['available', 'if_needed', 'unavailable']);

/**
 * Normalize an availability status coming from the API or local state.
 * Supports legacy 'maybe' value and falls back to 'unavailable' for any
 * unknown, null or undefined status.
 */
export function normalizeAvailabilityStatus(status) {
  if (status === 'maybe') return 'if_needed';
  return AVAILABILITY_STATUSES.has(status) ? status : 'unavailable';
}

/**
 * Pick a style object for an availability status from a style map.
 * Always returns a safe object so JSX never crashes on `.border` / `.color`.
 */
export function getAvailabilityStyle(status, styleMap = {}, defaultStyle = DEFAULT_AVAILABILITY_STYLE) {
  const normalized = normalizeAvailabilityStatus(status);
  return styleMap?.[normalized] || defaultStyle;
}

import {
  getEmployeePositionLabel as resolveEmployeePositionLabel,
  resolvePositionTitle,
} from '../services/positionService';

/**
 * Human-readable position label with a guaranteed fallback.
 */
export function getPositionLabel(position, fallback = 'Без позиции') {
  return resolvePositionTitle(position, fallback);
}

export function getEmployeePositionLabel(employee, fallback = 'Без позиции') {
  return resolveEmployeePositionLabel(employee, fallback);
}

/**
 * Human-readable branch label with a guaranteed fallback.
 */
export function getBranchLabel(branchesLabel, fallback = 'Без филиала') {
  return branchesLabel || fallback;
}
