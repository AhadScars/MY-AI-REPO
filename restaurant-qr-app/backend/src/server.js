import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { closeExpiredSessions } from './db.js';
import { initSocket } from './socket.js';
import authRoutes from './routes/auth.js';
import restaurantRoutes from './routes/restaurant.js';
import tablesRoutes from './routes/tables.js';
import menuRoutes from './routes/menu.js';
import ordersRoutes from './routes/orders.js';
import publicRoutes from './routes/public.js';

const app = express();
const server = http.createServer(app);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: { origin: [FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'], methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] },
});
initSocket(io);

app.use(cors({ origin: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  closeExpiredSessions();
  res.json({ ok: true, service: 'restaurant-qr-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/tables', tablesRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/public', publicRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// expire sessions every minute
setInterval(() => {
  try {
    closeExpiredSessions();
  } catch (e) {
    console.error('expire job', e);
  }
}, 60_000);

const PORT = Number(process.env.PORT || 4000);
server.listen(PORT, () => {
  console.log(`Restaurant QR API on http://localhost:${PORT}`);
});
