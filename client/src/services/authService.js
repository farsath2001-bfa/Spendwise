import api from './api';

export const register = (data) => api.post('/auth/register', data).then((res) => res.data);
export const login = (data) => api.post('/auth/login', data).then((res) => res.data);
export const getMe = () => api.get('/auth/me').then((res) => res.data);
export const updateMe = (data) => api.put('/auth/me', data).then((res) => res.data);