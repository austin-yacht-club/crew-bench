import axios from 'axios';

/**
 * Resolve the axios base URL.
 *
 * First-class (Docker / production): runtime `window.__CREW_BENCH_CONFIG__.apiBasePath`
 * written by the frontend container from `API_BASE_PATH` on every start — no rebuild needed.
 *   API_BASE_PATH=/api       default (host forwards /api to backend, or all traffic via frontend nginx)
 *   API_BASE_PATH=/api/api   only when an outer proxy strips one /api before the backend
 *
 * Fallback (local CRA): REACT_APP_API_URL — empty → /api; unset in development → http://localhost:8000/api
 */
function resolveApiBaseURL() {
  if (typeof window !== 'undefined') {
    const runtime = window.__CREW_BENCH_CONFIG__?.apiBasePath;
    if (typeof runtime === 'string' && runtime.trim()) {
      return runtime.replace(/\/$/, '');
    }
  }

  const env = process.env.REACT_APP_API_URL;
  if (env !== undefined && env !== null) {
    if (env === '') {
      return '/api';
    }
    return `${env.replace(/\/$/, '')}/api`;
  }

  if (process.env.NODE_ENV === 'production') {
    return '/api';
  }
  return 'http://localhost:8000/api';
}

const api = axios.create({
  baseURL: resolveApiBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const getAPIErrorMessage = (error, fallback) => {
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    const validationMessages = detail
      .map((item) => item?.msg)
      .filter(Boolean);
    if (validationMessages.length) {
      return validationMessages.join(' ');
    }
  }
  if (!error.response || error.response.status >= 500) {
    return 'Service is temporarily unavailable. Please try again later.';
  }
  return fallback;
};

export const authAPI = {
  login: (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    return api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
  updateMe: (userData) => api.put('/auth/me', userData),
  changePassword: (currentPassword, newPassword) => 
    api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
};

export const boatsAPI = {
  list: () => api.get('/boats'),
  listMy: () => api.get('/boats/my'),
  get: (id) => api.get(`/boats/${id}`),
  create: (data) => api.post('/boats', data),
  update: (id, data) => api.put(`/boats/${id}`, data),
  delete: (id) => api.delete(`/boats/${id}`),
};

export const favoriteBoatsAPI = {
  list: () => api.get('/favorite-boats'),
  add: (boatId) => api.post('/favorite-boats', { boat_id: boatId }),
  remove: (boatId) => api.delete(`/favorite-boats/${boatId}`),
};

export const fleetsAPI = {
  list: () => api.get('/fleets'),
  get: (id) => api.get(`/fleets/${id}`),
  create: (data) => api.post('/fleets', data),
};

export const eventsAPI = {
  list: (upcomingOnly = true) => api.get('/events', { params: { upcoming_only: upcomingOnly } }),
  get: (id) => api.get(`/events/${id}`),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
  getAvailableCrew: (id) => api.get(`/events/${id}/available-crew`),
};

export const seriesAPI = {
  list: (upcomingOnly = true) => api.get('/series', { params: { upcoming_only: upcomingOnly } }),
  getEvents: (seriesName) => api.get(`/series/${encodeURIComponent(seriesName)}/events`),
};

export const availabilityAPI = {
  markAvailable: (data) => api.post('/availability', data),
  markSeriesAvailable: (data) => api.post('/availability/series', data),
  getMy: () => api.get('/availability/my'),
  remove: (id) => api.delete(`/availability/${id}`),
};

export const crewRequestsAPI = {
  create: (data) => api.post('/crew-requests', data),
  createForSeries: (data) => api.post('/crew-requests/series', data),
  getReceived: () => api.get('/crew-requests/received'),
  getSent: () => api.get('/crew-requests/sent'),
  respond: (id, status, message) => api.put(`/crew-requests/${id}/respond`, { status, response_message: message }),
  respondToSeries: (series, status, message) => api.put('/crew-requests/series/respond', { series, status, response_message: message }),
  withdraw: (id, reason) => api.put(`/crew-requests/${id}/withdraw`, { reason }),
  getWaitlist: (boatId, eventId) => api.get(`/crew-requests/waitlist/${boatId}/${eventId}`),
  getNextWaitlistPosition: (boatId, eventId) => api.get(`/crew-requests/next-waitlist-position/${boatId}/${eventId}`),
};

export const skipperCommitmentsAPI = {
  create: (data) => api.post('/skipper-commitments', data),
  createForSeries: (data) => api.post('/skipper-commitments/series', data),
  getMy: () => api.get('/skipper-commitments/my'),
  cancel: (id) => api.delete(`/skipper-commitments/${id}`),
};

export const crewRatingsAPI = {
  create: (data) => api.post('/crew-ratings', data),
  getSummary: (crewId) => api.get(`/crew-ratings/summary/${crewId}`),
  getSummaries: (crewIds) => api.get('/crew-ratings/summaries', { params: { crew_ids: crewIds.join(',') } }),
  getForCrew: (crewId) => api.get(`/crew-ratings/for-crew/${crewId}`),
};

export const boatRatingsAPI = {
  create: (data) => api.post('/boat-ratings', data),
  getSummary: (boatId) => api.get(`/boat-ratings/summary/${boatId}`),
  getSummaries: (boatIds) => api.get('/boat-ratings/summaries', { params: { boat_ids: boatIds.join(',') } }),
  getForBoat: (boatId) => api.get(`/boat-ratings/for-boat/${boatId}`),
};

export const notificationsAPI = {
  list: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

export const pushAPI = {
  getVapidPublicKey: () => api.get('/push-subscriptions/vapid-public'),
  subscribe: (data) => api.post('/push-subscriptions', data),
};

export const contactsAPI = {
  list: () => api.get('/contacts'),
  get: (id) => api.get(`/contacts/${id}`),
};

export const crewPoolAPI = {
  list: () => api.get('/crew-pool'),
  getMy: () => api.get('/crew-pool/my'),
  upsert: (data) => api.put('/crew-pool', data),
  remove: () => api.delete('/crew-pool'),
  getCrewProfile: (userId) => api.get(`/crew-pool/crew/${userId}`),
};

export const conversationsAPI = {
  list: () => api.get('/conversations'),
  get: (id) => api.get(`/conversations/${id}`),
  start: (crewId, message) => api.post('/conversations', { crew_id: crewId, message }),
  sendMessage: (conversationId, body) => api.post(`/conversations/${conversationId}/messages`, { body }),
};

export const motdAPI = {
  list: () => api.get('/motd'),
  dismiss: (location) => api.post(`/motd/${location}/dismiss`),
};

export const adminAPI = {
  listUsers: () => api.get('/admin/users'),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  importCalendar: (url) => api.post('/admin/import-calendar', null, { params: { url } }),
  previewCalendar: (url) => api.get('/admin/calendar-preview', { params: { url } }),
  listMotds: () => api.get('/admin/motd'),
  updateMotd: (location, data) => api.put(`/admin/motd/${location}`, data),
};

export default api;
