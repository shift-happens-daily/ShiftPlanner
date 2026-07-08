import api from './api';

const SCHEDULE_GENERATION_TIMEOUT_MS = 180000;

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

export function pickScheduleForBranch(schedules, branchId) {
  if (!Array.isArray(schedules) || branchId == null) {
    return null;
  }
  return schedules.find((schedule) => Number(schedule.branch_id) === Number(branchId)) || null;
}

export function mergeWeeklySchedules(schedules, branchId, period = null) {
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return null;
  }

  const relevant = schedules
    .filter((schedule) => Number(schedule.branch_id) === Number(branchId))
    .filter((schedule) => {
      if (!period?.start_date || !period?.end_date) {
        return true;
      }
      return periodsOverlap(
        schedule.start_date,
        schedule.end_date,
        period.start_date,
        period.end_date,
      );
    })
    .sort((left, right) => String(left.start_date).localeCompare(String(right.start_date)));

  if (relevant.length === 0) {
    return null;
  }

  const shifts = relevant.flatMap((schedule) => schedule.shifts || []);
  const unfilledRequirements = relevant.flatMap((schedule) => schedule.unfilled_requirements || []);
  const conflicts = relevant.flatMap((schedule) => schedule.conflicts || []);
  const weeklySchedules = relevant.map((schedule) => ({
    id: schedule.id,
    branch_id: schedule.branch_id,
    start_date: schedule.start_date,
    end_date: schedule.end_date,
    status: schedule.status,
  }));
  const allPublished = relevant.every((schedule) => schedule.status === 'published');
  const hasDraft = relevant.some((schedule) => schedule.status === 'draft');

  return {
    id: relevant[0].id,
    branch_id: Number(branchId),
    status: allPublished ? 'published' : (hasDraft ? 'draft' : relevant[0].status),
    start_date: period?.start_date || relevant[0].start_date,
    end_date: period?.end_date || relevant[relevant.length - 1].end_date,
    shifts,
    unfilled_requirements: unfilledRequirements,
    conflicts,
    weekly_schedules: weeklySchedules,
  };
}

export function resolveScheduleIdForDate(schedule, dateKey) {
  if (!schedule || !dateKey) {
    return schedule?.id || null;
  }

  const weeklySchedules = schedule.weekly_schedules || [];
  const match = weeklySchedules.find(
    (item) => dateKey >= item.start_date && dateKey <= item.end_date,
  );
  if (match?.id) {
    return match.id;
  }

  if (schedule.start_date && schedule.end_date
    && dateKey >= schedule.start_date && dateKey <= schedule.end_date) {
    return schedule.id;
  }

  return schedule.id || null;
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
    if (schedules.length === 0) {
      return null;
    }

    const fullSchedules = await Promise.all(
      schedules.map(async (item) => {
        const response = await api.get(`/schedule/${item.id}`);
        return withPeriod(response.data, {
          start_date: item.start_date,
          end_date: item.end_date,
        });
      }),
    );

    return mergeWeeklySchedules(fullSchedules, branchId, period);
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

/** Generate one Monday-Sunday week (optionally for a single branch). */
export async function generateScheduleWeek(period, branchId = null) {
  const payload = {
    start_date: period.start_date,
    end_date: period.end_date,
  };
  if (branchId) {
    payload.branch_id = branchId;
  }
  const response = await api.post('/schedule/generate', payload, {
    timeout: SCHEDULE_GENERATION_TIMEOUT_MS,
  });
  return Array.isArray(response.data) ? response.data : [response.data].filter(Boolean);
}

/** Generate 1/2/4 weeks for the selected branch (variant B: one API call per week). */
export async function generateScheduleWeeks(mondayStart, weeks, branchId) {
  const normalizedMonday = snapToMonday(mondayStart);
  const fullPeriod = getWeekPeriodRange(normalizedMonday, weeks);
  const generatedWeeks = [];

  for (let weekIndex = 0; weekIndex < weeks; weekIndex += 1) {
    const weekStartDate = new Date(`${normalizedMonday}T12:00:00`);
    weekStartDate.setDate(weekStartDate.getDate() + weekIndex * 7);
    const weekPeriod = getWeekPeriodRange(formatLocalDate(weekStartDate), 1);
    const weekResults = await generateScheduleWeek(weekPeriod, branchId);
    const branchSchedule = pickScheduleForBranch(weekResults, branchId);
    if (branchSchedule) {
      generatedWeeks.push(withPeriod(branchSchedule, weekPeriod));
    }
  }

  const merged = mergeWeeklySchedules(generatedWeeks, branchId, fullPeriod);
  if (!merged && generatedWeeks.length > 0) {
    return withPeriod(generatedWeeks[0], fullPeriod);
  }
  return merged;
}

/** Backward-compatible alias: generate for branch across one or more weeks. */
export async function generateScheduleForBranch(period, branchId, weeks = null) {
  if (!branchId) {
    throw new Error('Branch is required to generate a schedule.');
  }

  const mondayStart = snapToMonday(period.start_date);
  const inferredWeeks = weeks || Math.max(1, Math.round(
    (new Date(`${period.end_date}T12:00:00`) - new Date(`${period.start_date}T12:00:00`)) / (7 * 86400000) + 0.001,
  ));
  return generateScheduleWeeks(mondayStart, inferredWeeks, branchId);
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

  throw new Error('Branch is required to generate a schedule.');
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
    weekly_schedules: published.weekly_schedules?.length
      ? published.weekly_schedules
      : (previous?.weekly_schedules || []),
  };
}

export async function publishScheduleForPeriod(schedule) {
  const weeklySchedules = (schedule?.weekly_schedules || [])
    .filter((item) => item.status !== 'published');

  const targets = weeklySchedules.length > 0
    ? weeklySchedules
    : (schedule?.id ? [{ id: schedule.id, status: schedule.status }] : []);

  if (targets.length === 0) {
    throw new Error('No schedule id to publish.');
  }

  let published = schedule;
  for (const target of targets) {
    const response = await api.post(`/schedule/${target.id}/publish`);
    published = mergePublishedSchedule(published, {
      ...response.data,
      start_date: response.data?.start_date ?? published?.start_date,
      end_date: response.data?.end_date ?? published?.end_date,
      weekly_schedules: (published?.weekly_schedules || []).map((item) => (
        item.id === target.id
          ? { ...item, status: 'published' }
          : item
      )),
    });
  }

  return {
    ...published,
    status: 'published',
  };
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
  const response = await api.post('/schedule/generate', payload, {
    timeout: SCHEDULE_GENERATION_TIMEOUT_MS,
  });
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
