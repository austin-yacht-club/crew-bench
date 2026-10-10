export const RC_ROLES = [
  'PRO',
  'Signal boat',
  'Finish boat',
  'Scorer',
  'Safety',
  'Mark-set',
];

export function parseRcRoles(value) {
  if (!value) return [];
  return value.split(',').map((role) => role.trim()).filter(Boolean);
}

export function rcStatusLabel(assignment) {
  if (!assignment) return '';
  if (assignment.status === 'accepted') {
    return assignment.assigned_role ? `Accepted as ${assignment.assigned_role}` : 'Accepted';
  }
  if (assignment.status === 'pending' && assignment.assigned_role) {
    return `Asked to serve as ${assignment.assigned_role}`;
  }
  if (assignment.status === 'pending') return 'Offer pending';
  if (assignment.status === 'declined') return 'Declined';
  if (assignment.status === 'withdrawn') return 'Withdrawn';
  return assignment.status;
}
