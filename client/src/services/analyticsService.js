import api from './api';

export const getAnalyticsSummary = () => api.get('/analytics/summary').then((res) => res.data);