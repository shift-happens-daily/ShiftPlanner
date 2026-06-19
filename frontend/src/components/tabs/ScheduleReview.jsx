import { useEffect, useMemo, useState } from 'react';
import { listGeneratedSchedules } from '../../services/scheduleService';

function formatDate(d) {
  const date = new Date(d);
  return date.toISOString().slice(0, 10);
}

function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseTimeToHours(t) {
  if (!t) return 0;
  const parts = String(t).split(':');
  const h = Number(parts[0] || 0);
  const m = Number(parts[1] || 0);
  return h + m / 60;
}

function buildEmployeeListFromIndexes(schedules, dateIndexes) {
  const empMap = {};
  dateIndexes.forEach((di) => {
    const day = schedules[di];
    if (!day) return;
    (day.shifts || []).forEach((shift) => {
      (shift.candidate_employees || shift.assigned_employees || []).forEach((e) => {
        if (!e) return;
        empMap[String(e.id)] = e;
      });
    });
  });
  return Object.values(empMap).sort((a, b) => (a.full_name || a.name || '').localeCompare(b.full_name || b.name || ''));
}

export default function ScheduleReview({ language, userRole }) {
  const [viewMode, setViewMode] = useState('day');
  const [schedules, setSchedules] = useState([]);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedMap, setSelectedMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const texts = {
    ru: {
      title: 'Просмотр сгенерированного расписания',
      employee: 'Сотрудник',
      day: 'День',
      threeDay: '3 дня',
      month: 'Месяц',
      importCSV: 'Импорт CSV',
      exportCSV: 'Экспорт CSV',
      noEmployees: 'Нет сотрудников',
      loading: 'Загрузка...',
    },
    en: {
      title: 'Generated Schedule Review',
      employee: 'Employee',
      day: 'Day',
      threeDay: '3-day',
      month: 'Month',
      importCSV: 'Import CSV',
      exportCSV: 'Export CSV',
      noEmployees: 'No employees',
      loading: 'Loading...',
    },
  };

  const t = texts[language] || texts.ru;

  useEffect(() => {
    let mounted = true;

    async function load() {
      setIsLoading(true);
      try {
        const data = await listGeneratedSchedules();
        if (!mounted) return;
        setSchedules(data);
        setSelectedDateIndex(0);
      } catch (e) {
        setError(String(e));
      } finally {
        setIsLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const dates = useMemo(() => schedules.map((s) => formatDate(s.date)), [schedules]);

  const pageSize = viewMode === 'day' ? 1 : viewMode === '3day' ? 3 : 30;

  const cellWidth = 48;

  const visibleDates = useMemo(() => {
    if (!dates.length) return [];
    const start = Math.max(0, Math.min(selectedDateIndex, dates.length - 1));
    return dates.slice(start, start + pageSize);
  }, [dates, selectedDateIndex, pageSize]);

  const dateIndexForVisible = useMemo(() => {
    const out = [];
    const start = Math.max(0, Math.min(selectedDateIndex, schedules.length - 1));
    for (let i = 0; i < pageSize; i++) {
      const idx = start + i;
      if (idx >= 0 && idx < schedules.length) out.push(idx);
    }
    return out;
  }, [schedules, selectedDateIndex, pageSize]);

  const employeesForView = useMemo(() => buildEmployeeListFromIndexes(schedules, dateIndexForVisible), [schedules, dateIndexForVisible]);

  const toggleEmployee = (shiftId, employeeId) => {
    setSelectedMap((prev) => {
      const copy = { ...prev };
      const key = String(shiftId);
      const arr = new Set(copy[key] || []);
      if (arr.has(employeeId)) arr.delete(employeeId);
      else arr.add(employeeId);
      copy[key] = Array.from(arr);
      return copy;
    });
  };

  const exportCSV = () => {
    const rows = [['date', 'shift_id', 'position', 'employee_ids']];
    schedules.forEach((s) => {
      (s.shifts || []).forEach((shift) => {
        const sel = selectedMap[String(shift.id)] || shift.assigned_employee_ids || [];
        rows.push([formatDate(s.date), shift.id, shift.position_title || shift.position || '', sel.join('|')]);
      });
    });
    downloadCSV('generated_schedule.csv', rows);
  };

  const importCSV = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result || '';
      const lines = text.split(/\r?\n/).filter(Boolean);
      const dataLines = lines.slice(1);
      const map = {};
      dataLines.forEach((ln) => {
        const parts = ln.split(',');
        const shiftId = parts[1] ? parts[1].replace(/^"|"$/g, '') : '';
        const empIds = parts[3] ? parts[3].replace(/^"|"$/g, '') : '';
        if (shiftId) map[shiftId] = empIds ? empIds.split('|').map((x) => x.trim()) : [];
      });
      setSelectedMap(map);
    };
    reader.readAsText(file);
  };

  if (isLoading) return <div style={{ padding: 20 }}>{t.loading}</div>;
  if (error) return <div style={{ padding: 20, color: 'red' }}>{error}</div>;

  const totalWidth = visibleDates.length * 24 * cellWidth;

  return (
    <section style={{ padding: 18 }}>
      <h2>{t.title}</h2>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setSelectedDateIndex((i) => Math.max(0, i - 1))}>&larr;</button>
        <strong>{dates[selectedDateIndex] || '—'}</strong>
        <button onClick={() => setSelectedDateIndex((i) => Math.min(dates.length - 1, i + 1))}>&rarr;</button>

        <div style={{ marginLeft: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button 
            onClick={() => setViewMode('day')} 
            style={{ 
              fontWeight: viewMode === 'day' ? 700 : 400,
              padding: '6px 12px',
              borderRadius: '6px',
              background: viewMode === 'day' ? '#002642' : '#dee7e7',
              color: viewMode === 'day' ? '#fff' : '#002642',
              border: '1px solid #dee7e7',
              cursor: 'pointer'
            }}
          >{t.day}</button>
          <button 
            onClick={() => setViewMode('3day')} 
            style={{ 
              fontWeight: viewMode === '3day' ? 700 : 400,
              padding: '6px 12px',
              borderRadius: '6px',
              background: viewMode === '3day' ? '#002642' : '#dee7e7',
              color: viewMode === '3day' ? '#fff' : '#002642',
              border: '1px solid #dee7e7',
              cursor: 'pointer'
            }}
          >{t.threeDay}</button>
          <button 
            onClick={() => setViewMode('month')} 
            style={{ 
              fontWeight: viewMode === 'month' ? 700 : 400,
              padding: '6px 12px',
              borderRadius: '6px',
              background: viewMode === 'month' ? '#002642' : '#dee7e7',
              color: viewMode === 'month' ? '#fff' : '#002642',
              border: '1px solid #dee7e7',
              cursor: 'pointer'
            }}
          >{t.month}</button>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            {t.importCSV}
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => e.target.files && importCSV(e.target.files[0])} />
          </label>
          <button onClick={exportCSV} style={{
            padding: '6px 12px',
            borderRadius: '6px',
            background: '#002642',
            color: '#fff',
            border: 'none',
            cursor: 'pointer'
          }}>{t.exportCSV}</button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ 
          borderCollapse: 'collapse', 
          minWidth: 200 + totalWidth,
          tableLayout: 'fixed'
        }}>
          <thead>
            <tr>
              <th style={{ 
                position: 'sticky', 
                left: 0, 
                zIndex: 10, 
                background: '#f4faff', 
                padding: '10px 16px', 
                borderBottom: '2px solid #dee7e7',
                width: '200px',
                minWidth: '200px',
                maxWidth: '200px',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: '700',
                color: '#002642'
              }}>
                {t.employee}
              </th>
              {visibleDates.map((d) => (
                <th key={d} style={{ 
                  padding: '10px 4px', 
                  borderBottom: '2px solid #dee7e7', 
                  textAlign: 'center',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#4f646f',
                  background: '#f4faff',
                  width: 24 * cellWidth,
                  minWidth: 24 * cellWidth,
                  maxWidth: 24 * cellWidth
                }}>
                  {d}
                </th>
              ))}
            </tr>
            <tr>
              <th style={{ 
                position: 'sticky', 
                left: 0, 
                zIndex: 10, 
                background: '#f4faff', 
                padding: '4px 16px', 
                borderBottom: '2px solid #dee7e7',
                width: '200px',
                minWidth: '200px',
                maxWidth: '200px'
              }} />
              {visibleDates.map((d) => (
                <th key={`${d}-time`} style={{ 
                  padding: '4px 2px', 
                  borderBottom: '2px solid #dee7e7',
                  background: '#f4faff'
                }}>
                  <div style={{ display: 'flex', gap: 0 }}>
                    {Array.from({ length: 24 }).map((_, h) => (
                      <div key={h} style={{ 
                        flex: `0 0 ${cellWidth}px`, 
                        textAlign: 'center', 
                        fontSize: 11,
                        color: '#4f646f',
                        fontWeight: '500'
                      }}>
                        {`${String(h).padStart(2, '0')}:00`}
                      </div>
                    ))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employeesForView.map((emp, rowIndex) => (
              <tr key={emp.id}>
                <td style={{ 
                  position: 'sticky', 
                  left: 0, 
                  zIndex: 5, 
                  background: rowIndex % 2 === 0 ? '#ffffff' : '#f8faff',
                  padding: '8px 16px', 
                  borderBottom: '1px solid #f0f0f0',
                  width: '200px',
                  minWidth: '200px',
                  maxWidth: '200px',
                  fontWeight: '600',
                  fontSize: '14px',
                  color: '#002642'
                }}>
                  {emp.full_name || emp.name || emp.email || `#${emp.id}`}
                </td>
                {visibleDates.map((d, idx) => {
                  const di = dateIndexForVisible[idx];
                  const day = schedules[di];
                  if (!day) return <td key={`${d}-${emp.id}`} style={{ 
                    padding: 0, 
                    borderBottom: '1px solid #f0f0f0', 
                    height: 72, 
                    background: rowIndex % 2 === 0 ? '#ffffff' : '#f8faff',
                    width: 24 * cellWidth,
                    minWidth: 24 * cellWidth,
                    maxWidth: 24 * cellWidth
                  }} />;
                  
                  const myShifts = (day.shifts || []).filter((shift) => {
                    const ids = (shift.candidate_employees || shift.assigned_employees || []).map((e) => String(e.id));
                    return ids.includes(String(emp.id));
                  });

                  return (
                    <td key={`${d}-${emp.id}`} style={{ 
                      padding: 0, 
                      borderBottom: '1px solid #f0f0f0', 
                      height: 72, 
                      position: 'relative',
                      background: rowIndex % 2 === 0 ? '#ffffff' : '#f8faff',
                      width: 24 * cellWidth,
                      minWidth: 24 * cellWidth,
                      maxWidth: 24 * cellWidth
                    }}>
                      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        {myShifts.map((shift) => {
                          const start = parseTimeToHours(shift.start_time);
                          const end = parseTimeToHours(shift.end_time || shift.start_time);
                          const duration = end - start;
                          const minWidthPx = 20;
                          const leftPx = start * cellWidth;
                          const widthPx = Math.max(duration * cellWidth, minWidthPx);
                          return (
                            <div
                              key={shift.id}
                              style={{
                                position: 'absolute',
                                left: `${leftPx}px`,
                                width: `${widthPx}px`,
                                top: 12,
                                height: 48,
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: '#fff',
                                borderRadius: 8,
                                padding: '4px 8px',
                                fontSize: 11,
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                boxShadow: '0 2px 8px rgba(102,126,234,0.25)',
                                border: '1px solid rgba(255,255,255,0.1)'
                              }}
                            >
                              <div style={{ fontWeight: 700, fontSize: 11 }}>
                                {shift.position_title || shift.position || '—'}
                              </div>
                              <div style={{ fontSize: 10, opacity: 0.9 }}>
                                {`${String(shift.start_time || '').slice(0,5)} - ${String(shift.end_time || '').slice(0,5)}`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}