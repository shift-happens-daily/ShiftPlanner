export function normalizeManagerList(value) {
  const sources = [value, value?.managers, value?.items, value?.data];

  for (const source of sources) {
    if (!Array.isArray(source)) continue;

    return source
      .map((entry) => ({
        id: entry?.id ?? entry?.membership_id ?? entry?.membershipId ?? null,
        user_id: entry?.user_id ?? entry?.userId ?? null,
        full_name: entry?.full_name ?? entry?.fullName ?? '',
        email: entry?.email ?? '',
        manager_role: entry?.manager_role ?? entry?.managerRole ?? 'manager',
        membership_status: entry?.membership_status ?? entry?.membershipStatus ?? 'active',
      }))
      .filter((entry) => entry.id != null || entry.email || entry.full_name);
  }

  return [];
}

export function sortCompanyManagers(managers) {
  return [...managers].sort((left, right) => {
    if (left.manager_role === 'owner' && right.manager_role !== 'owner') return -1;
    if (right.manager_role === 'owner' && left.manager_role !== 'owner') return 1;
    return String(left.full_name || left.email || '').localeCompare(
      String(right.full_name || right.email || ''),
    );
  });
}

export function getManagerInitials(value) {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
