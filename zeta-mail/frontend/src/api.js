const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
  return data;
}

export const api = {
  me: () => request('/auth/me'),
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (username, password, displayName) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, displayName }),
    }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  listMails: (folder) => request(`/mails?folder=${encodeURIComponent(folder)}`),
  getMail: (id) => request(`/mails/${id}`),
  saveDraft: (payload) =>
    request('/mails/draft', { method: 'POST', body: JSON.stringify(payload) }),
  sendMail: (payload) =>
    request('/mails/send', { method: 'POST', body: JSON.stringify(payload) }),
  deleteMail: (id) => request(`/mails/${id}`, { method: 'DELETE' }),
  uploadAttachment: async (mailId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request(`/mails/${mailId}/attachments`, { method: 'POST', body: fd });
  },
  removeAttachment: (id) => request(`/attachments/${id}`, { method: 'DELETE' }),
  searchUsers: (q) => request(`/users/search?q=${encodeURIComponent(q)}`),
  counts: () => request('/mails/counts'),
};

/** Save draft when tab closes — uses fetch keepalive so it survives unload */
export function saveDraftBeacon(payload) {
  try {
    const body = JSON.stringify(payload);
    fetch(`${BASE}/mails/draft`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
