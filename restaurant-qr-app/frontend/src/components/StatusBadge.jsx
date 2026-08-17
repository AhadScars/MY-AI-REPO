const MAP = {
  free: { label: 'Free', cls: 'badge-muted' },
  seated: { label: 'Seated', cls: 'badge-warn' },
  active: { label: 'Active', cls: 'badge-ok' },
  pending: { label: 'Pending', cls: 'badge-warn' },
  accepted: { label: 'Accepted', cls: 'badge-info' },
  preparing: { label: 'Preparing', cls: 'badge-info' },
  served: { label: 'Served', cls: 'badge-ok' },
  cancelled: { label: 'Cancelled', cls: 'badge-danger' },
  closed: { label: 'Closed', cls: 'badge-muted' },
};

export default function StatusBadge({ status }) {
  const m = MAP[status] || { label: status, cls: 'badge-muted' };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}
