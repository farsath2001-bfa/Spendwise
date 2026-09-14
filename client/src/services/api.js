import axios from 'axios';

/**
 * One shared axios instance for the whole app. Every other service file
 * imports this instead of calling axios directly, so the base URL and
 * auth-token attachment only ever need to be set up in one place.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5050/api',
});

// Attach the saved JWT (if any) to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the server ever says the token is invalid/expired, clear it locally
// so the app doesn't keep sending a dead token on every request.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
    }
    return Promise.reject(err);
  }
);

export default api;