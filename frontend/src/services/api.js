import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
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
};

export const boatsAPI = {
  list: () => api.get('/boats'),
  listMy: () => api.get('/boats/my'),
  get: (id) => api.get(`/boats/${id}`),
  create: (data) => api.post('/boats', data),
  update: (id, data) => api.put(`/boats/${id}`, data),
  delete: (id) => api.delete(`/boats/${id}`),
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

export const availabilityAPI = {
  markAvailable: (data) => api.post('/availability', data),
  getMy: () => api.get('/availability/my'),
  remove: (id) => api.delete(`/availability/${id}`),
};

export const crewRequestsAPI = {
  create: (data) => api.post('/crew-requests', data),
  getReceived: () => api.get('/crew-requests/received'),
  getSent: () => api.get('/crew-requests/sent'),
  respond: (id, status, message) => api.put(`/crew-requests/${id}/respond`, { status, response_message: message }),
};

export const adminAPI = {
  listUsers: () => api.get('/admin/users'),
  importCalendar: (url) => api.post('/admin/import-calendar', null, { params: { url } }),
  previewCalendar: (url) => api.get('/admin/calendar-preview', { params: { url } }),
};

export default api;
