export const SLOT_MINUTES = 30;
export const MIN_SLOT = 0;
export const MAX_SLOT = 44;
export const DEFAULT_START_SLOT = 16; // 08:00
export const DEFAULT_END_SLOT = 36; // 18:00

export const WORKING_HOURS_STORAGE_PREFIX = 'shiftplanner_working_hours_v1';

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

function storageKey(companyId, branchId) {
  return `${WORKING_HOURS_STORAGE_PREFIX}_${companyId}_${branchId}`;
}

export function readWorkingHoursStore(companyId, branchId) {
  if (!companyId || !branchId) {
    return {};
  }

  try {
    const raw = localStorage.getItem(storageKey(companyId, branchId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    return Object.entries(parsed).reduce((result, [weekday, hours]) => {
      result[weekday] = normalizeDayWorkingHours(hours);
      return result;
    }, {});
  } catch {
    return {};
  }
}

export function writeWorkingHoursStore(companyId, branchId, store) {
  if (!companyId || !branchId) return;
  localStorage.setItem(storageKey(companyId, branchId), JSON.stringify(store));
}

export function getWorkingHoursForWeekday(companyId, branchId, weekday) {
  const store = readWorkingHoursStore(companyId, branchId);
  const saved = store[String(weekday)];
  return saved ? normalizeDayWorkingHours(saved) : defaultDayWorkingHours();
}

export function updateWorkingHoursForWeekday(companyId, branchId, weekday, startSlot, endSlot) {
  const store = readWorkingHoursStore(companyId, branchId);
  store[String(weekday)] = normalizeDayWorkingHours({ startSlot, endSlot });
  writeWorkingHoursStore(companyId, branchId, store);
  return store[String(weekday)];
}

export function getWorkingHoursForWeekdays(companyId, branchId, weekdays = []) {
  const uniqueWeekdays = [...new Set(weekdays.filter((day) => day >= 0 && day <= 6))];
  if (uniqueWeekdays.length === 0) {
    return defaultDayWorkingHours();
  }

  const ranges = uniqueWeekdays.map((weekday) => getWorkingHoursForWeekday(companyId, branchId, weekday));
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

export function inferWorkingHoursStore(requirements = [], branchId = null) {
  const store = {};

  requirements.forEach((requirement) => {
    if (branchId && String(requirement.branch_id) !== String(branchId)) {
      return;
    }

    const weekday = dateKeyToWeekday(requirement.date);
    const startSlot = timeToSlot(requirement.start_time || requirement.startTime);
    const endSlot = timeToSlot(requirement.end_time || requirement.endTime);
    const key = String(weekday);
    const current = store[key];

    if (!current) {
      store[key] = { startSlot, endSlot };
      return;
    }

    store[key] = {
      startSlot: Math.min(current.startSlot, startSlot),
      endSlot: Math.max(current.endSlot, endSlot),
    };
  });

  return Object.entries(store).reduce((result, [weekday, hours]) => {
    result[weekday] = normalizeDayWorkingHours(hours);
    return result;
  }, {});
}

export function mergeWorkingHoursStore(existingStore, inferredStore) {
  const merged = { ...existingStore };
  Object.entries(inferredStore || {}).forEach(([weekday, hours]) => {
    if (!merged[weekday]) {
      merged[weekday] = normalizeDayWorkingHours(hours);
    }
  });
  return merged;
}
