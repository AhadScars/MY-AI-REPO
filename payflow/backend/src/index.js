const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { read, write, publicUser, uuidv4 } = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'payflow-demo-secret-change-me';

app.use(cors());
app.use(express.json());

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function maskAccount(num) {
  const s = String(num);
  return 'XXXX' + s.slice(-4);
}

function findUserByIdentifier(db, identifier) {
  if (!identifier) return null;
  const id = String(identifier).trim().toLowerCase();
  const bare = id.replace(/^@/, '');
  return (
    db.users.find((u) => u.username.toLowerCase() === bare) ||
    db.users.find((u) => u.upiId.toLowerCase() === id) ||
    db.users.find((u) => u.phone === identifier.trim()) ||
    db.users.find((u) => u.email.toLowerCase() === id)
  );
}

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'PayFlow', mode: 'demo' });
});

// Auth
app.post('/api/auth/register', (req, res) => {
  const { name, phone, email, username, password } = req.body || {};
  if (!name || !phone || !username || !password) {
    return res.status(400).json({ error: 'Name, phone, username and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  let created;
  try {
    write((db) => {
      if (db.users.some((u) => u.phone === phone)) throw new Error('Phone already registered');
      if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
        throw new Error('Username already taken');
      }
      const user = {
        id: uuidv4(),
        name: name.trim(),
        phone: String(phone).trim(),
        email: (email || '').trim(),
        username: username.trim().toLowerCase().replace(/[^a-z0-9._]/g, ''),
        upiId: `${username.trim().toLowerCase().replace(/[^a-z0-9._]/g, '')}@payflow`,
        passwordHash: bcrypt.hashSync(password, 8),
        walletBalance: 1000,
        createdAt: new Date().toISOString(),
      };
      db.users.push(user);
      created = user;
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const token = jwt.sign({ id: created.id, username: created.username }, JWT_SECRET, {
    expiresIn: '7d',
  });
  res.json({ token, user: publicUser(created) });
});

app.post('/api/auth/login', (req, res) => {
  const { phoneOrUsername, password } = req.body || {};
  if (!phoneOrUsername || !password) {
    return res.status(400).json({ error: 'Credentials required' });
  }
  const db = read();
  const key = String(phoneOrUsername).trim().toLowerCase().replace(/^@/, '');
  const user = db.users.find(
    (u) =>
      u.phone === phoneOrUsername.trim() ||
      u.username.toLowerCase() === key ||
      u.email.toLowerCase() === key
  );
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid phone/username or password' });
  }
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: '7d',
  });
  res.json({ token, user: publicUser(user) });
});

app.get('/api/me', auth, (req, res) => {
  const db = read();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(user) });
});

// Lookup recipient
app.get('/api/users/lookup', auth, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Query required' });
  const db = read();
  const user = findUserByIdentifier(db, q);
  if (!user || user.id === req.user.id) {
    return res.status(404).json({ error: 'No user found for that username / UPI / phone' });
  }
  res.json({
    id: user.id,
    name: user.name,
    username: user.username,
    upiId: user.upiId,
    phone: user.phone.replace(/(\d{2})\d{6}(\d{2})/, '$1******$2'),
  });
});

// Banks
app.get('/api/banks', auth, (req, res) => {
  const db = read();
  const banks = db.banks
    .filter((b) => b.userId === req.user.id)
    .map((b) => ({
      ...b,
      accountNumberMasked: maskAccount(b.accountNumber),
      accountNumber: undefined,
    }));
  res.json({ banks });
});

app.post('/api/banks/link', auth, (req, res) => {
  const { bankName, accountNumber, ifsc, accountHolder, accountType, balance } = req.body || {};
  if (!bankName || !accountNumber || !ifsc || !accountHolder) {
    return res.status(400).json({ error: 'Bank name, account number, IFSC and holder name required' });
  }
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifsc.trim())) {
    return res.status(400).json({ error: 'Invalid IFSC format (e.g. HDFC0001234)' });
  }
  if (String(accountNumber).replace(/\s/g, '').length < 8) {
    return res.status(400).json({ error: 'Invalid account number' });
  }

  let bank;
  write((db) => {
    const existing = db.banks.filter((b) => b.userId === req.user.id);
    bank = {
      id: uuidv4(),
      userId: req.user.id,
      bankName: bankName.trim(),
      accountNumber: String(accountNumber).replace(/\s/g, ''),
      ifsc: ifsc.trim().toUpperCase(),
      accountHolder: accountHolder.trim(),
      accountType: accountType || 'Savings',
      balance: Number(balance) >= 0 ? Number(balance) : 10000,
      isPrimary: existing.length === 0,
      linkedAt: new Date().toISOString(),
    };
    db.banks.push(bank);
  });

  res.json({
    bank: {
      ...bank,
      accountNumberMasked: maskAccount(bank.accountNumber),
      accountNumber: undefined,
    },
  });
});

app.post('/api/banks/:id/primary', auth, (req, res) => {
  write((db) => {
    db.banks.forEach((b) => {
      if (b.userId === req.user.id) b.isPrimary = b.id === req.params.id;
    });
  });
  res.json({ ok: true });
});

app.delete('/api/banks/:id', auth, (req, res) => {
  write((db) => {
    db.banks = db.banks.filter((b) => !(b.id === req.params.id && b.userId === req.user.id));
  });
  res.json({ ok: true });
});

