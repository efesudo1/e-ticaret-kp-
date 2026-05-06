import axios from 'axios';

// Production: relative '/api' (nginx/caddy reverse proxy üzerinden backend'e)
// Development: VITE_API_BASE veya http://localhost:3000/api
const API_BASE = import.meta.env.VITE_API_BASE
  || (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api');

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kpi_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('kpi_token');
      localStorage.removeItem('kpi_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  setup: () => api.post('/auth/setup'),
  me: () => api.get('/auth/me'),
  register: (data) => api.post('/auth/register', data),
  getUsers: () => api.get('/auth/users'),
  updateUser: (id, data) => api.patch(`/auth/users/${id}`, data),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Import
export const importAPI = {
  upload: (formData) => api.post('/import/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getTables: () => api.get('/import/tables'),
  preview: (importId) => api.get(`/import/preview/${importId}`),
  execute: (data) => api.post('/import/execute', data),
  history: () => api.get('/import/history'),
  errors: (importId) => api.get(`/import/errors/${importId}`),
};

// KPI
export const kpiAPI = {
  summary: (params) => api.get('/kpi/summary', { params }),
  enhancedSummary: (params) => api.get('/kpi/enhanced-summary', { params }),
  traffic: (params) => api.get('/kpi/traffic', { params }),
  ads: (params) => api.get('/kpi/ads', { params }),
  sales: (params) => api.get('/kpi/sales', { params }),
  marketing: (params) => api.get('/kpi/marketing', { params }),
  funnel: (params) => api.get('/kpi/funnel', { params }),
  cohort: (params) => api.get('/kpi/cohort', { params }),
  heatmap: (params) => api.get('/kpi/heatmap', { params }),
  channelComparison: (params) => api.get('/kpi/channel-comparison', { params }),
  campaignPerformance: (params) => api.get('/kpi/campaign-performance', { params }),
  productPerformance: (params) => api.get('/kpi/product-performance', { params }),
  profitability: (params) => api.get('/kpi/profitability', { params }),
  customers: (params) => api.get('/kpi/customers', { params }),
  executiveSummary: (params) => api.get('/kpi/executive-summary', { params }),
  metaBreakdowns: (params) => api.get('/kpi/meta-breakdowns', { params }),
  budgetTracking: (params) => api.get('/kpi/budget-tracking', { params }),
  stockAnalysis: (params) => api.get('/kpi/stock-analysis', { params }),
  metricDetail: (type, params) => api.get(`/kpi/metric-detail/${type}`, { params }),
  // Yönetici odaklı endpoint'ler
  campaignProductBreakdown: (params) => api.get('/kpi/campaign-product-breakdown', { params }),
  productCampaignBreakdown: (params) => api.get('/kpi/product-campaign-breakdown', { params }),
  productPlatformBreakdown: (params) => api.get('/kpi/product-platform-breakdown', { params }),
  platformOverview:         (params) => api.get('/kpi/platform-overview',          { params }),
};

// Data
export const dataAPI = {
  get: (table, params) => api.get(`/data/${table}`, { params }),
  count: (table) => api.get(`/data/${table}/count`),
  overview: () => api.get('/data/overview/tables'),
  clearTable: (table) => api.delete(`/data/${table}/clear`),
};

// Filters
export const filterAPI = {
  options: () => api.get('/filters/options'),
};

// Reports
export const reportsAPI = {
  downloadExcel:                 (params) => api.get('/reports/excel',                       { params, responseType: 'blob' }),
  downloadCampaignsExcel:        (params) => api.get('/reports/excel/campaigns',             { params, responseType: 'blob' }),
  downloadCampaignComparisonExcel: (params) => api.get('/reports/excel/campaign-comparison', { params, responseType: 'blob' }),
};

// Health
export const healthAPI = {
  check: () => api.get('/health'),
};

export default api;
