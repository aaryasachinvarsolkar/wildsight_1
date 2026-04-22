import axios from 'axios';

// With adb reverse enabled on a physical Android device, use localhost.
export const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';
const API_BASE_URL_CANDIDATES = [
  API_BASE_URL,
  'http://10.0.2.2:8000/api/v1',
  'http://192.168.31.76:8000/api/v1',
];

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

function isNetworkIssue(error) {
  const code = error?.code || '';
  const message = (error?.message || '').toLowerCase();
  return code === 'ECONNABORTED' || message.includes('network error') || message.includes('timeout');
}

function describeApiError(error) {
  if (error?.response?.data?.detail) {
    return `API error: ${error.response.data.detail}`;
  }
  if (error?.response?.status) {
    return `API error: HTTP ${error.response.status}`;
  }
  return error?.message || 'Network request failed';
}

async function postWithFallback(path, data, config = {}) {
  let lastError = null;
  for (const baseURL of API_BASE_URL_CANDIDATES) {
    try {
      const response = await api.post(path, data, {
        ...config,
        baseURL,
      });
      return response;
    } catch (error) {
      lastError = error;
      if (!isNetworkIssue(error)) {
        break;
      }
    }
  }
  throw new Error(describeApiError(lastError));
}

function withTimeout(ms = 120000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  return { controller, timeoutId };
}

export async function fetchPrediction(speciesName, lat, lon) {
  const response = await api.get('/eco-ranger/mobile/predictions', {
    params: { species_name: speciesName, lat, lon },
  });
  return response.data;
}

export async function submitScan(payload) {
  const response = await api.post('/eco-ranger/mobile/scans', payload);
  return response.data;
}

export async function submitValidation(payload) {
  const response = await api.post('/eco-ranger/mobile/validations', payload);
  return response.data;
}

export async function analyzeScanImage({ imageUri, latitude, longitude, altitude, rangerId, rangerName, notes }) {
  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'scan.jpg',
  });
  formData.append('latitude', String(latitude));
  formData.append('longitude', String(longitude));
  if (altitude !== null && altitude !== undefined) {
    formData.append('altitude_meters', String(altitude));
  }
  formData.append('ranger_id', rangerId || 'ranger-001');
  formData.append('ranger_name', rangerName || 'Field Ranger');
  formData.append('notes', notes || '');

  let lastError = null;

  for (const baseURL of API_BASE_URL_CANDIDATES) {
    const url = `${baseURL}/eco-ranger/mobile/analyze-scan`;
    const { controller, timeoutId } = withTimeout(120000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      const json = await response.json();
      clearTimeout(timeoutId);
      return json;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      const message = (error?.message || '').toLowerCase();
      if (!(message.includes('network') || message.includes('aborted') || message.includes('timeout') || message.includes('failed to fetch'))) {
        break;
      }
    }
  }

  throw new Error(describeApiError(lastError));
}

export default api;
