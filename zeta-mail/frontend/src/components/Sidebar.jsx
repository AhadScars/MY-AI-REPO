const FOLDERS = [
  { id: 'inbox', label: 'Inbox', icon: '📥' },
  { id: 'sent', label: 'Sent', icon: '✈️' },
  { id: 'drafts', label: 'Drafts', icon: '📝' },
  { id: 'scheduled', label: 'Scheduled', icon: '⏰' },
];

export default function Sidebar({ folder, counts, onFolder, onCompose }) {
  return (
    <aside className="sidebar">
      <button type="button" className="compose-btn" onClick={onCompose}>
        <span className="compose-plus">+</span> Compose
      </button>
      <nav className="folder-nav">
        {FOLDERS.map((f) => {
          let badge = null;
          if (f.id === 'inbox' && counts.unread > 0) badge = counts.unread;
          else if (f.id === 'drafts' && counts.drafts > 0) badge = counts.drafts;
          else if (f.id === 'scheduled' && counts.scheduled > 0) badge = counts.scheduled;

          return (
            <button
              key={f.id}
              type="button"
              className={`folder-item ${folder === f.id ? 'active' : ''}`}
              onClick={() => onFolder(f.id)}
            >
              <span className="folder-icon">{f.icon}</span>
              <span className="folder-label">{f.label}</span>
              {badge != null && <span className="folder-badge">{badge}</span>}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="domain-pill">@zeta.com</div>
      </div>
    </aside>
  );
}
