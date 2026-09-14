import api from './api';

export const getBudgets = () => api.get('/budgets').then((res) => res.data);

export const setBudget = (data) => api.post('/budgets', data).then((res) => res.data);

export const deleteBudget = (id) => api.delete(`/budgets/${id}`).then((res) => res.data);