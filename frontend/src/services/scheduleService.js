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
const MOCK_SCHEDULES_KEY = 'shiftplanner_mock_schedules';

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

function readMockSchedules() {
  try {
    return JSON.parse(localStorage.getItem(MOCK_SCHEDULES_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeMockSchedules(schedules) {
  localStorage.setItem(MOCK_SCHEDULES_KEY, JSON.stringify(schedules));
}

function registerMockScheduleRecord(record) {
  const filtered = readMockSchedules().filter(
    (item) => !(
      item.branch_id === record.branch_id
      && item.start_date === record.start_date
      && item.end_date === record.end_date
    ),
  );
  filtered.push(record);
  writeMockSchedules(filtered);
}

function removeMockScheduleRecord({ branch_id, start_date, end_date }) {
  writeMockSchedules(
    readMockSchedules().filter(
      (item) => !(
        item.branch_id === branch_id
        && item.start_date === start_date
        && item.end_date === end_date
      ),
    ),
  );
}

function filterMockSchedules(params = {}) {
  return readMockSchedules().filter((schedule) => {
    if (params.branch_id && schedule.branch_id !== params.branch_id) return false;
    if (params.status && schedule.status !== params.status) return false;
    if (params.date_from && params.date_to) {
      return periodsOverlap(
        schedule.start_date,
        schedule.end_date,
        params.date_from,
        params.date_to,
      );
    }
    return true;
  });
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
    ? schedules.filter((schedule) => schedule.branch_id === branchId)
    : schedules;
  const source = filtered.length > 0 ? filtered : schedules;
  return [...source].sort((a, b) => b.id - a.id)[0];
}

function withPeriod(schedule, period) {
  if (!schedule) return schedule;
  return {
    ...schedule,
    start_date: schedule.start_date || period?.start_date,
    end_date: schedule.end_date || period?.end_date,
  };
}

function normalizeGeneratedSchedules(data, period) {
  const schedules = Array.isArray(data) ? data : [data].filter(Boolean);
  return schedules.map((schedule) => withPeriod(schedule, period));
}

function pickBranchSchedule(schedules, branchId, period) {
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return null;
  }
  const branchSchedule = schedules.find((schedule) => schedule.branch_id === branchId);
  return withPeriod(branchSchedule || schedules[0], period);
}

export async function listSchedulesWithFallback(params = {}) {
  try {
    const response = await api.get('/schedule', { params });
    return Array.isArray(response.data) ? response.data : [response.data].filter(Boolean);
  } catch (error) {
    if ([404, 405, 422].includes(error?.response?.status)) {
      return filterMockSchedules(params);
    }
    throw error;
  }
}

export async function listSchedules(params = {}) {
  return listSchedulesWithFallback(params);
}

export async function findOverlappingSchedules({ branch_id, start_date, end_date }) {
  const schedules = await listSchedulesWithFallback({
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
  const schedules = await listSchedulesWithFallback({ branch_id, date_from, date_to });
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
    try {
      const schedules = await listSchedulesWithFallback(
        buildScheduleQueryParams(period, status, branchId),
      );
      return pickPrimarySchedule(schedules, branchId);
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

/** Generate schedule for a single branch and selected period. */
export async function generateScheduleForBranch(period, branchId) {
  const payload = {
    start_date: period.start_date,
    end_date: period.end_date,
    branch_id: branchId,
  };
  const response = await api.post('/schedule/generate', payload);
  const schedules = normalizeGeneratedSchedules(response.data, period);
  const schedule = pickBranchSchedule(schedules, branchId, period);

  if (schedule) {
    registerMockScheduleRecord({
      id: schedule.id || Date.now(),
      branch_id: branchId,
      start_date: period.start_date,
      end_date: period.end_date,
      status: schedule.status || 'draft',
    });
  }

  return schedule;
}

/** Backward-compatible wrapper for older callers. */
export async function generateScheduleForPeriod(period, branchId = null) {
  if (branchId) {
    return generateScheduleForBranch(period, branchId);
  }

  const response = await api.post('/schedule/generate', period);
  const schedules = normalizeGeneratedSchedules(response.data, period);
  return schedules[0] || null;
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

  if (schedule.branch_id && published.start_date && published.end_date) {
    registerMockScheduleRecord({
      id: published.id,
      branch_id: schedule.branch_id,
      start_date: published.start_date,
      end_date: published.end_date,
      status: 'published',
    });
  }

  return published;
}

export async function deleteScheduleForPeriod(schedule) {
  if (!schedule?.id) {
    throw new Error('No schedule id to delete.');
  }

  await api.delete(`/schedule/${schedule.id}`);

  if (schedule.branch_id && schedule.start_date && schedule.end_date) {
    removeMockScheduleRecord({
      branch_id: schedule.branch_id,
      start_date: schedule.start_date,
      end_date: schedule.end_date,
    });
  }
}

export async function deleteScheduleWeek({ branch_id, start_date, end_date }) {
  if (!isMonday(start_date)) {
    throw new Error('Week deletion requires a Monday start date.');
  }

  const weekEnd = getWeekPeriodRange(start_date, 1).end_date;
  if (end_date !== weekEnd) {
    throw new Error('Week deletion requires a Sunday end date.');
  }

  try {
    await api.delete('/schedule/week', {
      params: { branch_id, start_date, end_date },
    });
  } catch (error) {
    if (![404, 405].includes(error?.response?.status)) {
      throw error;
    }

    const schedules = await listSchedulesWithFallback({
      branch_id,
      date_from: start_date,
      date_to: end_date,
    });
    const exactWeek = schedules.find(
      (schedule) => schedule.start_date === start_date && schedule.end_date === end_date,
    );

    if (exactWeek?.id) {
      try {
        await api.delete(`/schedule/${exactWeek.id}`);
      } catch (deleteError) {
        if (![404, 405].includes(deleteError?.response?.status)) {
          throw deleteError;
        }
      }
    }
  }

  removeMockScheduleRecord({ branch_id, start_date, end_date });
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
  return normalizeGeneratedSchedules(response.data, payload);
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
