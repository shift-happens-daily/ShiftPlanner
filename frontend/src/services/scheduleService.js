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

export function snapToMonday(dateStr) {
  const date = new Date(`${dateStr || formatLocalDate(new Date())}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return formatLocalDate(new Date());
  }
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return formatLocalDate(date);
}

export function isMonday(dateStr) {
  const date = new Date(`${dateStr}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.getDay() === 1;
}

export function getWeekPeriodRange(mondayStart, weeks = 1) {
  const start = snapToMonday(mondayStart);
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + weeks * 7 - 1);
  return {
    start_date: formatLocalDate(startDate),
    end_date: formatLocalDate(endDate),
    weeks,
  };
}

export function enumerateDates(startDate, endDate) {
  if (!startDate || !endDate) return [];

  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(formatLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function periodsOverlap(leftStart, leftEnd, rightStart, rightEnd) {
  return leftStart <= rightEnd && leftEnd >= rightStart;
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

function buildScheduleQueryParams(period = null, status = null, branchId = null) {
  const params = {};
  if (period?.start_date) params.date_from = period.start_date;
  if (period?.end_date) params.date_to = period.end_date;
  if (status) params.status = status;
  if (branchId) params.branch_id = branchId;
  return params;
}

function pickPrimarySchedule(schedules, branchId = null) {
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return null;
  }
  const filtered = branchId
    ? schedules.filter((schedule) => Number(schedule.branch_id) === Number(branchId))
    : schedules;
  const source = filtered.length > 0 ? filtered : schedules;
  return [...source].sort((a, b) => b.id - a.id)[0];
}

async function listSchedulesForBranch(status, branchId, period = null) {
  const scoped = await listSchedules(buildScheduleQueryParams(period, status, branchId));
  if (scoped.length > 0 || !branchId) {
    return scoped;
  }
  return listSchedules(buildScheduleQueryParams(null, status, branchId));
}

function withPeriod(schedule, period) {
  if (!schedule) return schedule;
  return {
    ...schedule,
    start_date: schedule.start_date || period?.start_date,
    end_date: schedule.end_date || period?.end_date,
  };
}

export async function listSchedules(params = {}) {
  const response = await api.get('/schedule', { params });
  return Array.isArray(response.data) ? response.data : [response.data].filter(Boolean);
}

export async function findOverlappingSchedules({ branch_id, start_date, end_date }) {
  const schedules = await listSchedules({
    branch_id,
    date_from: start_date,
    date_to: end_date,
  });

  return schedules.filter((schedule) => periodsOverlap(
    schedule.start_date,
    schedule.end_date,
    start_date,
    end_date,
  ));
}

export async function fetchScheduleCoverage({ branch_id, date_from, date_to }) {
  const schedules = await listSchedules({ branch_id, date_from, date_to });
  const byDate = {};

  schedules.forEach((schedule) => {
    enumerateDates(schedule.start_date, schedule.end_date).forEach((dateKey) => {
      byDate[dateKey] = {
        hasSchedule: true,
        status: schedule.status,
      };
    });
  });

  return byDate;
}

/** Load draft/published schedules for the selected branch and date range. */
export async function fetchScheduleVersions(period = null, branchId = null) {
  const loadByStatus = async (status) => {
    const schedules = await listSchedulesForBranch(status, branchId, period);
    const primary = pickPrimarySchedule(schedules, branchId);
    if (!primary?.id) {
      return null;
    }

    const response = await api.get(`/schedule/${primary.id}`);
    return withPeriod(response.data, period || {
      start_date: response.data.start_date,
      end_date: response.data.end_date,
    });
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

/** Generate schedule for a single branch and selected period. */
export async function generateScheduleForBranch(period, branchId) {
  const payload = {
    start_date: period.start_date,
    end_date: period.end_date,
    branch_id: branchId,
  };
  const response = await api.post('/schedule/generate', payload, {
    timeout: 120000,
  });
  return withPeriod(response.data, period);
}

/** True when generate may have succeeded on the server despite a client/network failure. */
export function isScheduleGenerateTransportError(error) {
  if (!error) return false;
  if (error.code === 'ECONNABORTED') return true;
  if (error.request && !error.response) return true;
  if (error.response?.status >= 500) return true;
  if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') return true;
  return false;
}

/** Backward-compatible wrapper for older callers. */
export async function generateScheduleForPeriod(period, branchId = null) {
  if (branchId) {
    return generateScheduleForBranch(period, branchId);
  }

  const response = await api.post('/schedule/generate', period);
  return withPeriod(response.data, period);
}

/** Solver-friendly default: next Mon–Sun week. */
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

export async function publishScheduleForPeriod(schedule) {
  if (!schedule?.id) {
    throw new Error('No schedule id to publish.');
  }

  const response = await api.post(`/schedule/${schedule.id}/publish`);
  const published = mergePublishedSchedule(schedule, {
    ...response.data,
    start_date: response.data?.start_date ?? schedule.start_date,
    end_date: response.data?.end_date ?? schedule.end_date,
  });

  return published;
}

export async function deleteScheduleForPeriod(schedule) {
  if (!schedule?.id) {
    throw new Error('No schedule id to delete.');
  }

  await api.delete(`/schedule/${schedule.id}`);
}

export async function deleteScheduleWeek({ branch_id, start_date, end_date }) {
  if (!isMonday(start_date)) {
    throw new Error('Week deletion requires a Monday start date.');
  }

  const weekEnd = getWeekPeriodRange(start_date, 1).end_date;
  if (end_date !== weekEnd) {
    throw new Error('Week deletion requires a Sunday end date.');
  }

  await api.delete('/schedule/week', {
    params: { branch_id, start_date, end_date },
  });
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
  return withPeriod(response.data, payload);
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
