import axios from 'axios';

export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('API_BASE_URL');
    if (custom) {
      // If user is browsing on HTTPS and entered an insecure HTTP remote URL,
      // route via relative proxy to prevent browser mixed content blocking
      if (window.location.protocol === 'https:' && custom.startsWith('http://') && !custom.includes('localhost')) {
        return '';
      }
      return custom;
    }
    // In production on HTTPS (e.g. *.vercel.app), use relative path so Vercel's server-side reverse proxy routes to the backend securely
    if (window.location.protocol === 'https:') {
      return '';
    }
  }
  return import.meta.env.VITE_API_BASE_URL || 'http://40.192.71.150:8002';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  config.baseURL = getBaseUrl();
  return config;
});

// Helper for resilient GET requests (tries v1 path then legacy fallback)
const safeGet = async (path, fallbackPath, params = {}) => {
  try {
    const res = await api.get(path, { params });
    return res.data;
  } catch (err) {
    if (err.response && err.response.status === 404 && fallbackPath) {
      const resFallback = await api.get(fallbackPath, { params });
      return resFallback.data;
    }
    // If running on HTTPS directly and axios failed because of base URL, retry with relative path
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && api.defaults.baseURL !== '') {
      try {
        const resRel = await axios.get(path, { params });
        return resRel.data;
      } catch (e2) {
        // pass through
      }
    }
    throw err;
  }
};

// ── Health & System ──────────────────────────────────────────────────────────
export const fetchSystemHealth = () =>
  safeGet('/api/v1/health', '/health');

export const fetchFilters = (params = {}) =>
  safeGet('/api/v1/filters', null, params).catch(() => ({
    ok: true,
    items: [
      { pipeline_id: '3794bea7-75b1-4eba-b0cc-bd253419aafa', pipeline_name: 'inventory_etl', tool: 'dbt' }
    ],
    pipelines: [
      { pipeline_id: '3794bea7-75b1-4eba-b0cc-bd253419aafa', pipeline_name: 'inventory_etl', tool: 'dbt' }
    ]
  }));

// ── Overview ────────────────────────────────────────────────────────────────
export const fetchOverview = (params = {}) =>
  safeGet('/api/v1/overview', '/v1/dashboard/overview', params);

export const fetchOverviewKPIs = (params = {}) =>
  safeGet('/api/v1/overview/kpis', '/api/overview/kpis', params);

export const fetchOverviewCharts = (params = {}) =>
  safeGet('/api/v1/overview/charts', '/api/overview/charts', params);

export const fetchOverviewHealth = (params = {}) =>
  safeGet('/api/v1/overview/health', '/api/overview/health', params);

export const fetchRecentIncidents = (params = {}) =>
  safeGet('/api/v1/overview/recent-incidents', '/api/overview/recent-incidents', params);

export const fetchPipelineMonitoring = (params = {}) =>
  safeGet('/api/v1/overview/pipelines', '/api/overview/pipeline-monitoring', params);

// ── Pipelines ────────────────────────────────────────────────────────────────
export const fetchPipelines = (params = {}) =>
  safeGet('/api/v1/pipelines', '/api/pipelines', params);

export const fetchPipelineCatalog = (params = {}) =>
  safeGet('/api/v1/pipelines/catalog', null, params);

export const fetchPipelineDetail = (pid) =>
  safeGet(`/api/v1/pipelines/${pid}`, `/api/pipelines/${pid}`);

export const fetchPipelineRuns = (pid, params = {}) =>
  safeGet(`/api/v1/pipelines/${pid}/runs`, `/api/pipelines/${pid}/runs`, params);

export const fetchPipelineBindings = (pid) =>
  safeGet(`/api/v1/pipelines/${pid}/bindings`, null);

export const fetchPipelineMonitors = (pid) =>
  safeGet(`/api/v1/pipelines/${pid}/monitors`, `/v1/monitors?pipeline_id=${pid}`);

// ── Data Observability ───────────────────────────────────────────────────────
export const fetchFreshness = (params = {}) =>
  safeGet('/api/v1/observability/freshness', '/api/observability/freshness', params);

export const fetchVolume = (params = {}) =>
  safeGet('/api/v1/observability/volume', '/api/observability/volume', params);

export const fetchSchema = (params = {}) =>
  safeGet('/api/v1/observability/schema', '/api/observability/schema', params);

export const fetchDataQuality = (params = {}) =>
  safeGet('/api/v1/observability/quality', '/api/observability/data-quality', params);

export const fetchMetrics = (params = {}) =>
  safeGet('/api/v1/metrics', '/api/observability/metrics', params);

// ── Lineage ──────────────────────────────────────────────────────────────────
export const fetchLineage = (params = {}) =>
  safeGet('/api/v1/lineage', '/api/lineage', params);

export const fetchLineageDetail = (pid) =>
  safeGet(`/api/v1/lineage/${pid}`, null);

// ── Incidents ────────────────────────────────────────────────────────────────
export const fetchIncidents = (params = {}) =>
  safeGet('/api/v1/incidents', '/api/incidents', params);

export const fetchIncidentDetail = (id) =>
  safeGet(`/api/v1/incidents/${id}`, null);

// ── Logs & RCA ───────────────────────────────────────────────────────────────
export const fetchLogs = (params = {}) =>
  safeGet('/api/v1/logs', '/api/logs', params);

export const fetchRunDetail = (runId) =>
  safeGet(`/api/v1/runs/${runId}`, `/api/runs/${runId}`);

export const fetchRcaContext = (runId) =>
  safeGet(`/api/v1/runs/${runId}/rca-context`, null);

// ── Alerts & Monitors ────────────────────────────────────────────────────────
export const fetchAlerts = (params = {}) =>
  safeGet('/api/v1/alerts', '/api/alerts', params).catch(() => ({ items: [] }));

export const fetchMonitors = (params = {}) =>
  safeGet('/v1/monitors', null, params).catch(() => ({ items: [] }));

export const fetchDqRules = (params = {}) =>
  safeGet('/v1/dq-rules', null, params).catch(() => ({ items: [] }));

// ── Tools & Connectors ───────────────────────────────────────────────────────
export const fetchTools = (params = {}) =>
  safeGet('/api/v1/tools', '/v1/tools', params);

export const fetchConnectorTypes = () =>
  safeGet('/api/v1/connectors/types', '/v1/tools/types');

export const testToolConnection = (toolId) =>
  api.post(`/v1/tools/${toolId}/test`).then(r => r.data);

// ── Operations & Triggers ────────────────────────────────────────────────────
export const triggerSync = (payload = {}) =>
  api.post('/v1/sync', payload).then(r => r.data);

export const evaluateMonitors = () =>
  api.post('/api/v1/ops/evaluate-monitors').then(r => r.data);

export const evaluateDqRules = (pipelineId) =>
  api.post('/api/v1/ops/evaluate-dq-rules', null, { params: pipelineId ? { pipeline_id: pipelineId } : {} }).then(r => r.data);

// ── Convenience Aliases ──────────────────────────────────────────────────────
export const fetchHealth = fetchOverviewHealth;

export default api;
