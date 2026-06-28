import api from './api';

export function formatLocalDate(value) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return String(value || '').slice(0, 10);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const FOUR_WEEK_DAYS = 28;

/** Four weeks (28 days) forward from the given start date. */
export function getFourWeekPeriodRange(startDateStr) {
  const anchor = startDateStr || formatLocalDate(new Date());
  const start = new Date(`${anchor}T12:00:00`);
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start);
  end.setDate(start.getDate() + FOUR_WEEK_DAYS - 1);

  return {
    start_date: formatLocalDate(start),
    end_date: formatLocalDate(end),
  };
}

export function deriveSchedulePeriod(schedule, periodForm = {}) {
  const shiftDates = (schedule?.shifts || [])
    .map((shift) => String(shift.date || '').slice(0, 10))
    .filter(Boolean);
  const unfilledDates = (schedule?.unfilled_requirements || [])
    .map((item) => String(item.date || '').slice(0, 10))
    .filter(Boolean);
  const allDates = [...shiftDates, ...unfilledDates].sort();

  if (allDates.length > 0) {
    return {
      start_date: allDates[0],
      end_date: allDates[allDates.length - 1],
    };
  }

  return {
    start_date: periodForm.start_date,
    end_date: periodForm.end_date,
  };
}

/** Split a date range into Mon–Sun week chunks (partial weeks at the edges are allowed). */
export function splitPeriodIntoWeeks(startDateStr, endDateStr) {
  const start = new Date(`${startDateStr}T12:00:00`);
  const end = new Date(`${endDateStr}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const weeks = [];
  let cursor = new Date(start);

  while (cursor <= end) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    const daysUntilSunday = cursor.getDay() === 0 ? 0 : (7 - cursor.getDay());
    weekEnd.setDate(cursor.getDate() + daysUntilSunday);
    if (weekEnd > end) {
      weekEnd.setTime(end.getTime());
    }

    weeks.push({
      start_date: formatLocalDate(weekStart),
      end_date: formatLocalDate(weekEnd),
    });

    cursor = new Date(weekEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  return weeks;
}

function mergeGeneratedSchedules(existing, next, fullPeriod) {
  if (!existing) {
    return {
      ...next,
      start_date: fullPeriod.start_date,
      end_date: fullPeriod.end_date,
      scheduleIds: next.id ? [next.id] : [],
      shifts: [...(next.shifts || [])],
      unfilled_requirements: [...(next.unfilled_requirements || [])],
      conflicts: [...(next.conflicts || [])],
    };
  }

  return {
    ...next,
    start_date: fullPeriod.start_date,
    end_date: fullPeriod.end_date,
    scheduleIds: [...(existing.scheduleIds || []), ...(next.id ? [next.id] : [])],
    shifts: [...(existing.shifts || []), ...(next.shifts || [])],
    unfilled_requirements: [
      ...(existing.unfilled_requirements || []),
      ...(next.unfilled_requirements || []),
    ],
    conflicts: [...(existing.conflicts || []), ...(next.conflicts || [])],
  };
}

export function resolveScheduleIds(schedule) {
  if (Array.isArray(schedule?.scheduleIds) && schedule.scheduleIds.length > 0) {
    return schedule.scheduleIds;
  }
  if (schedule?.id) {
    return [schedule.id];
  }
  return [];
}

const MERGED_SCHEDULE_STORAGE_KEYS = {
  draft: 'shiftplanner_merged_draft_v2',
  published: 'shiftplanner_merged_published_v2',
};

export function mergeScheduleReads(schedules, meta = {}) {
  const items = (schedules || []).filter(Boolean);
  if (!items.length) {
    return null;
  }

  const last = items[items.length - 1];
  const scheduleIds = meta.scheduleIds || items.map((item) => item.id).filter(Boolean);

  return {
    ...last,
    id: last.id,
    status: meta.status || last.status,
    scheduleIds,
    start_date: meta.start_date,
    end_date: meta.end_date,
    shifts: items.flatMap((item) => item.shifts || []),
    unfilled_requirements: items.flatMap((item) => item.unfilled_requirements || []),
    conflicts: items.flatMap((item) => item.conflicts || []),
  };
}

export function persistMergedScheduleBundle(kind, schedule) {
  const scheduleIds = resolveScheduleIds(schedule);
  if (!scheduleIds.length) {
    return;
  }

  localStorage.setItem(MERGED_SCHEDULE_STORAGE_KEYS[kind], JSON.stringify({
    scheduleIds,
  }));
}

export function clearMergedScheduleBundle(kind) {
  localStorage.removeItem(MERGED_SCHEDULE_STORAGE_KEYS[kind]);
}

export async function loadMergedScheduleBundle(kind) {
  const raw = localStorage.getItem(MERGED_SCHEDULE_STORAGE_KEYS[kind]);
  if (!raw) {
    return null;
  }

  try {
    const stored = JSON.parse(raw);
    const scheduleIds = Array.isArray(stored?.scheduleIds) ? stored.scheduleIds : [];
    if (!scheduleIds.length) {
      return null;
    }

    const responses = await Promise.all(
      scheduleIds.map((id) => getSchedule(id).catch(() => null)),
    );
    const schedules = responses.filter(Boolean);
    if (!schedules.length) {
      return null;
    }

    return mergeScheduleReads(schedules, {
      status: kind,
      scheduleIds,
    });
  } catch {
    return null;
  }
}

async function fetchScheduleByStatusSafe(status) {
  try {
    return await getLatestSchedule(status);
  } catch (error) {
    if (error?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

function normalizeScheduleBundle(schedule) {
  if (!schedule) {
    return null;
  }

  return {
    ...schedule,
    scheduleIds: resolveScheduleIds(schedule),
  };
}

/** Load draft/published, merging multi-week bundles stored locally or fetched by id. */
export async function fetchScheduleVersions() {
  const [storedDraft, storedPublished, latestDraft, latestPublished] = await Promise.all([
    loadMergedScheduleBundle('draft'),
    loadMergedScheduleBundle('published'),
    fetchScheduleByStatusSafe('draft'),
    fetchScheduleByStatusSafe('published'),
  ]);

  return {
    draft: storedDraft || normalizeScheduleBundle(latestDraft),
    published: storedPublished || normalizeScheduleBundle(latestPublished),
  };
}

/** Generate schedule week-by-week when the period is longer than one solver week. */
export async function generateScheduleForPeriod(period) {
  const weeks = splitPeriodIntoWeeks(period.start_date, period.end_date);
  if (weeks.length <= 1) {
    const response = await api.post('/schedule/generate', period);
    return {
      ...response.data,
      start_date: period.start_date,
      end_date: period.end_date,
      scheduleIds: response.data?.id ? [response.data.id] : [],
    };
  }

  let merged = null;
  for (const week of weeks) {
    const response = await api.post('/schedule/generate', week);
    merged = mergeGeneratedSchedules(merged, response.data, period);
  }

  return merged;
}

/** Solver-friendly default: next Mon–Sun week (matches recurring staffing/availability templates). */
export function defaultSchedulePeriod() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const day = today.getDay();

  const start = new Date(today);
  if (day === 0) {
    start.setDate(today.getDate() + 1);
  } else if (day !== 1) {
    start.setDate(today.getDate() + (8 - day));
  }

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start_date: formatLocalDate(start),
    end_date: formatLocalDate(end),
  };
}

export function defaultCalendarMonthPeriod(anchorDateStr) {
  return getFourWeekPeriodRange(anchorDateStr || formatLocalDate(new Date())) || defaultSchedulePeriod();
}

/**
 * Publish may return an empty shift list while status changes to "published"
 * (legacy read path on backend). Keep the draft shifts on screen for the manager.
 */
export function mergePublishedSchedule(previous, published) {
  if (!published) {
    return previous;
  }

  return {
    ...previous,
    ...published,
    status: published.status || 'published',
    scheduleIds: published.scheduleIds ?? previous?.scheduleIds ?? resolveScheduleIds(previous),
    start_date: published.start_date ?? previous?.start_date,
    end_date: published.end_date ?? previous?.end_date,
    shifts: published.shifts?.length ? published.shifts : (previous?.shifts || []),
    unfilled_requirements: published.unfilled_requirements ?? previous?.unfilled_requirements ?? [],
    conflicts: published.conflicts ?? previous?.conflicts ?? [],
  };
}

/** Publish one schedule or every weekly draft that makes up a merged period. */
export async function publishScheduleForPeriod(schedule) {
  const ids = resolveScheduleIds(schedule);
  if (!ids.length) {
    throw new Error('No schedule id to publish.');
  }

  const publishedItems = [];
  for (const id of ids) {
    const response = await api.post(`/schedule/${id}/publish`);
    publishedItems.push(response.data);
  }

  const mergedPublished = mergeScheduleReads(publishedItems, {
    status: 'published',
    scheduleIds: ids,
    start_date: schedule.start_date,
    end_date: schedule.end_date,
  });

  return mergePublishedSchedule(schedule, {
    ...mergedPublished,
    shifts: schedule.shifts?.length ? schedule.shifts : (mergedPublished?.shifts || []),
    unfilled_requirements: schedule.unfilled_requirements ?? mergedPublished?.unfilled_requirements ?? [],
    conflicts: schedule.conflicts ?? mergedPublished?.conflicts ?? [],
  });
}

/** Delete one schedule or every weekly schedule in a merged period. */
export async function deleteScheduleForPeriod(schedule) {
  const ids = resolveScheduleIds(schedule);
  await Promise.all(ids.map((id) => api.delete(`/schedule/${id}`)));
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

export async function getLatestSchedule(status) {
  const params = status ? { status } : undefined;
  const response = await api.get('/schedule/latest', { params });
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

export async function deleteShift(scheduleId, shiftId) {
  await api.delete(`/schedule/${scheduleId}/shifts/${shiftId}`);
}

export async function createManualShift(scheduleId, payload) {
  const response = await api.post(`/schedule/${scheduleId}/shifts`, payload);
  return response.data;
}

export async function listAvailableEmployees(scheduleId, params) {
  const response = await api.get(`/schedule/${scheduleId}/employees/available`, { params });
  return response.data;
}

export async function assignRequirement(scheduleId, requirementId, payload) {
  const response = await api.post(
    `/schedule/${scheduleId}/requirements/${requirementId}/assign`,
    payload,
  );
  return response.data;
}

export async function updateScheduleRequirement(scheduleId, requirementId, payload) {
  const response = await api.patch(
    `/schedule/${scheduleId}/requirements/${requirementId}`,
    payload,
  );
  return response.data;
}

export async function deleteRequirement(requirementId) {
  await api.delete(`/schedule/requirements/${requirementId}`);
}

export async function publishSchedule(scheduleId) {
  const response = await api.post(`/schedule/${scheduleId}/publish`);
  return response.data;
}

export async function deleteSchedule(scheduleId) {
  const response = await api.delete(`/schedule/${scheduleId}`);
  return response.data;
}

export async function listExchangeRequests() {
  const response = await api.get('/schedule/exchange-requests');
  return response.data;
}

export async function updateExchangeRequest(exchangeRequestId, payload) {
  const response = await api.patch(`/schedule/exchange-requests/${exchangeRequestId}`, payload);
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
