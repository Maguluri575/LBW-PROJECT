// API Configuration
// Uses Vite environment variable for production
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://lbw-project.onrender.com";

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
export const USE_MOCK_API =
  import.meta.env.VITE_USE_MOCK_API === "true";
