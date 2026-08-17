import db from './db.js';

function mapMail(row) {
  if (!row) return null;
  const attachments = db
    .prepare(
      `SELECT id, original_name as originalName, mime_type as mimeType, size
       FROM attachments WHERE mail_id = ?`
    )
    .all(row.id);

  return {
    id: row.id,
    senderId: row.sender_id,
    senderEmail: row.sender_email || null,
    senderName: row.sender_name || null,
    recipientEmail: row.recipient_email,
    recipientId: row.recipient_id,
    subject: row.subject,
    body: row.body,
    status: row.status,
    folder: row.folder,
    isRead: !!row.is_read,
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attachments,
  };
}

const SELECT_BASE = `
  SELECT m.*,
    su.email as sender_email,
    su.display_name as sender_name
  FROM mails m
  LEFT JOIN users su ON su.id = m.sender_id
`;

export function listMails(userId, folder) {
  let rows;
  if (folder === 'inbox') {
    rows = db
      .prepare(
        `${SELECT_BASE}
         WHERE m.recipient_id = ? AND m.status = 'inbox'
         ORDER BY COALESCE(m.sent_at, m.created_at) DESC`
      )
      .all(userId);
  } else if (folder === 'sent') {
    rows = db
      .prepare(
        `${SELECT_BASE}
         WHERE m.sender_id = ? AND m.status = 'sent'
         ORDER BY COALESCE(m.sent_at, m.created_at) DESC`
      )
      .all(userId);
  } else if (folder === 'drafts') {
    rows = db
      .prepare(
        `${SELECT_BASE}
         WHERE m.sender_id = ? AND m.status = 'draft'
         ORDER BY m.updated_at DESC`
      )
      .all(userId);
  } else if (folder === 'scheduled') {
    rows = db
      .prepare(
        `${SELECT_BASE}
         WHERE m.sender_id = ? AND m.status = 'scheduled'
         ORDER BY m.scheduled_at ASC`
      )
      .all(userId);
  } else {
    rows = [];
  }
  return rows.map(mapMail);
}

export function getMail(id, userId) {
  const row = db.prepare(`${SELECT_BASE} WHERE m.id = ?`).get(id);
  if (!row) return null;
  if (row.sender_id !== userId && row.recipient_id !== userId) return null;
  return mapMail(row);
}

export function getFolderCounts(userId) {
  const inbox = db
    .prepare(`SELECT COUNT(*) as c FROM mails WHERE recipient_id = ? AND status = 'inbox'`)
    .get(userId).c;
  const unread = db
    .prepare(
      `SELECT COUNT(*) as c FROM mails WHERE recipient_id = ? AND status = 'inbox' AND is_read = 0`
    )
    .get(userId).c;
  const sent = db
    .prepare(`SELECT COUNT(*) as c FROM mails WHERE sender_id = ? AND status = 'sent'`)
    .get(userId).c;
  const drafts = db
    .prepare(`SELECT COUNT(*) as c FROM mails WHERE sender_id = ? AND status = 'draft'`)
    .get(userId).c;
  const scheduled = db
    .prepare(`SELECT COUNT(*) as c FROM mails WHERE sender_id = ? AND status = 'scheduled'`)
    .get(userId).c;
  return { inbox, unread, sent, drafts, scheduled };
}

export function saveDraft(userId, data) {
  const {
    id,
    recipientEmail = '',
    subject = '',
    body = '',
  } = data;

  let email = (recipientEmail || '').trim().toLowerCase();
  if (email && !email.includes('@')) email = `${email}@zeta.com`;
  const recipient = email
    ? db.prepare('SELECT id, email FROM users WHERE lower(email) = ?').get(email)
    : null;
  const resolvedEmail = email || '';
  const recipientId = recipient?.id || null;

  if (id) {
    const existing = db.prepare('SELECT * FROM mails WHERE id = ? AND sender_id = ?').get(id, userId);
    if (!existing || (existing.status !== 'draft' && existing.status !== 'scheduled')) {
      return null;
    }
    db.prepare(
      `UPDATE mails SET recipient_email = ?, recipient_id = ?, subject = ?, body = ?, status = 'draft',
       scheduled_at = NULL, updated_at = datetime('now') WHERE id = ?`
    ).run(resolvedEmail, recipientId, subject, body, id);
    return getMail(id, userId);
  }

  const result = db
    .prepare(
      `INSERT INTO mails (sender_id, recipient_email, recipient_id, subject, body, status, folder)
       VALUES (?, ?, ?, ?, ?, 'draft', 'drafts')`
    )
    .run(userId, resolvedEmail, recipientId, subject, body);
  return getMail(result.lastInsertRowid, userId);
}

function resolveRecipient(email) {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return { email: '', id: null };
  const user = db.prepare('SELECT id, email FROM users WHERE lower(email) = ?').get(normalized);
  return { email: normalized, id: user?.id || null };
}

