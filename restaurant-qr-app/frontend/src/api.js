const API = '/api';

function getToken() {
  return localStorage.getItem('token');
}

export function getGuest() {
  try {
    return JSON.parse(localStorage.getItem('guest') || 'null');
  } catch {
    return null;
  }
}

export function setGuest(data) {
  if (data) localStorage.setItem('guest', JSON.stringify(data));
  else localStorage.removeItem('guest');
}

export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.guestToken) headers['X-Guest-Token'] = options.guestToken;

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers,
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || 'Invalid response' };
  }

  if (!res.ok) {
    const err = new Error(data?.error || data?.message || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const auth = {
  register: (body) => api('/auth/register', { method: 'POST', body }),
  login: (body) => api('/auth/login', { method: 'POST', body }),
  me: () => api('/auth/me'),
};

export const tablesApi = {
  list: () => api('/tables'),
  create: (body) => api('/tables', { method: 'POST', body }),
  remove: (id) => api(`/tables/${id}`, { method: 'DELETE' }),
  qr: (id) => api(`/tables/${id}/qr`),
  seat: (id) => api(`/tables/${id}/seat`, { method: 'POST', body: {} }),
  close: (id) => api(`/tables/${id}/close`, { method: 'POST', body: {} }),
};

export const menuApi = {
  get: () => api('/menu'),
  addCategory: (body) => api('/menu/categories', { method: 'POST', body }),
  deleteCategory: (id) => api(`/menu/categories/${id}`, { method: 'DELETE' }),
  addItem: (body) => api('/menu/items', { method: 'POST', body }),
  updateItem: (id, body) => api(`/menu/items/${id}`, { method: 'PUT', body }),
  deleteItem: (id) => api(`/menu/items/${id}`, { method: 'DELETE' }),
};

export const ordersApi = {
  list: (params = '') => api(`/orders${params}`),
  setStatus: (id, status) => api(`/orders/${id}/status`, { method: 'PATCH', body: { status } }),
};

export const publicApi = {
  table: (slug, code) => api(`/public/${slug}/tables/${code}`),
  join: (slug, code, body) => api(`/public/${slug}/tables/${code}/join`, { method: 'POST', body }),
  menu: (slug) => api(`/public/${slug}/menu`),
  placeOrder: (guestToken, items) =>
    api('/public/orders', { method: 'POST', body: { items }, guestToken }),
  myOrders: (guestToken) => api('/public/orders/mine', { guestToken }),
};
