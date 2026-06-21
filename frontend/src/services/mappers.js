export function splitFullName(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
}

export function mapCurrentUser(profile) {
  const { firstName, lastName } = splitFullName(profile?.full_name);
  return {
    id: profile?.id ?? null,
    publicId: profile?.public_id ?? null,
    fullName: profile?.full_name || '',
    firstName,
    lastName,
    email: profile?.email || '',
    role: profile?.role || null,
    employeeId: profile?.employee_id ?? null,
    company: profile?.company || null,
    branch: profile?.branch || null,
    position: profile?.position || null,
  };
}

export function mapEmployeeCalendarSummary(summary) {
  return {
    employee: summary?.employee || null,
    availability: summary?.availability || [],
    desiredDaysOff: summary?.desired_days_off || [],
    absences: summary?.absences || [],
    shifts: summary?.shifts || [],
    workload: summary?.workload || { total_shifts: 0, total_hours: 0 },
  };
}
