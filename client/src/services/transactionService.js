import api from './api';

export const getTransactions = (params = {}) =>
  api.get('/transactions', { params }).then((res) => res.data);

export const getTransaction = (id) => api.get(`/transactions/${id}`).then((res) => res.data);

export const createTransaction = (data) => api.post('/transactions', data).then((res) => res.data);

export const updateTransaction = (id, data) =>
  api.put(`/transactions/${id}`, data).then((res) => res.data);

export const deleteTransaction = (id) => api.delete(`/transactions/${id}`).then((res) => res.data);

/**
 * Uploads a receipt photo for an existing transaction. `file` is a raw
 * File object from an <input type="file">. Axios sets the multipart
 * Content-Type (with boundary) automatically when the body is FormData.
 */
export const uploadReceipt = (id, file) => {
  const formData = new FormData();
  formData.append('receipt', file);
  return api.post(`/transactions/${id}/receipt`, formData).then((res) => res.data);
};

export const deleteReceipt = (id) => api.delete(`/transactions/${id}/receipt`).then((res) => res.data);

/**
 * Fetches every transaction matching the given filters, paging through the
 * server's 200-per-request cap automatically. Used for export, where the
 * user expects "everything", not just the first page shown on screen.
 */
export const getAllTransactions = async (params = {}) => {
  const pageSize = 200;
  let page = 1;
  let all = [];
  for (;;) {
    const data = await getTransactions({ ...params, page, limit: pageSize });
    all = all.concat(data.transactions);
    if (data.transactions.length === 0 || page >= data.pages) break;
    page += 1;
  }
  return all;
};