export function sendMail(userId, data) {
  const { id, recipientEmail, subject = '', body = '', scheduledAt = null } = data;
  const recipient = resolveRecipient(recipientEmail);

  if (!recipient.email) {
    throw new Error('Recipient email is required');
  }
  if (!recipient.email.endsWith('@zeta.com')) {
    // Allow only zeta.com for this demo mail system, or allow any and only deliver if local
  }

  if (scheduledAt) {
    const when = new Date(scheduledAt);
    if (isNaN(when.getTime()) || when <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }
    return scheduleMail(userId, {
      id,
      recipientEmail: recipient.email,
      subject,
      body,
      scheduledAt: when.toISOString(),
      recipientId: recipient.id,
    });
  }

  // Update draft or create new sent + inbox copies
  let draftId = id;
  if (draftId) {
    const existing = db
      .prepare('SELECT * FROM mails WHERE id = ? AND sender_id = ?')
      .get(draftId, userId);
    if (!existing || !['draft', 'scheduled'].includes(existing.status)) {
      draftId = null;
    }
  }

  const now = new Date().toISOString();
  let sentId;
  if (draftId) {
    db.prepare(
      `UPDATE mails SET recipient_email = ?, recipient_id = ?, subject = ?, body = ?,
       status = 'sent', folder = 'sent', scheduled_at = NULL, sent_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(recipient.email, recipient.id, subject, body, now, now, draftId);
    sentId = draftId;
  } else {
    const r = db
      .prepare(
        `INSERT INTO mails (sender_id, recipient_email, recipient_id, subject, body, status, folder, sent_at)
         VALUES (?, ?, ?, ?, ?, 'sent', 'sent', ?)`
      )
      .run(userId, recipient.email, recipient.id, subject, body, now);
    sentId = r.lastInsertRowid;
  }

  // Deliver to recipient inbox if they exist on zeta.com
  if (recipient.id) {
    db.prepare(
      `INSERT INTO mails (sender_id, recipient_email, recipient_id, subject, body, status, folder, sent_at, parent_id)
       VALUES (?, ?, ?, ?, ?, 'inbox', 'inbox', ?, ?)`
    ).run(userId, recipient.email, recipient.id, subject, body, now, sentId);

    const atts = db.prepare('SELECT * FROM attachments WHERE mail_id = ?').all(sentId);
    const inboxMail = db
      .prepare(
        `SELECT id FROM mails WHERE parent_id = ? AND recipient_id = ? AND status = 'inbox' ORDER BY id DESC LIMIT 1`
      )
      .get(sentId, recipient.id);
    if (inboxMail) {
      for (const a of atts) {
        db.prepare(
          `INSERT INTO attachments (mail_id, original_name, stored_name, mime_type, size)
           VALUES (?, ?, ?, ?, ?)`
        ).run(inboxMail.id, a.original_name, a.stored_name, a.mime_type, a.size);
      }
    }
  }

  return getMail(sentId, userId);
}

function scheduleMail(userId, { id, recipientEmail, subject, body, scheduledAt, recipientId }) {
  if (id) {
    const existing = db.prepare('SELECT * FROM mails WHERE id = ? AND sender_id = ?').get(id, userId);
    if (existing && ['draft', 'scheduled'].includes(existing.status)) {
      db.prepare(
        `UPDATE mails SET recipient_email = ?, recipient_id = ?, subject = ?, body = ?,
         status = 'scheduled', folder = 'scheduled', scheduled_at = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(recipientEmail, recipientId, subject, body, scheduledAt, id);
      return getMail(id, userId);
    }
  }
  const r = db
    .prepare(
      `INSERT INTO mails (sender_id, recipient_email, recipient_id, subject, body, status, folder, scheduled_at)
       VALUES (?, ?, ?, ?, ?, 'scheduled', 'scheduled', ?)`
    )
    .run(userId, recipientEmail, recipientId, subject, body, scheduledAt);
  return getMail(r.lastInsertRowid, userId);
}

export function processScheduledMails() {
  const due = db
    .prepare(
      `SELECT * FROM mails WHERE status = 'scheduled' AND scheduled_at <= datetime('now')`
    )
    .all();

  for (const mail of due) {
    try {
      sendMail(mail.sender_id, {
        id: mail.id,
        recipientEmail: mail.recipient_email,
        subject: mail.subject,
        body: mail.body,
        scheduledAt: null,
      });
    } catch (e) {
      console.error('Failed to send scheduled mail', mail.id, e.message);
    }
  }
  return due.length;
}

export function markRead(id, userId) {
  db.prepare(
    `UPDATE mails SET is_read = 1 WHERE id = ? AND recipient_id = ? AND status = 'inbox'`
  ).run(id, userId);
  return getMail(id, userId);
}

export function deleteMail(id, userId) {
  const mail = db.prepare('SELECT * FROM mails WHERE id = ?').get(id);
  if (!mail) return false;
  if (mail.sender_id !== userId && mail.recipient_id !== userId) return false;
  // Only delete if user owns it in that folder context
  if (mail.sender_id === userId || mail.recipient_id === userId) {
    db.prepare('DELETE FROM mails WHERE id = ?').run(id);
    return true;
  }
  return false;
}

export function addAttachment(mailId, userId, file) {
  const mail = db.prepare('SELECT * FROM mails WHERE id = ? AND sender_id = ?').get(mailId, userId);
  if (!mail || !['draft', 'scheduled'].includes(mail.status)) {
    throw new Error('Can only attach to drafts or scheduled mails');
  }
  const r = db
    .prepare(
      `INSERT INTO attachments (mail_id, original_name, stored_name, mime_type, size)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(mailId, file.originalname, file.filename, file.mimetype, file.size);
  return {
    id: r.lastInsertRowid,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
}

export function removeAttachment(attId, userId) {
  const row = db
    .prepare(
      `SELECT a.*, m.sender_id, m.status FROM attachments a
       JOIN mails m ON m.id = a.mail_id WHERE a.id = ?`
    )
    .get(attId);
  if (!row || row.sender_id !== userId || !['draft', 'scheduled'].includes(row.status)) {
    return null;
  }
  db.prepare('DELETE FROM attachments WHERE id = ?').run(attId);
  return row;
}