// Wallet top-up from bank
app.post('/api/wallet/add', auth, (req, res) => {
  const amount = Number(req.body?.amount);
  const bankId = req.body?.bankId;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  let result;
  try {
    write((db) => {
      const user = db.users.find((u) => u.id === req.user.id);
      const bank = db.banks.find((b) => b.userId === req.user.id && (bankId ? b.id === bankId : b.isPrimary));
      if (!bank) throw new Error('Link a bank account first');
      if (bank.balance < amount) throw new Error('Insufficient bank balance');
      bank.balance -= amount;
      user.walletBalance += amount;
      const tx = {
        id: uuidv4(),
        fromUserId: req.user.id,
        toUserId: req.user.id,
        amount,
        type: 'topup',
        method: 'Bank → Wallet',
        status: 'success',
        note: `Added from ${bank.bankName}`,
        toIdentifier: 'Wallet',
        fromName: user.name,
        toName: user.name,
        createdAt: new Date().toISOString(),
      };
      db.transactions.unshift(tx);
      result = { walletBalance: user.walletBalance, transaction: tx };
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  res.json(result);
});

// Pay: username | upi | bank
app.post('/api/pay', auth, (req, res) => {
  const { type, to, amount, note, pin, bankId } = req.body || {};
  const amt = Number(amount);

  if (!['username', 'upi', 'bank'].includes(type)) {
    return res.status(400).json({ error: 'type must be username, upi, or bank' });
  }
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Enter a valid amount' });
  if (amt > 100000) return res.status(400).json({ error: 'Max transfer limit is ₹1,00,000 per txn' });
  // Demo PIN: any 4–6 digits accepted; default demo pin 1234
  if (!pin || !/^\d{4,6}$/.test(String(pin))) {
    return res.status(400).json({ error: 'Enter 4–6 digit UPI PIN (demo: 1234)' });
  }

  let result;
  try {
    write((db) => {
      const sender = db.users.find((u) => u.id === req.user.id);
      if (!sender) throw new Error('Sender not found');

      let receiver = null;
      let toIdentifier = to;
      let method = '';
      let payFromBank = false;

      if (type === 'username') {
        method = 'Username';
        receiver = findUserByIdentifier(db, to?.startsWith('@') ? to : `@${to}`);
        if (!receiver) throw new Error('Username not found. Try @priya or @rahul');
        toIdentifier = `@${receiver.username}`;
      } else if (type === 'upi') {
        method = 'UPI';
        if (!to || !String(to).includes('@')) throw new Error('Enter a valid UPI ID (name@bank)');
        receiver = findUserByIdentifier(db, to);
        if (!receiver) throw new Error('UPI ID not registered on PayFlow demo. Try priya@payflow or rahul@okaxis');
        toIdentifier = receiver.upiId;
      } else if (type === 'bank') {
        method = 'Bank Transfer';
        const { accountNumber, ifsc, accountHolder } = req.body;
        if (!accountNumber || !ifsc) throw new Error('Account number and IFSC required');
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(String(ifsc).trim())) {
          throw new Error('Invalid IFSC');
        }
        // Match linked bank of another user, or create external credit simulation
        receiver = null;
        const targetBank = db.banks.find(
          (b) =>
            b.accountNumber === String(accountNumber).replace(/\s/g, '') &&
            b.ifsc.toUpperCase() === String(ifsc).trim().toUpperCase()
        );
        if (targetBank) {
          receiver = db.users.find((u) => u.id === targetBank.userId);
        }
        toIdentifier = `${accountHolder || 'Beneficiary'} · ${maskAccount(accountNumber)}`;
        payFromBank = true;
      }

      if (receiver && receiver.id === sender.id) {
        throw new Error('Cannot pay yourself');
      }

      // Debit source
      if (payFromBank || type === 'bank') {
        const bank = db.banks.find(
          (b) => b.userId === sender.id && (bankId ? b.id === bankId : b.isPrimary)
        );
        if (!bank) throw new Error('Link a bank account to send bank transfers');
        if (bank.balance < amt) throw new Error('Insufficient bank balance');
        bank.balance -= amt;
        if (receiver) {
          const recvBank = db.banks.find((b) => b.userId === receiver.id && b.isPrimary);
          if (recvBank) recvBank.balance += amt;
          else receiver.walletBalance += amt;
        }
      } else {
        if (sender.walletBalance < amt) throw new Error('Insufficient wallet balance. Add money first.');
        sender.walletBalance -= amt;
        if (receiver) receiver.walletBalance += amt;
      }

      const tx = {
        id: uuidv4(),
        fromUserId: sender.id,
        toUserId: receiver?.id || null,
        amount: amt,
        type,
        method,
        status: 'success',
        note: (note || '').trim() || null,
        toIdentifier,
        fromName: sender.name,
        toName: receiver?.name || (req.body.accountHolder || 'External account'),
        createdAt: new Date().toISOString(),
      };
      db.transactions.unshift(tx);
      result = {
        transaction: tx,
        walletBalance: sender.walletBalance,
      };
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  res.json(result);
});

// Transactions
app.get('/api/transactions', auth, (req, res) => {
  const db = read();
  const list = db.transactions
    .filter((t) => t.fromUserId === req.user.id || t.toUserId === req.user.id)
    .map((t) => ({
      ...t,
      direction: t.type === 'topup' ? 'in' : t.fromUserId === req.user.id ? 'out' : 'in',
    }));
  res.json({ transactions: list });
});

// Demo contacts (other users)
app.get('/api/contacts', auth, (req, res) => {
  const db = read();
  const contacts = db.users
    .filter((u) => u.id !== req.user.id)
    .map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      upiId: u.upiId,
    }));
  res.json({ contacts });
});

app.listen(PORT, () => {
  console.log(`PayFlow API running on http://localhost:${PORT}`);
  console.log('Demo login: phone 9876543210 / password demo123');
});
