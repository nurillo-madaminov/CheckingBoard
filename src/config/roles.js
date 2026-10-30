/**
 * ROLES (staff_profiles.role, enforced by the database)
 *   staff       dispatcher: works the board, checks in / out on the phone
 *   supervisor  leads a group: every manager power, and checks in / out like staff
 *   manager     runs the whole team: every manager power, no check-in / out
 * Must match public.is_team_manager() and claim_shift_reminders in supabase_schema.sql.
 */
export const ROLES = [
  { code: 'staff', label: 'Staff' },
  { code: 'supervisor', label: 'Supervisor' },
  { code: 'manager', label: 'Manager' }
];

export function roleLabel(code) {
  return ROLES.find(r => r.code === code)?.label || code || '';
}

// Manager pages and actions (accounts, shifts, office, logs of the whole team, ...)
export function canManage(role) {
  return role === 'manager' || role === 'supervisor';
}

// Checks in / out on the phone and gets shift reminders
export function checksIn(role) {
  return role !== 'manager';
}
