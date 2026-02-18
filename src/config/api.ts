// API Configuration
// Change this URL to point to your Flask backend
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const API_ENDPOINTS = {
  analyze: `${API_BASE_URL}/api/analyze`,
  result: (id: string) => `${API_BASE_URL}/api/result/${id}`,
  history: `${API_BASE_URL}/api/history`,
  stats: `${API_BASE_URL}/api/stats`,
  metrics: `${API_BASE_URL}/api/metrics`,
  delete: (id: string) => `${API_BASE_URL}/api/result/${id}`,
  health: `${API_BASE_URL}/api/health`,
} as const;

// Toggle between mock and real API
// The Flask backend requires running locally (localhost:5000) which can't be accessed from cloud preview
// Demo mode is enabled by default for cloud preview, disable via VITE_USE_MOCK_API=false when running locally
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false';
