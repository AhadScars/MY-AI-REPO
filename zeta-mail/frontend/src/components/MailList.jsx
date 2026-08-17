function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function peerLabel(mail, folder) {
  if (folder === 'sent' || folder === 'drafts' || folder === 'scheduled') {
    return mail.recipientEmail || '(no recipient)';
  }
  return mail.senderName || mail.senderEmail || 'Unknown';
}

export default function MailList({ folder, mails, selectedId, onSelect, onDelete, onRefresh }) {
  const titles = {
    inbox: 'Inbox',
    sent: 'Sent',
    drafts: 'Drafts',
    scheduled: 'Scheduled',
  };

  return (
    <section className={`mail-list ${selectedId ? 'has-selection' : ''}`}>
      <div className="mail-list-header">
        <h2>{titles[folder] || folder}</h2>
        <button type="button" className="btn-icon" onClick={onRefresh} title="Refresh">
          ↻
        </button>
      </div>
      {mails.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>No messages in {titles[folder]?.toLowerCase() || folder}</p>
        </div>
      ) : (
        <ul className="mail-rows">
          {mails.map((m) => {
            const preview = stripHtml(m.body).slice(0, 80);
            const when =
              folder === 'scheduled'
                ? m.scheduledAt
                : m.sentAt || m.updatedAt || m.createdAt;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  className={`mail-row ${selectedId === m.id ? 'selected' : ''} ${
                    !m.isRead && folder === 'inbox' ? 'unread' : ''
                  }`}
                  onClick={() => onSelect(m.id)}
                >
                  <span className="mail-peer">{peerLabel(m, folder)}</span>
                  <span className="mail-content">
                    <span className="mail-subject">{m.subject || '(no subject)'}</span>
                    <span className="mail-preview"> — {preview || ' '}</span>
                  </span>
                  <span className="mail-meta">
                    {m.attachments?.length > 0 && (
                      <span className="att-dot" title="Has attachment">
                        📎
                      </span>
                    )}
                    {folder === 'scheduled' && <span className="sched-tag">⏰</span>}
                    <span className="mail-date">{formatDate(when)}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="row-delete"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(m.id);
                  }}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
