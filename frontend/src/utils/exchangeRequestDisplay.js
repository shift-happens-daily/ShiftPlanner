import { formatApiDateAsDisplay } from './dateDisplay';

function formatTime(value) {
  return String(value || '').slice(0, 5);
}

export function formatExchangeShiftTime(startTime, endTime) {
  const start = formatTime(startTime);
  const end = formatTime(endTime);
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
}

export function formatExchangeRequestShiftLine(request, t) {
  const details = [
    request.branch_name,
    request.position_name,
    request.shift_date ? formatApiDateAsDisplay(request.shift_date) : '',
    formatExchangeShiftTime(request.start_time, request.end_time),
  ].filter(Boolean);

  const shiftLabel = t?.shift ? `${t.shift} #${request.shift_id}` : `#${request.shift_id}`;
  return details.length > 0 ? `${shiftLabel} · ${details.join(' · ')}` : shiftLabel;
}
