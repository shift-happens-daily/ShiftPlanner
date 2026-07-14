import {
  getBranchWorkingHours,
  updateBranchWorkingHours,
} from '../services/companyService';

export const SLOT_MINUTES = 30;
export const MIN_SLOT = 0;
export const MAX_SLOT = 44;
export const DEFAULT_START_SLOT = 16; // 08:00
export const DEFAULT_END_SLOT = 36; // 18:00

const cache = new Map();

function cacheKey(companyId, branchId) {
  return `${companyId}_${branchId}`;
}

export function slotToMinutes(slot) {
  return slot * SLOT_MINUTES;
}

export function slotToTimeString(slot) {
  const totalMinutes = slotToMinutes(slot);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

export function slotToDisplayTime(slot) {
  return slotToTimeString(slot).slice(0, 5);
}

export function timeToSlot(value) {
  const raw = String(value || '').slice(0, 5);
  const [hoursPart, minutesPart] = raw.split(':');
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return DEFAULT_START_SLOT;
  }
  return Math.floor((hours * 60 + minutes) / SLOT_MINUTES);
}

export function dateKeyToWeekday(dateKey) {
  if (!dateKey) return 0;
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 0;
  return (date.getDay() + 6) % 7;
}

export function normalizeDayWorkingHours(value) {
  const startSlot = Number(value?.startSlot ?? value?.start_slot ?? DEFAULT_START_SLOT);
  const endSlot = Number(value?.endSlot ?? value?.end_slot ?? DEFAULT_END_SLOT);
  const normalizedStart = Math.min(Math.max(startSlot, MIN_SLOT), MAX_SLOT - 1);
  const normalizedEnd = Math.min(Math.max(endSlot, normalizedStart + 1), MAX_SLOT);
  return { startSlot: normalizedStart, endSlot: normalizedEnd };
}

export function defaultDayWorkingHours() {
  return normalizeDayWorkingHours({
    startSlot: DEFAULT_START_SLOT,
    endSlot: DEFAULT_END_SLOT,
  });
}

export function isFactoryDefaultWorkingHours(value) {
  const startSlot = Number(value?.startSlot ?? value?.start_slot);
  const endSlot = Number(value?.endSlot ?? value?.end_slot);
  if (Number.isNaN(startSlot) || Number.isNaN(endSlot)) return true;
  return startSlot <= MIN_SLOT && endSlot >= MAX_SLOT;
}

export function parseWorkingHoursPayload(data) {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const source = data.root && typeof data.root === 'object' ? data.root : data;

  return Object.entries(source).reduce((result, [weekday, hours]) => {
    if (hours && typeof hours === 'object' && !isFactoryDefaultWorkingHours(hours)) {
      result[String(weekday)] = normalizeDayWorkingHours(hours);
    }
    return result;
  }, {});
}

export function toApiWorkingHoursPayload(store) {
  return Object.entries(store || {}).reduce((result, [weekday, hours]) => {
    const normalized = normalizeDayWorkingHours(hours);
    result[String(weekday)] = {
      start_slot: normalized.startSlot,
      end_slot: normalized.endSlot,
    };
    return result;
  }, {});
}

export function setWorkingHoursStoreFromApi(companyId, branchId, payload) {
  if (!companyId || !branchId) return {};
  const store = parseWorkingHoursPayload(payload);
  cache.set(cacheKey(companyId, branchId), store);
  return store;
}

export function getCachedWorkingHoursStore(companyId, branchId) {
  if (!companyId || !branchId) return {};
  return cache.get(cacheKey(companyId, branchId)) || {};
}

export async function fetchWorkingHoursStore(companyId, branchId) {
  if (!companyId || !branchId) {
    return {};
  }

  const data = await getBranchWorkingHours(companyId, branchId);
  return setWorkingHoursStoreFromApi(companyId, branchId, data);
}

