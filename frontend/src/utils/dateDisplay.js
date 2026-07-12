export function getDateLocale(language = 'en') {
  return language === 'ru' ? 'ru-RU' : 'en-GB';
}

export function getDatePlaceholder(language = 'en') {
  return language === 'ru' ? 'дд/мм/гггг' : 'dd/mm/yyyy';
}

export function parseApiDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (/^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split('/').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (
      date.getFullYear() !== year
      || date.getMonth() !== month - 1
      || date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function formatApiDateAsDisplay(value) {
  const date = parseApiDate(value);
  if (!date) return String(value || '');

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDisplayDateInput(value) {
  const digits = String(value).replace(/\D/g, '').slice(0, 8);

  let day = digits.slice(0, 2);
  let month = digits.slice(2, 4);
  const year = digits.slice(4);

  if (day.length === 1 && Number(day) > 3) {
    day = `0${day}`;
  }

  if (day.length === 2 && Number(day) > 31) {
    day = '31';
  }

  if (month.length === 1 && Number(month) > 1) {
    month = `0${month}`;
  }

  if (month.length === 2 && Number(month) > 12) {
    month = '12';
  }

  if (digits.length <= 2) return day;
  if (digits.length <= 4) return `${day}/${month}`;

  return `${day}/${month}/${year}`;
}

export function parseDisplayDateToApi(value) {
  if (!/^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(String(value || '').trim())) {
    return '';
  }

  const date = parseApiDate(value);
  if (!date) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeToApiDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return parseDisplayDateToApi(raw);
}

export function isDisplayDateValid(value) {
  return Boolean(parseDisplayDateToApi(value));
}

export function formatApiDateRange(startDate, endDate, fallback = '') {
  if (!startDate || !endDate) return fallback;
  if (startDate === endDate) return formatApiDateAsDisplay(startDate);
  return `${formatApiDateAsDisplay(startDate)} — ${formatApiDateAsDisplay(endDate)}`;
}

export function formatLocalizedDate(value, language = 'en', options = {}) {
  const date = parseApiDate(value);
  if (!date) return String(value || '');
  return date.toLocaleDateString(getDateLocale(language), options);
}

export function formatDisplayDateWithWeekday(value, language = 'en') {
  return formatLocalizedDate(value, language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatShortDisplayDate(value, language = 'en') {
  return formatLocalizedDate(value, language, {
    day: 'numeric',
    month: 'short',
  });
}
