const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const defaultDb = () => ({
  users: [],
  banks: [],
  transactions: [],
});

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const db = seed(defaultDb());
    save(db);
    return db;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function save(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function seed(db) {
  const passwordHash = bcrypt.hashSync('demo123', 8);

  const demoUsers = [
    {
      id: 'u1',
      name: 'Shoaib Qazi',
      phone: '9876543210',
      email: 'shoaib@demo.com',
      username: 'shoaib',
      upiId: 'shoaib@payflow',
      passwordHash,
      walletBalance: 5000,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'u2',
      name: 'Priya Sharma',
      phone: '9123456780',
      email: 'priya@demo.com',
      username: 'priya',
      upiId: 'priya@payflow',
      passwordHash,
      walletBalance: 3200,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'u3',
      name: 'Rahul Verma',
      phone: '9988776655',
      email: 'rahul@demo.com',
      username: 'rahul',
      upiId: 'rahul@okaxis',
      passwordHash,
      walletBalance: 1500,
      createdAt: new Date().toISOString(),
    },
  ];

  db.users = demoUsers;

  db.banks = [
    {
      id: 'b1',
      userId: 'u1',
      bankName: 'HDFC Bank',
      accountNumber: '50100234567890',
      ifsc: 'HDFC0001234',
      accountHolder: 'Shoaib Qazi',
      accountType: 'Savings',
      balance: 45000,
      isPrimary: true,
      linkedAt: new Date().toISOString(),
    },
    {
      id: 'b2',
      userId: 'u1',
      bankName: 'SBI',
      accountNumber: '30123456789',
      ifsc: 'SBIN0000456',
      accountHolder: 'Shoaib Qazi',
      accountType: 'Savings',
      balance: 12000,
      isPrimary: false,
      linkedAt: new Date().toISOString(),
    },
    {
      id: 'b3',
      userId: 'u2',
      bankName: 'ICICI Bank',
      accountNumber: '001234567890',
      ifsc: 'ICIC0000789',
      accountHolder: 'Priya Sharma',
      accountType: 'Savings',
      balance: 28000,
      isPrimary: true,
      linkedAt: new Date().toISOString(),
    },
    {
      id: 'b4',
      userId: 'u3',
      bankName: 'Axis Bank',
      accountNumber: '912010012345678',
      ifsc: 'UTIB0000123',
      accountHolder: 'Rahul Verma',
      accountType: 'Current',
      balance: 8500,
      isPrimary: true,
      linkedAt: new Date().toISOString(),
    },
  ];

  db.transactions = [
    {
      id: uuidv4(),
      fromUserId: 'u2',
      toUserId: 'u1',
      amount: 500,
      type: 'upi',
      method: 'UPI',
      status: 'success',
      note: 'Dinner split',
      toIdentifier: 'shoaib@payflow',
      fromName: 'Priya Sharma',
      toName: 'Shoaib Qazi',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: uuidv4(),
      fromUserId: 'u1',
      toUserId: 'u3',
      amount: 250,
      type: 'username',
      method: 'Username',
      status: 'success',
      note: 'Cab fare',
      toIdentifier: '@rahul',
      fromName: 'Shoaib Qazi',
      toName: 'Rahul Verma',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  return db;
}

function read() {
  return ensureDb();
}

function write(mutator) {
  const db = ensureDb();
  mutator(db);
  save(db);
  return db;
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    email: u.email,
    username: u.username,
    upiId: u.upiId,
    walletBalance: u.walletBalance,
    createdAt: u.createdAt,
  };
}

module.exports = { read, write, publicUser, uuidv4 };
