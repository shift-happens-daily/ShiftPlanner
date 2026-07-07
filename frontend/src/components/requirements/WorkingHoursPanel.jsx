import { useEffect, useMemo, useState } from 'react';
import {
  MAX_SLOT,
  MIN_SLOT,
  buildSlotOptions,
  fetchWorkingHoursStore,
  formatWorkingHoursRange,
  getWorkingHoursForWeekday,
  normalizeDayWorkingHours,
  setWorkingHoursStoreFromApi,
  updateWorkingHoursForWeekday,
} from '../../utils/workingHours';

const WEEKDAYS = [
  { value: 0, ru: 'Пн', en: 'Mon' },
  { value: 1, ru: 'Вт', en: 'Tue' },
  { value: 2, ru: 'Ср', en: 'Wed' },
  { value: 3, ru: 'Чт', en: 'Thu' },
  { value: 4, ru: 'Пт', en: 'Fri' },
  { value: 5, ru: 'Сб', en: 'Sat' },
  { value: 6, ru: 'Вс', en: 'Sun' },
];

export default function WorkingHoursPanel({
  language,
  companyId,
  branchId,
  branchWorkingHours,
  revision = 0,
  onChange,
  onError,
  markUnsaved,
  markSaved,
  scope,
  styles,
  mobileStyles,
}) {
  const texts = {
    ru: {
      title: 'Часы работы',
      hint: 'Используются для ограничения времени новых требований.',
      chooseBranch: 'Выберите филиал, чтобы настроить часы работы.',
      weekday: 'День недели',
      from: 'С',
      to: 'До',
      apply: 'Сохранить',
      loadError: 'Не удалось загрузить часы работы.',
      saveError: 'Не удалось сохранить часы работы.',
    },
    en: {
      title: 'Working hours',
      hint: 'Used to constrain times for new requirements.',
      chooseBranch: 'Select a branch to configure working hours.',
      weekday: 'Weekday',
      from: 'From',
      to: 'To',
      apply: 'Save',
      loadError: 'Failed to load working hours.',
      saveError: 'Failed to save working hours.',
    },
  };

  const t = texts[language] || texts.ru;
  const slotOptions = useMemo(() => buildSlotOptions(MIN_SLOT, MAX_SLOT), []);
  const [selectedWeekday, setSelectedWeekday] = useState(0);
  const [startSlot, setStartSlot] = useState(16);
  const [endSlot, setEndSlot] = useState(36);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!companyId || !branchId) return undefined;

    if (branchWorkingHours) {
      setWorkingHoursStoreFromApi(companyId, branchId, branchWorkingHours);
      return undefined;
    }

    let cancelled = false;
    setIsLoading(true);

    void fetchWorkingHoursStore(companyId, branchId)
      .catch(() => {
        if (!cancelled) {
          onError?.(t.loadError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [branchId, branchWorkingHours, companyId, onError, t.loadError]);

  const currentHours = useMemo(() => {
    if (!companyId || !branchId) {
      return normalizeDayWorkingHours({ startSlot, endSlot });
    }
    return getWorkingHoursForWeekday(companyId, branchId, selectedWeekday);
  }, [branchId, companyId, endSlot, revision, selectedWeekday, startSlot]);

  useEffect(() => {
    setStartSlot(currentHours.startSlot);
    setEndSlot(currentHours.endSlot);
  }, [currentHours.endSlot, currentHours.startSlot, selectedWeekday, branchId, revision]);

  const endSlotOptions = useMemo(() => {
    const minimumEndSlot = Math.min(MAX_SLOT, Math.max(startSlot + 1, MIN_SLOT + 1));
    return buildSlotOptions(minimumEndSlot, MAX_SLOT);
  }, [startSlot]);

  const handleApply = async () => {
    if (!companyId || !branchId || isSaving) return;

    const normalizedEnd = Math.max(endSlot, startSlot + 1);
    setIsSaving(true);

    try {
      await updateWorkingHoursForWeekday(
        companyId,
        branchId,
        selectedWeekday,
        startSlot,
        normalizedEnd,
      );
      markSaved?.(scope);
      onChange?.();
    } catch {
      onError?.(t.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  if (!branchId) {
    return (
      <section style={{ ...styles.panel, ...mobileStyles?.panel }}>
        <h3 style={{ ...styles.panelTitle, ...mobileStyles?.panelTitle }}>{t.title}</h3>
        <p style={{ ...styles.panelHint, ...mobileStyles?.panelHint }}>{t.chooseBranch}</p>
      </section>
    );
  }

  return (
    <section style={{ ...styles.panel, ...mobileStyles?.panel }}>
      <h3 style={{ ...styles.panelTitle, ...mobileStyles?.panelTitle }}>{t.title}</h3>
      <p style={{ ...styles.panelHint, ...mobileStyles?.panelHint }}>{t.hint}</p>

      <div style={{ ...styles.stack, ...mobileStyles?.stack }}>
        <label style={{ ...styles.label, ...mobileStyles?.label }}>{t.weekday}</label>
        <div style={{ ...styles.dayPills, ...mobileStyles?.dayPills }}>
          {WEEKDAYS.map((day) => {
            const active = selectedWeekday === day.value;
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => setSelectedWeekday(day.value)}
                style={active
                  ? { ...styles.dayPillActive, ...mobileStyles?.dayPillActive }
                  : { ...styles.dayPill, ...mobileStyles?.dayPill }}
              >
                {day[language] || day.ru}
              </button>
            );
          })}
        </div>

        <div style={{ ...styles.itemMeta, ...mobileStyles?.itemMeta }}>
          {formatWorkingHoursRange(currentHours)}
        </div>

        <label style={{ ...styles.label, ...mobileStyles?.label }}>{t.from}</label>
        <select
          value={startSlot}
          onChange={(event) => {
            const nextStart = Number(event.target.value);
            setStartSlot(nextStart);
            if (endSlot <= nextStart) {
              setEndSlot(Math.min(MAX_SLOT, nextStart + 1));
            }
            markUnsaved?.(scope);
          }}
          style={{ ...styles.input, ...mobileStyles?.input }}
          disabled={isLoading || isSaving}
        >
          {slotOptions.slice(0, -1).map((option) => (
            <option key={option.slot} value={option.slot}>{option.label}</option>
          ))}
        </select>

        <label style={{ ...styles.label, ...mobileStyles?.label }}>{t.to}</label>
        <select
          value={endSlot}
          onChange={(event) => {
            setEndSlot(Number(event.target.value));
            markUnsaved?.(scope);
          }}
          style={{ ...styles.input, ...mobileStyles?.input }}
          disabled={isLoading || isSaving}
        >
          {endSlotOptions.map((option) => (
            <option key={option.slot} value={option.slot}>{option.label}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleApply}
          style={{ ...styles.secondaryButton, ...mobileStyles?.secondaryButton }}
          disabled={isLoading || isSaving}
        >
          {isSaving ? '...' : t.apply}
        </button>
      </div>
    </section>
  );
}
