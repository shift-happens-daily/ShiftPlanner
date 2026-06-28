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
  if (schedule?.start_date && schedule?.end_date) {
    return {
      start_date: schedule.start_date,
      end_date: schedule.end_date,
    };
  }

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

function buildScheduleQueryParams(period = null, status = null) {
  const params = {};
  if (period?.start_date) params.date_from = period.start_date;
  if (period?.end_date) params.date_to = period.end_date;
  if (status) params.status = status;
  return params;
}

function pickPrimarySchedule(schedules) {
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return null;
  }
  return [...schedules].sort((a, b) => b.id - a.id)[0];
}

/** Load draft/published schedules for the selected date range (one schedule per status). */
export async function fetchScheduleVersions(period = null) {
  const loadByStatus = async (status) => {
    try {
      const schedules = await listSchedules(buildScheduleQueryParams(period, status));
      return pickPrimarySchedule(schedules);
    } catch (error) {
      if (error?.response?.status === 404) {
        return null;
      }
      throw error;
    }
  };

  const [draft, published] = await Promise.all([
    loadByStatus('draft'),
    loadByStatus('published'),
  ]);

  return {
    draft,
    published: published ? mergePublishedSchedule(null, published) : null,
  };
}

/** Generate one schedule for the full selected period. */
export async function generateScheduleForPeriod(period) {
  const response = await api.post('/schedule/generate', period);
  return {
    ...response.data,
    start_date: response.data?.start_date || period.start_date,
    end_date: response.data?.end_date || period.end_date,
  };
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
 * Publish may return an empty shift list while status changes to "published".
 * Keep the draft shifts on screen for the manager.
 */
export function mergePublishedSchedule(previous, published) {
  if (!published) {
    return previous;
  }

  return {
    ...previous,
    ...published,
    status: published.status || 'published',
    start_date: published.start_date ?? previous?.start_date,
    end_date: published.end_date ?? previous?.end_date,
    shifts: published.shifts?.length ? published.shifts : (previous?.shifts || []),
    unfilled_requirements: published.unfilled_requirements ?? previous?.unfilled_requirements ?? [],
    conflicts: published.conflicts ?? previous?.conflicts ?? [],
  };
}

/** Publish the single schedule for the selected period. */
export async function publishScheduleForPeriod(schedule) {
  if (!schedule?.id) {
    throw new Error('No schedule id to publish.');
  }

  const response = await api.post(`/schedule/${schedule.id}/publish`);
  return mergePublishedSchedule(schedule, {
    ...response.data,
    start_date: response.data?.start_date ?? schedule.start_date,
    end_date: response.data?.end_date ?? schedule.end_date,
  });
}

/** Delete the single schedule for the selected period. */
export async function deleteScheduleForPeriod(schedule) {
  if (!schedule?.id) {
    throw new Error('No schedule id to delete.');
  }

  await api.delete(`/schedule/${schedule.id}`);
}

export async function listSchedules(params = {}) {
  const response = await api.get('/schedule', { params });
  return response.data;
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

export function buildEmployeeScheduleRange(viewMode = 'month') {
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  const end = new Date(start);

  if (viewMode === 'day') {
    end.setDate(end.getDate() + 13);
  } else if (viewMode === 'week') {
    end.setDate(end.getDate() + 41);
  } else {
    end.setDate(end.getDate() + 90);
  }

  return {
    date_from: formatLocalDate(start),
    date_to: formatLocalDate(end),
  };
}

/** Load employee shifts for a date range via GET /schedule/my. */
export async function getMySchedule(params = {}) {
  const query = {
    date_from: params.date_from || params.start_date || undefined,
    date_to: params.date_to || params.end_date || undefined,
  };

  Object.keys(query).forEach((key) => {
    if (query[key] === undefined) {
      delete query[key];
    }
  });

  const response = await api.get('/schedule/my', { params: query });
  return (response.data || []).map((shift) => ({
    ...shift,
    shift_id: shift.id,
    position_title: shift.position,
  }));
}

export async function createExchangeRequest(payload) {
  const response = await api.post('/schedule/exchange-requests', payload);
  return response.data;
}
