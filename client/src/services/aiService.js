import api from './api';

export const getSuggestions = () => api.get('/ai/suggestions').then((res) => res.data.suggestions);

export const askAssistant = (question) => api.post('/ai/ask', { question }).then((res) => res.data);

export const getQuickInsight = () => api.get('/ai/insight').then((res) => res.data.insight);