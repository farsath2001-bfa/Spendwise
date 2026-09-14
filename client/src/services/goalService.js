import api from './api';

export const getGoals = () => api.get('/goals').then((res) => res.data);

export const createGoal = (data) => api.post('/goals', data).then((res) => res.data);

export const updateGoal = (id, data) => api.put(`/goals/${id}`, data).then((res) => res.data);

export const contributeToGoal = (id, amount) =>
  api.post(`/goals/${id}/contribute`, { amount }).then((res) => res.data);

export const deleteGoal = (id) => api.delete(`/goals/${id}`).then((res) => res.data);