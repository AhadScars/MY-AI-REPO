import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import db, { uploadsDir } from './db.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  requireAuth,
  toPublicUser,
} from './auth.js';
import {
  listMails,
  getMail,
  getFolderCounts,
  saveDraft,
  sendMail,
  processScheduledMails,
  markRead,
  deleteMail,
  addAttachment,
  removeAttachment,
} from './mailService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const app = express();

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173'],
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

function setSessionCookie(res, token) {
  res.cookie('zeta_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// ── Auth ──────────────────────────────────────────────
app.post('/api/auth/register', (req, res) => {
  try {
    let { username, password, displayName } = req.body || {};
    username = (username || '').trim().toLowerCase().replace(/@zeta\.com$/i, '');
    if (!username || !/^[a-z0-9._-]{2,32}$/.test(username)) {
      return res.status(400).json({
        error: 'Username must be 2–32 chars: letters, numbers, . _ -',
      });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    displayName = (displayName || username).trim();
    const email = `${username}@zeta.com`;
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    const result = db
      .prepare(
        `INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)`
      )
      .run(username, email, hashPassword(password), displayName);
    const user = {
      id: result.lastInsertRowid,
      username,
      email,
      displayName,
    };
    const { token } = createSession(user.id);
    setSessionCookie(res, token);
    res.json({ user: toPublicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    let { email, password } = req.body || {};
    email = (email || '').trim().toLowerCase();
    if (!email.includes('@')) email = `${email}@zeta.com`;
    const row = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(email);
    if (!row || !verifyPassword(password || '', row.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const user = {
      id: row.id,
      username: row.username,
      email: row.email,
      displayName: row.display_name,
    };
    const { token } = createSession(user.id);
    setSessionCookie(res, token);
    res.json({ user: toPublicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.zeta_session;
  destroySession(token);
  res.clearCookie('zeta_session');
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

// ── Mails ─────────────────────────────────────────────
app.get('/api/mails', requireAuth, (req, res) => {
  const folder = (req.query.folder || 'inbox').toString();
  const allowed = ['inbox', 'sent', 'drafts', 'scheduled'];
  if (!allowed.includes(folder)) {
    return res.status(400).json({ error: 'Invalid folder' });
  }
  res.json({
    mails: listMails(req.user.id, folder),
    counts: getFolderCounts(req.user.id),
  });
});

app.get('/api/mails/counts', requireAuth, (req, res) => {
  res.json(getFolderCounts(req.user.id));
});

app.get('/api/mails/:id', requireAuth, (req, res) => {
  const mail = getMail(Number(req.params.id), req.user.id);
  if (!mail) return res.status(404).json({ error: 'Mail not found' });
  if (mail.recipientId === req.user.id && mail.status === 'inbox' && !mail.isRead) {
    markRead(mail.id, req.user.id);
    mail.isRead = true;
  }
  res.json({ mail });
});

app.post('/api/mails/draft', requireAuth, (req, res) => {
  try {
    const mail = saveDraft(req.user.id, req.body || {});
    if (!mail) return res.status(400).json({ error: 'Could not save draft' });
    res.json({ mail });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

// Beacon / sendBeacon friendly draft save (text body)
app.post('/api/mails/draft-beacon', requireAuth, express.text({ type: '*/*', limit: '2mb' }), (req, res) => {
  try {
    let data = req.body;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        data = {};
      }
    }
    const mail = saveDraft(req.user.id, data || {});
    res.json({ ok: true, mail });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

app.post('/api/mails/send', requireAuth, (req, res) => {
  try {
    const mail = sendMail(req.user.id, req.body || {});
    res.json({ mail, counts: getFolderCounts(req.user.id) });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Send failed' });
  }
});

app.delete('/api/mails/:id', requireAuth, (req, res) => {
  const ok = deleteMail(Number(req.params.id), req.user.id);
  if (!ok) return res.status(404).json({ error: 'Mail not found' });
  res.json({ ok: true, counts: getFolderCounts(req.user.id) });
});

app.post('/api/mails/:id/attachments', requireAuth, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const att = addAttachment(Number(req.params.id), req.user.id, req.file);
    res.json({ attachment: att, mail: getMail(Number(req.params.id), req.user.id) });
  } catch (e) {
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
    }
    res.status(400).json({ error: e.message || 'Upload failed' });
  }
});

app.delete('/api/attachments/:id', requireAuth, (req, res) => {
  const row = removeAttachment(Number(req.params.id), req.user.id);
  if (!row) return res.status(404).json({ error: 'Attachment not found' });
  const filePath = path.join(uploadsDir, row.stored_name);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
  res.json({ ok: true });
});

app.get('/api/attachments/:id/download', requireAuth, (req, res) => {
  const row = db
    .prepare(
      `SELECT a.*, m.sender_id, m.recipient_id FROM attachments a
       JOIN mails m ON m.id = a.mail_id WHERE a.id = ?`
    )
    .get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.sender_id !== req.user.id && row.recipient_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const filePath = path.join(uploadsDir, row.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });
  res.download(filePath, row.original_name);
});

// Users lookup for compose autocomplete
app.get('/api/users/search', requireAuth, (req, res) => {
  const q = (req.query.q || '').toString().trim().toLowerCase();
  if (!q || q.length < 1) return res.json({ users: [] });
  const users = db
    .prepare(
      `SELECT id, username, email, display_name as displayName FROM users
       WHERE id != ? AND (lower(email) LIKE ? OR lower(username) LIKE ? OR lower(display_name) LIKE ?)
       LIMIT 10`
    )
    .all(req.user.id, `%${q}%`, `%${q}%`, `%${q}%`);
  res.json({ users });
});

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'zeta-mail' });
});

// Process scheduled mails every 30s
setInterval(() => {
  try {
    const n = processScheduledMails();
    if (n > 0) console.log(`Sent ${n} scheduled mail(s)`);
  } catch (e) {
    console.error('Scheduler error', e);
  }
}, 30000);

// Also run once on startup
processScheduledMails();

app.listen(PORT, () => {
  console.log(`Zeta Mail API running on http://localhost:${PORT}`);
});
