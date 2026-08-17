function formatFull(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString();
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MailView({ mail, folder, onClose, onReply, onDelete }) {
  return (
    <section className="mail-view">
      <div className="mail-view-toolbar">
        <button type="button" className="btn-ghost" onClick={onClose}>
          ← Back
        </button>
        <div className="toolbar-actions">
          {folder === 'inbox' && (
            <button type="button" className="btn-secondary" onClick={onReply}>
              Reply
            </button>
          )}
          <button type="button" className="btn-ghost danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
      <div className="mail-view-body">
        <h1 className="mail-view-subject">{mail.subject || '(no subject)'}</h1>
        <div className="mail-view-headers">
          <div className="avatar lg">
            {(mail.senderName || mail.senderEmail || '?')[0].toUpperCase()}
          </div>
          <div>
            <div className="from-line">
              <strong>{mail.senderName || mail.senderEmail}</strong>
              {mail.senderEmail && (
                <span className="muted"> &lt;{mail.senderEmail}&gt;</span>
              )}
            </div>
            <div className="to-line muted">
              to {mail.recipientEmail}
              <span className="dot-sep">·</span>
              {formatFull(mail.sentAt || mail.createdAt)}
            </div>
          </div>
        </div>

        <div
          className="mail-html"
          dangerouslySetInnerHTML={{ __html: mail.body || '<p></p>' }}
        />

        {mail.attachments?.length > 0 && (
          <div className="attachments-block">
            <h3>Attachments ({mail.attachments.length})</h3>
            <ul>
              {mail.attachments.map((a) => (
                <li key={a.id}>
                  <a
                    href={`/api/attachments/${a.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    📎 {a.originalName}
                  </a>
                  <span className="muted"> ({formatBytes(a.size)})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
