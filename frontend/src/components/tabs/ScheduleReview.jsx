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
  const [viewMode, setViewMode] = useState('day'); // 'day' | '3day' | 'month'
  const [schedules, setSchedules] = useState([]);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedMap, setSelectedMap] = useState({}); // shiftId -> [employeeId]
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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

  const pageSize = viewMode === 'day' ? 1 : viewMode === '3day' ? 3 : 14; // month use 14-day compression by default

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

  if (isLoading) return <div style={{ padding: 20 }}>Loading...</div>;
  if (error) return <div style={{ padding: 20, color: 'red' }}>{error}</div>;

  return (
    <section style={{ padding: 18 }}>
      <h2>Generated Schedule Review</h2>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => setSelectedDateIndex((i) => Math.max(0, i - 1))}>&larr;</button>
        <strong>{dates[selectedDateIndex] || '—'}</strong>
        <button onClick={() => setSelectedDateIndex((i) => Math.min(dates.length - 1, i + 1))}>&rarr;</button>

        <div style={{ marginLeft: 12, display: 'flex', gap: 6 }}>
          <button onClick={() => setViewMode('day')} style={{ fontWeight: viewMode === 'day' ? 700 : 400 }}>Day</button>
          <button onClick={() => setViewMode('3day')} style={{ fontWeight: viewMode === '3day' ? 700 : 400 }}>3-day</button>
          <button onClick={() => setViewMode('month')} style={{ fontWeight: viewMode === 'month' ? 700 : 400 }}>Month</button>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            Import CSV
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => e.target.files && importCSV(e.target.files[0])} />
          </label>
          <button onClick={exportCSV}>Export CSV</button>
        </div>
      </div>

      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, padding: '6px 8px' }}>Employee</div>
            {employeesForView.length === 0 && <div style={{ padding: 8, color: '#666' }}>No employees</div>}
            {employeesForView.map((emp) => (
              <div key={emp.id} style={{ padding: '6px 8px', borderBottom: '1px solid #f0f0f0' }}>{emp.full_name || emp.name || emp.email || `#${emp.id}`}</div>
            ))}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 8, minWidth: 24 * 48 * visibleDates.length }}>
              {visibleDates.map((d, idx) => (
                <div key={d} style={{ flex: '0 0 auto', minWidth: 24 * 48 }}>
                  <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #ddd' }}>
                    {Array.from({ length: 24 }).map((_, h) => (
                      <div key={h} style={{ flex: '0 0 48px', textAlign: 'center', fontSize: 12, padding: 4, borderLeft: '1px solid #f5f5f5' }}>{`${String(h).padStart(2, '0')}:00`}</div>
                    ))}
                  </div>

                  <div>
                    {employeesForView.map((emp) => (
                      <div key={emp.id} style={{ position: 'relative', height: 72, borderBottom: '1px solid #f2f2f2' }}>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', overflow: 'hidden' }}>
                          {Array.from({ length: 24 }).map((_, h) => (
                            <div key={h} style={{ flex: '0 0 48px', borderLeft: '1px solid rgba(0,0,0,0.03)' }} />
                          ))}
                        </div>

                        {/* shifts for this day and employee */}
                        {(() => {
                          const di = dateIndexForVisible[idx];
                          const day = schedules[di];
                          if (!day) return null;
                          const myShifts = (day.shifts || []).filter((shift) => {
                            const ids = (shift.candidate_employees || shift.assigned_employees || []).map((e) => String(e.id));
                            return ids.includes(String(emp.id));
                          });

                          return myShifts.map((shift) => {
                            const start = parseTimeToHours(shift.start_time);
                            const end = parseTimeToHours(shift.end_time || shift.start_time);
                            const left = (start / 24) * 100;
                            const width = Math.max(((end - start) / 24) * 100, 1);
                            return (
                              <div key={shift.id} style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, top: 12, height: 44, background: '#1976d2', color: '#fff', borderRadius: 6, padding: '6px 8px', fontSize: 12, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                <div style={{ fontWeight: 700 }}>{shift.position_title || shift.position || '—'}</div>
                                <div style={{ fontSize: 11, opacity: 0.95 }}>{`${String(shift.start_time || '').slice(0,5)} - ${String(shift.end_time || '').slice(0,5)}`}</div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