export function getWorkingHoursForWeekday(companyId, branchId, weekday) {
  const store = getCachedWorkingHoursStore(companyId, branchId);
  const saved = store[String(weekday)];
  if (!saved) {
    return defaultDayWorkingHours();
  }
  return normalizeDayWorkingHours(saved);
}

export async function updateWorkingHoursForWeekday(companyId, branchId, weekday, startSlot, endSlot) {
  const key = cacheKey(companyId, branchId);
  let store = cache.get(key);
  if (!store || Object.keys(store).length === 0) {
    store = await fetchWorkingHoursStore(companyId, branchId);
  }

  const nextStore = {
    ...store,
    [String(weekday)]: normalizeDayWorkingHours({ startSlot, endSlot }),
  };

  const saved = await updateBranchWorkingHours(
    companyId,
    branchId,
    toApiWorkingHoursPayload(nextStore),
  );
  const parsed = setWorkingHoursStoreFromApi(companyId, branchId, saved);
  return parsed[String(weekday)];
}

export function getWorkingHoursForWeekdays(companyId, branchId, weekdays = []) {
  const uniqueWeekdays = [...new Set(weekdays.filter((day) => day >= 0 && day <= 6))];
  if (uniqueWeekdays.length === 0) {
    return defaultDayWorkingHours();
  }

  const ranges = uniqueWeekdays.map((weekday) =>
    getWorkingHoursForWeekday(companyId, branchId, weekday),
  );

  const startSlot = Math.max(...ranges.map((range) => range.startSlot));
  const endSlot = Math.min(...ranges.map((range) => range.endSlot));

  if (endSlot <= startSlot) {
    return null;
  }

  return normalizeDayWorkingHours({ startSlot, endSlot });
}

export function buildSlotOptions(startSlot, endSlot) {
  const options = [];
  for (let slot = startSlot; slot <= endSlot; slot += 1) {
    options.push({ slot, label: slotToDisplayTime(slot) });
  }
  return options;
}

export function getStartSlotOptions(workingHours) {
  const { startSlot, endSlot } = normalizeDayWorkingHours(workingHours);
  return buildSlotOptions(startSlot, Math.max(startSlot, endSlot - 1));
}

export function getEndSlotOptions(workingHours, selectedStartSlot) {
  const { startSlot, endSlot } = normalizeDayWorkingHours(workingHours);
  const minimumEndSlot = Math.max(startSlot + 1, selectedStartSlot + 1);
  if (minimumEndSlot > endSlot) {
    return [];
  }
  return buildSlotOptions(minimumEndSlot, endSlot);
}

export function clampRequirementTimes(startTime, endTime, workingHours) {
  const range = normalizeDayWorkingHours(workingHours);
  let startSlot = timeToSlot(startTime);
  let endSlot = timeToSlot(endTime);

  startSlot = Math.min(Math.max(startSlot, range.startSlot), range.endSlot - 1);
  endSlot = Math.min(Math.max(endSlot, startSlot + 1), range.endSlot);

  return {
    start_time: slotToTimeString(startSlot),
    end_time: slotToTimeString(endSlot),
  };
}

export function validateRequirementTimes(startTime, endTime, workingHours, messages = {}) {
  const range = normalizeDayWorkingHours(workingHours);
  const startSlot = timeToSlot(startTime);
  const endSlot = timeToSlot(endTime);

  if (startSlot < range.startSlot || endSlot > range.endSlot) {
    return messages.outsideWorkingHours
      || `Shift must be within working hours (${slotToDisplayTime(range.startSlot)}–${slotToDisplayTime(range.endSlot)}).`;
  }

  if (endSlot <= startSlot) {
    return messages.endBeforeStart || 'End time must be later than start time.';
  }

  return null;
}

export function formatWorkingHoursRange(workingHours) {
  const range = normalizeDayWorkingHours(workingHours);
  return `${slotToDisplayTime(range.startSlot)}–${slotToDisplayTime(range.endSlot)}`;
}
