import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  formatApiDateAsDisplay,
  formatDisplayDateInput,
  getDatePlaceholder,
  parseDisplayDateToApi,
} from '../../utils/dateDisplay';
import DatePickerCalendar from './DatePickerCalendar';
import '../../styles/date-field.css';

const CALENDAR_WIDTH = 280;
const CALENDAR_HEIGHT = 330;
const VIEWPORT_GAP = 8;

function CalendarIcon() {
  return (
    <svg
      className="df-trigger-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M8 3v3.5M16 3v3.5M3 9.5h18" />
      <path d="M7.5 13.5h2.2M14.3 13.5h2.2M7.5 17h2.2" />
    </svg>
  );
}

function getPopoverPosition(anchor) {
  const rect = anchor.getBoundingClientRect();
  const gap = 6;

  let top = rect.bottom + gap;
  let left = rect.left;

  if (top + CALENDAR_HEIGHT > window.innerHeight - VIEWPORT_GAP) {
    top = rect.top - CALENDAR_HEIGHT - gap;
  }

  if (top < VIEWPORT_GAP) {
    top = Math.min(rect.bottom + gap, window.innerHeight - CALENDAR_HEIGHT - VIEWPORT_GAP);
    top = Math.max(VIEWPORT_GAP, top);
  }

  if (left + CALENDAR_WIDTH > window.innerWidth - VIEWPORT_GAP) {
    left = window.innerWidth - CALENDAR_WIDTH - VIEWPORT_GAP;
  }

  if (left < VIEWPORT_GAP) {
    left = VIEWPORT_GAP;
  }

  return { top, left };
}

function getFieldStyles(style) {
  if (!style) {
    return { wrapperStyle: undefined, inputStyle: undefined };
  }

  const {
    width,
    border,
    borderTop,
    borderRight,
    borderBottom,
    borderLeft,
    borderRadius,
    background,
    backgroundColor,
    ...rest
  } = style;

  return {
    wrapperStyle: width ? { width } : undefined,
    inputStyle: {
      ...rest,
      width: width ? '100%' : rest.width,
    },
  };
}

export default function DateField({
  value = '',
  onChange,
  disabled = false,
  className,
  style,
  placeholder,
  language = 'en',
  minDate = '',
  maxDate = '',
  'aria-label': ariaLabel,
}) {
  const popoverId = useId();
  const rootRef = useRef(null);
  const popoverRef = useRef(null);
  const [displayValue, setDisplayValue] = useState(() => formatApiDateAsDisplay(value));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState(null);

  useEffect(() => {
    setDisplayValue(formatApiDateAsDisplay(value));
  }, [value]);

  const updatePopoverPosition = () => {
    if (!rootRef.current) return;
    const { top, left } = getPopoverPosition(rootRef.current);
    setPopoverStyle({ top, left });
  };

  useLayoutEffect(() => {
    if (!isCalendarOpen) {
      setPopoverStyle(null);
      return undefined;
    }

    updatePopoverPosition();

    const handleReposition = () => updatePopoverPosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isCalendarOpen]);

  useEffect(() => {
    if (!isCalendarOpen) return undefined;

    const handlePointerDown = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      if (popoverRef.current?.contains(event.target)) return;
      setIsCalendarOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsCalendarOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCalendarOpen]);

  const commitDisplayValue = (nextDisplay) => {
    const apiValue = parseDisplayDateToApi(nextDisplay);
    if (apiValue) {
      setDisplayValue(formatApiDateAsDisplay(apiValue));
      onChange?.(apiValue);
      return;
    }

    if (!nextDisplay.trim()) {
      onChange?.('');
    }
  };

  const handleCalendarSelect = (apiValue) => {
    setDisplayValue(formatApiDateAsDisplay(apiValue));
    onChange?.(apiValue);
    setIsCalendarOpen(false);
  };

  const inputClassName = className ? `df-input ${className}` : 'df-input';
  const { wrapperStyle, inputStyle } = getFieldStyles(style);
  const datePlaceholder = placeholder ?? getDatePlaceholder(language);

  const popover = isCalendarOpen && popoverStyle
    ? createPortal(
      <div
        ref={popoverRef}
        className="df-popover"
        id={popoverId}
        style={{
          top: `${popoverStyle.top}px`,
          left: `${popoverStyle.left}px`,
        }}
      >
        <DatePickerCalendar
          value={value}
          onChange={handleCalendarSelect}
          language={language}
          minDate={minDate}
          maxDate={maxDate}
        />
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      <div className="df-root" ref={rootRef} style={wrapperStyle}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={datePlaceholder}
          aria-label={ariaLabel}
          value={displayValue}
          onChange={(event) => {
            const nextDisplay = formatDisplayDateInput(event.target.value);
            setDisplayValue(nextDisplay);
            commitDisplayValue(nextDisplay);
          }}
          onBlur={() => {
            const apiValue = parseDisplayDateToApi(displayValue);
            if (apiValue) {
              setDisplayValue(formatApiDateAsDisplay(apiValue));
              onChange?.(apiValue);
              return;
            }

            setDisplayValue(formatApiDateAsDisplay(value));
          }}
          disabled={disabled}
          className={inputClassName}
          style={inputStyle}
        />
        <button
          type="button"
          className="df-trigger"
          onClick={() => setIsCalendarOpen((open) => !open)}
          disabled={disabled}
          aria-label={language === 'ru' ? 'Открыть календарь' : 'Open calendar'}
          aria-expanded={isCalendarOpen}
          aria-controls={popoverId}
        >
          <CalendarIcon />
        </button>
      </div>
      {popover}
    </>
  );
}
