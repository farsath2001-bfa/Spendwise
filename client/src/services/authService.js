// import api from './api';

// export const register = (data) => api.post('/auth/register', data).then((res) => res.data);
// export const login = (data) => api.post('/auth/login', data).then((res) => res.data);
// export const getMe = () => api.get('/auth/me').then((res) => res.data);
// export const updateMe = (data) => api.put('/auth/me', data).then((res) => res.data);


import api from './api';

export const register = (data) => api.post('/auth/register', data).then((res) => res.data);
export const login = (data) => api.post('/auth/login', data).then((res) => res.data);
export const getMe = () => api.get('/auth/me').then((res) => res.data);
export const updateMe = (data) => api.put('/auth/me', data).then((res) => res.data);

export const forgotPassword = (email) =>
  api.post('/auth/forgot-password', { email }).then((res) => res.data);

export const resetPassword = (token, password) =>
  api.post(`/auth/reset-password/${token}`, { password }).then((res) => res.data);