import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

let csrfToken = '';
let csrfPromise;

export function setCsrfToken(token) {
  csrfToken = token || '';
  csrfPromise = null;
}

export function clearCsrfToken() {
  csrfToken = '';
  csrfPromise = null;
}

export async function ensureCsrf() {
  if (csrfToken) return csrfToken;
  if (!csrfPromise) {
    csrfPromise = api.get('/csrf-token').then((res) => {
      csrfToken = res.data.csrfToken;
      csrfPromise = null;
      return csrfToken;
    }).catch((err) => {
      csrfPromise = null;
      throw err;
    });
  }
  return csrfPromise;
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = await ensureCsrf();
    config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

api.interceptors.response.use(
  (res) => {
    if (res.data && res.data.csrfToken) {
      setCsrfToken(res.data.csrfToken);
    }
    return res;
  },
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 403 &&
      (error.response?.data?.message?.includes('CSRF') || error.response?.data?.message?.includes('csrf')) &&
      original &&
      !original._csrfRetried
    ) {
      original._csrfRetried = true;
      clearCsrfToken();
      const token = await ensureCsrf();
      original.headers['X-CSRF-Token'] = token;
      return api(original);
    }
    return Promise.reject(error);
  }
);

export default api;
