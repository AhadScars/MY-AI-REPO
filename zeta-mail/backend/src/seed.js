import db from './db.js';
import { hashPassword } from './auth.js';

const users = [
  { username: 'alice', displayName: 'Alice Johnson', password: 'password123' },
  { username: 'bob', displayName: 'Bob Smith', password: 'password123' },
  { username: 'carol', displayName: 'Carol Davis', password: 'password123' },
];

const insert = db.prepare(
  `INSERT OR IGNORE INTO users (username, email, password_hash, display_name)
   VALUES (?, ?, ?, ?)`
);

for (const u of users) {
  const email = `${u.username}@zeta.com`;
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!existing) {
    insert.run(u.username, email, hashPassword(u.password), u.displayName);
    console.log(`Created ${email} / ${u.password}`);
  } else {
    console.log(`Exists: ${email}`);
  }
}

// Seed a welcome mail from alice to bob if bob's inbox empty
const alice = db.prepare(`SELECT id FROM users WHERE username = 'alice'`).get();
const bob = db.prepare(`SELECT id FROM users WHERE username = 'bob'`).get();
if (alice && bob) {
  const count = db
    .prepare(`SELECT COUNT(*) as c FROM mails WHERE recipient_id = ? AND status = 'inbox'`)
    .get(bob.id).c;
  if (count === 0) {
    const now = new Date().toISOString();
    const sent = db
      .prepare(
        `INSERT INTO mails (sender_id, recipient_email, recipient_id, subject, body, status, folder, sent_at)
         VALUES (?, 'bob@zeta.com', ?, ?, ?, 'sent', 'sent', ?)`
      )
      .run(
        alice.id,
        bob.id,
        'Welcome to Zeta Mail ✉️',
        `<p>Hi Bob,</p><p>Welcome to <b>Zeta Mail</b> — your @zeta.com inbox.</p>
         <p>You can compose messages, attach files, insert links, schedule sends, and drafts auto-save if you close the window.</p>
         <p>Try replying or writing to <a href="mailto:alice@zeta.com">alice@zeta.com</a>!</p>
         <p>— Alice</p>`,
        now
      );
    db.prepare(
      `INSERT INTO mails (sender_id, recipient_email, recipient_id, subject, body, status, folder, sent_at, parent_id)
       VALUES (?, 'bob@zeta.com', ?, ?, ?, 'inbox', 'inbox', ?, ?)`
    ).run(
      alice.id,
      bob.id,
      'Welcome to Zeta Mail ✉️',
      `<p>Hi Bob,</p><p>Welcome to <b>Zeta Mail</b> — your @zeta.com inbox.</p>
       <p>You can compose messages, attach files, insert links, schedule sends, and drafts auto-save if you close the window.</p>
       <p>Try replying or writing to <a href="mailto:alice@zeta.com">alice@zeta.com</a>!</p>
       <p>— Alice</p>`,
      now,
      sent.lastInsertRowid
    );
    console.log('Seeded welcome mail alice → bob');
  }
}

console.log('Seed complete.');
