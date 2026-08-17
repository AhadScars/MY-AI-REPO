import bcrypt from 'bcryptjs';
import { db, padTableCode } from './db.js';

console.log('Seeding demo restaurant...');

// Clean demo if exists
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('owner@demo.com');
if (existing) {
  const rest = db.prepare('SELECT id FROM restaurants WHERE owner_id = ?').get(existing.id);
  if (rest) {
    db.prepare('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = ?)').run(rest.id);
    db.prepare('DELETE FROM orders WHERE restaurant_id = ?').run(rest.id);
    db.prepare('DELETE FROM table_sessions WHERE restaurant_id = ?').run(rest.id);
    db.prepare('DELETE FROM menu_items WHERE restaurant_id = ?').run(rest.id);
    db.prepare('DELETE FROM menu_categories WHERE restaurant_id = ?').run(rest.id);
    db.prepare('DELETE FROM tables WHERE restaurant_id = ?').run(rest.id);
    db.prepare('DELETE FROM restaurants WHERE id = ?').run(rest.id);
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(existing.id);
}

const hash = bcrypt.hashSync('demo1234', 10);
const userRes = db
  .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
  .run('Demo Owner', 'owner@demo.com', hash);
const ownerId = Number(userRes.lastInsertRowid);

const restRes = db
  .prepare(
    `INSERT INTO restaurants (owner_id, name, slug, phone, address)
     VALUES (?, ?, ?, ?, ?)`
  )
  .run(ownerId, 'Demo Cafe', 'demo-cafe', '9876543210', 'MG Road, City');
const restaurantId = Number(restRes.lastInsertRowid);

for (let i = 1; i <= 5; i++) {
  db.prepare(
    'INSERT INTO tables (restaurant_id, table_number, code, label) VALUES (?, ?, ?, ?)'
  ).run(restaurantId, i, padTableCode(i), `Table ${i}`);
}

const cats = [
  { name: 'Starters', items: [
    { name: 'Veg Spring Roll', description: 'Crispy rolls with veggies', price: 120 },
    { name: 'Paneer Tikka', description: 'Tandoor grilled paneer', price: 220 },
    { name: 'Chicken Wings', description: 'Spicy glazed wings', price: 260 },
  ]},
  { name: 'Mains', items: [
    { name: 'Dal Makhani', description: 'Creamy black lentils', price: 180 },
    { name: 'Butter Chicken', description: 'Classic creamy chicken', price: 280 },
    { name: 'Veg Biryani', description: 'Fragrant basmati rice', price: 200 },
    { name: 'Chicken Biryani', description: 'Hyderabadi style', price: 250 },
  ]},
  { name: 'Breads', items: [
    { name: 'Butter Naan', description: 'Soft buttered naan', price: 50 },
    { name: 'Garlic Naan', description: 'Naan with garlic butter', price: 70 },
    { name: 'Tandoori Roti', description: 'Whole wheat roti', price: 30 },
  ]},
  { name: 'Drinks', items: [
    { name: 'Masala Chai', description: 'Hot spiced tea', price: 40 },
    { name: 'Fresh Lime Soda', description: 'Sweet / salt', price: 60 },
    { name: 'Cold Coffee', description: 'Iced coffee', price: 120 },
  ]},
];

cats.forEach((c, ci) => {
  const catRes = db
    .prepare('INSERT INTO menu_categories (restaurant_id, name, sort_order) VALUES (?, ?, ?)')
    .run(restaurantId, c.name, ci);
  const catId = Number(catRes.lastInsertRowid);
  c.items.forEach((item, ii) => {
    db.prepare(
      `INSERT INTO menu_items (restaurant_id, category_id, name, description, price, is_available, sort_order)
       VALUES (?, ?, ?, ?, ?, 1, ?)`
    ).run(restaurantId, catId, item.name, item.description, item.price, ii);
  });
});

console.log('✅ Seed complete');
console.log('   Login: owner@demo.com / demo1234');
console.log('   Restaurant slug: demo-cafe');
console.log('   Tables: T01 – T05');
console.log('   Customer URL example: http://localhost:5173/t/demo-cafe/T01');
console.log('   Remember: Seat the table from owner dashboard before ordering!');
