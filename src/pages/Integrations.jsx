import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Database, RefreshCw, Search, ArrowRight, Zap, Eye, X, Play, GitBranch,
  RotateCcw, Sliders, ChevronRight, Server, Plus, Network
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  fetchTools,
  fetchPipelines,
  fetchConnectorTypes,
  fetchPipelineBindings,
  fetchPipelineTemplates,
  testToolConnection,
  triggerSync,
  createTool,
  createPipelineFromTools,
} from '../api/client';

/**
 * Design B — Operations Hub (Fivetran/Monte Carlo style):
 * 1) Connected systems & pipeline composition first (live API)
 * 2) Connector directory second (API types + roadmap Coming soon)
 * 3) Sync logs only after Run sync (drawer), never an empty permanent console
 */

const CONNECTOR_META = {
  snowflake: { label: 'Snowflake', category: 'warehouses', color: '#29B5E8', monogram: 'SF', desc: 'Cloud data warehouse for analytics and BI.' },
  redshift: { label: 'Amazon Redshift', category: 'warehouses', color: '#CC292B', monogram: 'RS', desc: 'Data warehouse for large-scale analytics.' },
  bigquery: { label: 'Google BigQuery', category: 'warehouses', color: '#4285F4', monogram: 'BQ', desc: 'Serverless data warehouse from Google Cloud.' },
  mysql: { label: 'MySQL', category: 'databases', color: '#00758F', monogram: 'MY', desc: 'Popular open source relational database.' },
  postgres: { label: 'PostgreSQL', category: 'databases', color: '#336791', monogram: 'PG', desc: 'Open source relational database.' },
  dbt: { label: 'dbt Cloud', category: 'transformations', color: '#FF694B', monogram: 'dbt', desc: 'Data transformation and modeling.' },
  dbt_cloud: { label: 'dbt Cloud', category: 'transformations', color: '#FF694B', monogram: 'dbt', desc: 'Data transformation and modeling.' },
  airbyte: { label: 'Airbyte', category: 'transformations', color: '#615EFF', monogram: 'AB', desc: 'Open-source data movement and ELT.' },
  airflow: { label: 'Apache Airflow', category: 'transformations', color: '#017CEE', monogram: 'AF', desc: 'Workflow orchestration and scheduling.' },
};

const ROADMAP_CONNECTORS = [
  { id: 'databricks', label: 'Databricks', category: 'warehouses', color: '#FF3621', monogram: 'DB', desc: 'Unified lakehouse platform for data, AI and analytics.' },
  { id: 's3', label: 'Amazon S3', category: 'warehouses', color: '#E05243', monogram: 'S3', desc: 'Object storage for raw data and backups.' },
  { id: 'synapse', label: 'Azure Synapse', category: 'warehouses', color: '#0078D4', monogram: 'AS', desc: 'Analytics service for big data and warehousing.' },
  { id: 'clickhouse', label: 'ClickHouse', category: 'warehouses', color: '#FFCC00', monogram: 'CH', desc: 'Fast open-source columnar database.' },
  { id: 'iceberg', label: 'Apache Iceberg', category: 'warehouses', color: '#1B9AAA', monogram: 'IB', desc: 'High-performance open table format for analytic datasets.' },
  { id: 'mongodb', label: 'MongoDB', category: 'databases', color: '#47A248', monogram: 'MG', desc: 'NoSQL document database.' },
  { id: 'fivetran', label: 'Fivetran', category: 'transformations', color: '#0070F3', monogram: 'FV', desc: 'Managed data movement and replication.' },
  { id: 'prefect', label: 'Prefect', category: 'transformations', color: '#00263E', monogram: 'PF', desc: 'Data orchestration for modern data stacks.' },
];

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'warehouses', label: 'Data Warehouses & Lakes', subtitle: 'Warehouses, lakehouses and cloud storage.', Icon: Database },
  { id: 'databases', label: 'Databases', subtitle: 'Operational and analytical databases.', Icon: Server },
  { id: 'transformations', label: 'Transformations & ETL', subtitle: 'Transform, orchestrate and move data.', Icon: Sliders },
];

const FORM_SCHEMAS = {
  snowflake: [
    { key: 'account_id', label: 'Account Identifier', required: true },
    { key: 'warehouse_id', label: 'Warehouse', required: true },
    { key: 'database_id', label: 'Database', required: true },
    { key: 'schema', label: 'Schema', required: true },
    { key: 'tables', label: 'Tables (comma-separated)', required: false },
    { key: 'user_id', label: 'Username', required: true },
    { key: 'sf_role', label: 'Role', required: false },
    { key: 'secret', label: 'Password / Private Key', type: 'password', required: true },
  ],
  mysql: [
    { key: 'host', label: 'Host', required: true },
    { key: 'port', label: 'Port', required: true, placeholder: '3306' },
    { key: 'database_id', label: 'Database', required: true },
    { key: 'user_id', label: 'Username', required: true },
    { key: 'secret', label: 'Password', type: 'password', required: true },
  ],
  postgres: [
    { key: 'host', label: 'Host', required: true },
    { key: 'port', label: 'Port', required: true, placeholder: '5432' },
    { key: 'database_id', label: 'Database', required: true },
    { key: 'schema', label: 'Schema', required: true },
    { key: 'user_id', label: 'Username', required: true },
    { key: 'secret', label: 'Password', type: 'password', required: true },
  ],
  redshift: [
    { key: 'host', label: 'Cluster endpoint', required: true },
    { key: 'port', label: 'Port', required: true, placeholder: '5439' },
    { key: 'database_id', label: 'Database', required: true },
    { key: 'schema', label: 'Schema', required: true },
    { key: 'user_id', label: 'Username', required: true },
    { key: 'secret', label: 'Password', type: 'password', required: true },
  ],
  bigquery: [
    { key: 'project_id', label: 'GCP Project ID', required: true },
    { key: 'dataset_id', label: 'Dataset ID', required: true },
    { key: 'secret', label: 'Service Account JSON', type: 'textarea', required: true },
  ],
  dbt: [
    { key: 'account_id', label: 'dbt Cloud Account ID', required: true },
    { key: 'job_id', label: 'Job ID', required: true },
    { key: 'project_name', label: 'Project Name', required: true },
    { key: 'api_base', label: 'API Base URL', required: true },
    { key: 'secret', label: 'API Token', type: 'password', required: true },
  ],
  dbt_cloud: [
    { key: 'account_id', label: 'dbt Cloud Account ID', required: true },
    { key: 'job_id', label: 'Job ID', required: true },
    { key: 'project_name', label: 'Project Name', required: true },
    { key: 'api_base', label: 'API Base URL', required: true },
    { key: 'secret', label: 'API Token', type: 'password', required: true },
  ],
  airbyte: [
    { key: 'api_url', label: 'Airbyte API URL', required: true },
    { key: 'workspace_id', label: 'Workspace ID', required: true },
    { key: 'secret', label: 'API Token', type: 'password', required: true },
  ],
  airflow: [
    { key: 'webserver_url', label: 'Webserver URL', required: true },
    { key: 'dag_id', label: 'DAG ID', required: true },
    { key: 'user_id', label: 'Username', required: true },
    { key: 'secret', label: 'Password / Token', type: 'password', required: true },
  ],
};

const GENERIC_FIELDS = [
  { key: 'host', label: 'Host / Endpoint', required: true },
  { key: 'secret', label: 'Password / API Token', type: 'password', required: true },
];

const SECRET_KEYS = new Set(['secret', 'password', 'token', 'api_key', 'access_key_id']);

function fieldsForType(id) {
  return FORM_SCHEMAS[id] || GENERIC_FIELDS;
}

function metaFor(id, apiType) {
  const known = CONNECTOR_META[id];
  if (known) return { id, ...known, kind: apiType?.kind || known.kind };
  const kind = apiType?.kind || 'database';
  return {
    id,
    label: apiType?.label || id,
    category: kind === 'etl' || kind === 'orchestrator' ? 'transformations' : 'databases',
    kind,
    color: '#64748B',
    monogram: String(id).slice(0, 2).toUpperCase(),
    desc: `${apiType?.label || id} connector.`,
  };
}

function roleFromTool(tool) {
  const explicit = (tool?.config?.role || tool?.role || '').toUpperCase();
  if (explicit) return explicit;
  // API often omits role on ETL tools — infer from kind / name
  if (tool?.kind === 'etl' || tool?.kind === 'orchestrator') return 'ETL';
  const name = String(tool?.name || '').toLowerCase();
  if (name.includes('-etl') || name.endsWith('etl')) return 'ETL';
  if (name.includes('source')) return 'SOURCE';
  if (name.includes('target')) return 'TARGET';
  return null;
}

function roleClass(role) {
  const r = (role || '').toUpperCase();
  if (r === 'SOURCE') return 'role-source';
  if (r === 'TARGET') return 'role-target';
  if (r === 'ETL' || r === 'TRANSFORM') return 'role-etl';
  return 'role-default';
}

function parseAsset(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

function configSummary(tool) {
  const cfg = tool?.config || {};
  const type = tool?.connector_type;
  if (type === 'snowflake') {
    return [cfg.database_id, cfg.schema, Array.isArray(cfg.tables) ? cfg.tables.join(', ') : cfg.tables]
      .filter(Boolean).join(' · ') || cfg.account_id || '—';
  }
  if (type === 'dbt' || type === 'dbt_cloud') {
    return [cfg.project_name, cfg.job_id ? `job ${cfg.job_id}` : null].filter(Boolean).join(' · ') || '—';
  }
  return cfg.database_id || cfg.host || cfg.project_id || '—';
}

function safeConfigEntries(config = {}) {
  return Object.entries(config).filter(([k]) => {
    const key = String(k).toLowerCase();
    return !SECRET_KEYS.has(key) && key !== 'tool' && key !== 'connector_instance_id';
  });
}

function extractSyncLogLines(res) {
  const lines = [];
  if (res == null) return lines;
  if (typeof res === 'string') return [res];
  const push = (v) => {
    if (v == null) return;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      lines.push(String(v));
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((item) => {
        if (typeof item === 'string') lines.push(item);
        else if (item && typeof item === 'object') {
          lines.push(item.message || item.detail || item.event || JSON.stringify(item));
        }
      });
      return;
    }
    lines.push(JSON.stringify(v));
  };
  ['message', 'detail', 'status', 'ok'].forEach((k) => {
    if (res[k] != null && typeof res[k] !== 'object') push(`${k}: ${res[k]}`);
  });
  ['run_id', 'sync_id', 'pipeline_id', 'pipeline_name', 'duration', 'assets_processed'].forEach((k) => {
    if (res[k] != null) push(`${k}: ${res[k]}`);
  });
  ['logs', 'events', 'steps', 'items', 'output'].forEach((k) => {
    if (res[k] != null) { push(`--- ${k} ---`); push(res[k]); }
  });
  if (!lines.length) push(JSON.stringify(res, null, 2));
  return lines;
}

function toolLabel(tool) {
  return tool ? `${tool.name} (${tool.connector_type || tool.kind || 'tool'})` : '—';
}

export default function Integrations() {
  // Design B: operations first
  const [tab, setTab] = useState('connected');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);

  const [tools, setTools] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [connectorTypes, setConnectorTypes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [bindings, setBindings] = useState([]);
  const [focusPipelineId, setFocusPipelineId] = useState(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [testingToolId, setTestingToolId] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState([]);
  const [lastSyncOk, setLastSyncOk] = useState(null);
  const [syncDrawerOpen, setSyncDrawerOpen] = useState(false);

  const [connectType, setConnectType] = useState(null);
  const [connectionName, setConnectionName] = useState('');
  const [connectionRole, setConnectionRole] = useState('SOURCE');
  const [formValues, setFormValues] = useState({});
  const [savingTool, setSavingTool] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeForm, setComposeForm] = useState({
    pipeline_name: '',
    source_tool_id: '',
    etl_tool_id: '',
    target_tool_id: '',
    make_active: true,
    description: '',
  });
  const [composing, setComposing] = useState(false);
  const [composeError, setComposeError] = useState(null);
  const [inspectTool, setInspectTool] = useState(null);

  const requestIdRef = useRef(0);
  const syncLogRef = useRef(null);

  const loadData = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const [toolsRes, pipesRes, typesRes, tmplRes] = await Promise.allSettled([
        fetchTools(),
        fetchPipelines({ preset: 'all' }),
        fetchConnectorTypes(),
        fetchPipelineTemplates(),
      ]);
      if (reqId !== requestIdRef.current) return;

      let toolList = [];
      if (toolsRes.status === 'fulfilled' && toolsRes.value) {
        if (toolsRes.value.ok === false || toolsRes.value.error) {
          setError(toolsRes.value.error || 'Tools API returned an error');
        } else {
          toolList = toolsRes.value.items || toolsRes.value.tools || [];
          setTools(Array.isArray(toolList) ? toolList : []);
        }
      } else if (toolsRes.status === 'rejected') {
        setError(toolsRes.reason?.response?.data?.error || toolsRes.reason?.message || 'Failed to load tools');
        setTools([]);
      }

      let pipeList = [];
      if (pipesRes.status === 'fulfilled' && pipesRes.value) {
        pipeList = pipesRes.value.items || pipesRes.value.pipelines || [];
        setPipelines(Array.isArray(pipeList) ? pipeList : []);
      } else setPipelines([]);

      if (typesRes.status === 'fulfilled' && typesRes.value) {
        const items = typesRes.value.items || typesRes.value.types || [];
        setConnectorTypes(Array.isArray(items) ? items : []);
      } else setConnectorTypes([]);

      if (tmplRes.status === 'fulfilled' && tmplRes.value) {
        const t = tmplRes.value.templates || tmplRes.value.items || [];
        setTemplates(Array.isArray(t) ? t : []);
      }

      const preferred =
        pipeList.find(p => p.is_sync_default) ||
        pipeList.find(p => p.is_active) ||
        pipeList[0] || null;

      setFocusPipelineId(prev => {
        if (prev && pipeList.some(p => p.pipeline_id === prev)) return prev;
        return preferred?.pipeline_id || null;
      });

      if (toolList.length) {
        const src = toolList.find(t => roleFromTool(t) === 'SOURCE') || toolList.find(t => t.kind === 'database');
        const etl = toolList.find(t => roleFromTool(t) === 'ETL' || t.kind === 'etl');
        const tgt = toolList.find(t => roleFromTool(t) === 'TARGET')
          || toolList.filter(t => t.kind === 'database' && t.tool_id !== src?.tool_id)[0];
        setComposeForm(prev => ({
          ...prev,
          pipeline_name: prev.pipeline_name || preferred?.pipeline_name || '',
          source_tool_id: prev.source_tool_id || src?.tool_id || '',
          etl_tool_id: prev.etl_tool_id || etl?.tool_id || '',
          target_tool_id: prev.target_tool_id || tgt?.tool_id || '',
        }));
      }
    } catch (e) {
      if (reqId !== requestIdRef.current) return;
      setError(e.message || 'Failed to load integrations');
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    let cancelled = false;
    async function loadBindings() {
      if (!focusPipelineId) { setBindings([]); return; }
      try {
        const bRes = await fetchPipelineBindings(focusPipelineId);
        if (cancelled) return;
        const items = bRes?.items || bRes?.bindings || [];
        setBindings(Array.isArray(items) ? items : []);
      } catch {
        if (!cancelled) setBindings([]);
      }
    }
    loadBindings();
    return () => { cancelled = true; };
  }, [focusPipelineId]);

  const focusPipeline = useMemo(
    () => pipelines.find(p => p.pipeline_id === focusPipelineId) || null,
    [pipelines, focusPipelineId]
  );

  const bindingsByRole = useMemo(() => {
    const map = { SOURCE: null, ETL: null, TARGET: null };
    bindings.forEach((b) => {
      const role = (b.role || '').toUpperCase();
      if (role in map) map[role] = b;
    });
    return map;
  }, [bindings]);

  const apiTypeById = useMemo(() => {
    const map = new Map();
    connectorTypes.forEach((t) => { if (t?.id) map.set(t.id, t); });
    return map;
  }, [connectorTypes]);

  const directoryEntries = useMemo(() => {
    const entries = [];
    const seen = new Set();
    connectorTypes.forEach((t) => {
      if (!t?.id || seen.has(t.id)) return;
      if (t.id === 'dbt_cloud' && apiTypeById.has('dbt')) return;
      seen.add(t.id);
      entries.push({ ...metaFor(t.id, t), kind: t.kind, apiSupported: true });
    });
    ROADMAP_CONNECTORS.forEach((r) => {
      if (seen.has(r.id)) return;
      seen.add(r.id);
      entries.push({ ...r, apiSupported: false });
    });
    return entries;
  }, [connectorTypes, apiTypeById]);

  const filteredDirectory = useMemo(() => {
    let list = directoryEntries;
    if (categoryFilter !== 'all') list = list.filter(c => c.category === categoryFilter);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(c => [c.id, c.label, c.desc].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [directoryEntries, categoryFilter, search]);

  const groupedDirectory = useMemo(() => (
    CATEGORIES.filter(c => c.id !== 'all')
      .map(cat => ({ ...cat, items: filteredDirectory.filter(e => e.category === cat.id) }))
      .filter(g => g.items.length)
  ), [filteredDirectory]);

  const categoryCounts = useMemo(() => {
    const counts = { all: directoryEntries.length, warehouses: 0, databases: 0, transformations: 0 };
    directoryEntries.forEach((e) => { if (counts[e.category] != null) counts[e.category] += 1; });
    return counts;
  }, [directoryEntries]);

  const connectedCountByType = useMemo(() => {
    const map = {};
    tools.forEach((t) => {
      if (!t.connector_type) return;
      map[t.connector_type] = (map[t.connector_type] || 0) + 1;
    });
    return map;
  }, [tools]);

  const filteredTools = useMemo(() => {
    if (!search.trim() || tab !== 'connected') return tools;
    const q = search.toLowerCase();
    return tools.filter(t =>
      [t.name, t.connector_type, t.kind, roleFromTool(t), configSummary(t)]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [tools, search, tab]);

  const dbTools = tools.filter(t => t.kind === 'database');
  const etlTools = tools.filter(t => t.kind === 'etl' || t.kind === 'orchestrator');
  const dash = (v) => (v == null || v === '' ? '—' : v);

  const openConnect = (entry) => {
    if (!entry?.apiSupported) {
      setActionMsg(`${entry?.label || entry?.id} is on the roadmap — not available from the API yet.`);
      return;
    }
    const type = apiTypeById.get(entry.id) || { id: entry.id, label: entry.label, kind: entry.kind || 'database' };
    setConnectType(type);
    setConnectionName(`${entry.id}-connector`);
    setConnectionRole(type.kind === 'etl' || type.kind === 'orchestrator' ? 'ETL' : 'SOURCE');
    setFormValues({});
    setSaveError(null);
  };

  const handleSaveTool = async (e) => {
    e.preventDefault();
    if (!connectType) return;
    setSavingTool(true);
    setSaveError(null);
    try {
      const fields = fieldsForType(connectType.id);
      const missing = fields.filter(f => f.required && !String(formValues[f.key] || '').trim());
      if (missing.length) {
        setSaveError(`Required: ${missing.map(m => m.label).join(', ')}`);
        setSavingTool(false);
        return;
      }
      if (!connectionName.trim()) {
        setSaveError('Connection name is required');
        setSavingTool(false);
        return;
      }
      const cfg = { ...formValues, role: connectionRole };
      if (cfg.tables && typeof cfg.tables === 'string') {
        cfg.tables = cfg.tables.split(',').map(t => t.trim()).filter(Boolean);
      }
      const secret = formValues.secret;
      if (!secret) {
        setSaveError('Secret / credential is required');
        setSavingTool(false);
        return;
      }
      const { secret: _s, ...configWithoutSecret } = cfg;
      await createTool({
        name: connectionName.trim(),
        connector_type: connectType.id,
        kind: connectType.kind,
        secret,
        config: configWithoutSecret,
      });
      setConnectType(null);
      setActionMsg(`Registered “${connectionName.trim()}”.`);
      setTab('connected');
      await loadData();
    } catch (err) {
      setSaveError(err?.response?.data?.detail || err?.response?.data?.error || err.message || 'Failed to register');
    } finally {
      setSavingTool(false);
    }
  };

  const handleTest = async (toolId) => {
    setTestingToolId(toolId);
    const testedAt = new Date().toISOString();
    try {
      const res = await testToolConnection(toolId);
      setTestResults(prev => ({
        ...prev,
        [toolId]: { ok: true, msg: res?.message || res?.detail || 'Connection verified', testedAt },
      }));
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [toolId]: {
          ok: false,
          msg: err?.response?.data?.detail || err?.response?.data?.error || err.message || 'Test failed',
          testedAt,
        },
      }));
    } finally {
      setTestingToolId(null);
    }
  };

  const handleSync = async () => {
    if (!focusPipeline) {
      setActionMsg('Select a pipeline before syncing.');
      return;
    }
    setSyncing(true);
    setActionMsg(null);
    setLastSyncOk(null);
    setSyncDrawerOpen(true);
    const stamp = () => new Date().toLocaleTimeString();
    setSyncLogs([
      `[${stamp()}] INIT sync · ${focusPipeline.pipeline_name}`,
      `[${stamp()}] pipeline_id=${focusPipeline.pipeline_id}`,
      `[${stamp()}] POST /v1/sync { refresh_db: true }`,
    ]);
    try {
      const res = await triggerSync({ refresh_db: true, pipeline_id: focusPipeline.pipeline_id });
      const extracted = extractSyncLogLines(res).map(l => `[${stamp()}] ${l}`);
      setSyncLogs(prev => [...prev, ...(extracted.length ? extracted : [`[${stamp()}] Sync completed`]), `[${stamp()}] DONE`]);
      setLastSyncOk(true);
      setActionMsg(res?.message || `Sync completed for ${focusPipeline.pipeline_name}.`);
      await loadData();
    } catch (err) {
      const detail = err?.response?.data;
      const errLines = extractSyncLogLines(detail).map(l => `[${stamp()}] ${l}`);
      setSyncLogs(prev => [
        ...prev,
        `[${stamp()}] ERROR HTTP ${err?.response?.status || '—'}`,
        ...(errLines.length ? errLines : [`[${stamp()}] ${err.message || 'Sync failed'}`]),
      ]);
      setLastSyncOk(false);
      setActionMsg(detail?.detail || detail?.error || err.message || 'Sync failed');
    } finally {
      setSyncing(false);
      requestAnimationFrame(() => {
        if (syncLogRef.current) syncLogRef.current.scrollTop = syncLogRef.current.scrollHeight;
      });
    }
  };

  const handleCompose = async (e) => {
    e.preventDefault();
    setComposing(true);
    setComposeError(null);
    try {
      if (!composeForm.pipeline_name.trim()) {
        setComposeError('Pipeline name is required');
        setComposing(false);
        return;
      }
      if (!composeForm.source_tool_id || !composeForm.etl_tool_id || !composeForm.target_tool_id) {
        setComposeError('Source, ETL, and Target are required');
        setComposing(false);
        return;
      }
      await createPipelineFromTools({
        pipeline_name: composeForm.pipeline_name.trim(),
        source_tool_id: composeForm.source_tool_id,
        etl_tool_id: composeForm.etl_tool_id,
        target_tool_id: composeForm.target_tool_id,
        make_active: Boolean(composeForm.make_active),
        description: composeForm.description || '',
      });
      setComposeOpen(false);
      setActionMsg(`Pipeline “${composeForm.pipeline_name.trim()}” created.`);
      setTab('connected');
      await loadData();
    } catch (err) {
      setComposeError(err?.response?.data?.detail || err?.response?.data?.error || err.message || 'Compose failed');
    } finally {
      setComposing(false);
    }
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Integrations"
        subtitle="Pipeline board first — then connection cards. Directory is only for adding connectors."
        onRefresh={loadData}
      />

      <div className="page-body">
        <div className="integration-tabs">
          <button
            type="button"
            className={`integration-tab${tab === 'connected' ? ' is-active' : ''}`}
            onClick={() => setTab('connected')}
          >
            <span className="integration-tab-dot" />
            <Network size={14} />
            Connected Systems ({tools.length})
          </button>
          <button
            type="button"
            className={`integration-tab${tab === 'catalog' ? ' is-active' : ''}`}
            onClick={() => setTab('catalog')}
          >
            <span className="integration-tab-dot" />
            Connector Directory ({directoryEntries.length})
          </button>
        </div>

        {error && (
          <div style={{
            padding: '12px 14px', marginBottom: 14, borderRadius: 8,
            background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 13
          }}>
            <strong>Cannot load Integrations.</strong> {error}
          </div>
        )}

        {actionMsg && (
          <div style={{
            padding: '10px 12px', marginBottom: 12, borderRadius: 8, fontSize: 12.5,
            background: /fail/i.test(actionMsg) ? '#FEF2F2' : /roadmap/i.test(actionMsg) ? '#FFFBEB' : '#ECFDF5',
            border: `1px solid ${/fail/i.test(actionMsg) ? '#FECACA' : /roadmap/i.test(actionMsg) ? '#FDE68A' : '#A7F3D0'}`,
            color: /fail/i.test(actionMsg) ? '#B91C1C' : /roadmap/i.test(actionMsg) ? '#92400E' : '#065F46',
            display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center'
          }}>
            <span>{actionMsg}</span>
            <button type="button" className="icon-btn" onClick={() => setActionMsg(null)}><X size={14} /></button>
          </div>
        )}

        {loading && !tools.length && !connectorTypes.length && !error ? (
          <LoadingSpinner />
        ) : (
          <div style={{ opacity: loading ? 0.75 : 1, transition: 'opacity 0.15s ease' }}>

            {/* ═══════════════ CONNECTED (primary) ═══════════════ */}
            {tab === 'connected' && (
              <>
                {/* HERO: composition first — clearly different from old table-first layout */}
                <section className="integration-hero">
                  <div className="integration-hero-top">
                    <div>
                      <div className="integration-hero-kicker">Active pipeline</div>
                      <h3 className="integration-hero-title">
                        {focusPipeline ? focusPipeline.pipeline_name : 'No pipeline selected'}
                      </h3>
                      {focusPipeline && (
                        <p className="integration-hero-meta">
                          {dash(focusPipeline.status)} · Last run {dash(focusPipeline.last_run_age)} ·{' '}
                          {focusPipeline.is_sync_default ? 'Sync default' : 'Not sync default'}
                        </p>
                      )}
                    </div>
                    <div className="integration-hero-actions">
                      <select
                        className="select-control"
                        value={focusPipelineId || ''}
                        onChange={e => setFocusPipelineId(e.target.value || null)}
                      >
                        {pipelines.length === 0 && <option value="">No pipelines</option>}
                        {pipelines.map(p => (
                          <option key={p.pipeline_id} value={p.pipeline_id}>
                            {p.pipeline_name}{p.is_sync_default ? ' ★' : ''}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="export-btn" onClick={() => setComposeOpen(true)} disabled={!tools.length}>
                        <GitBranch size={13} /> {focusPipeline ? 'Recompose' : 'Compose'}
                      </button>
                      <button
                        type="button"
                        className="integration-hero-sync"
                        onClick={handleSync}
                        disabled={syncing || !focusPipeline}
                      >
                        <RefreshCw size={14} className={syncing ? 'spin' : ''} />
                        {syncing ? 'Syncing…' : 'Run sync'}
                      </button>
                      {syncLogs.length > 0 && (
                        <button type="button" className="export-btn" onClick={() => setSyncDrawerOpen(true)}>
                          Sync logs
                        </button>
                      )}
                    </div>
                  </div>

                  {!focusPipeline ? (
                    <div className="integration-hero-empty">
                      Compose SOURCE → ETL → TARGET from your connections to activate this board.
                    </div>
                  ) : (
                    <div className="integration-arch-flow integration-hero-flow">
                      {[
                        { role: 'SOURCE', label: '1 · SOURCE', accent: 'source' },
                        { role: 'ETL', label: '2 · TRANSFORM', accent: 'etl' },
                        { role: 'TARGET', label: '3 · TARGET', accent: 'target' },
                      ].map((step, idx) => {
                        const b = bindingsByRole[step.role];
                        const asset = parseAsset(b?.asset_selector_json);
                        return (
                          <div key={step.role} className="integration-arch-node">
                            {idx > 0 && <ArrowRight size={20} className="integration-arch-arrow" />}
                            <div className={`integration-arch-card is-${step.accent}`}>
                              <span className={`integration-role-badge ${roleClass(step.role)}`}>
                                {step.label}
                                {b?.connector_type ? ` · ${b.connector_type}` : ''}
                              </span>
                              <div className="integration-arch-name">
                                {b ? dash(b.instance_name) : 'Not bound'}
                              </div>
                              {asset && (
                                <div className="integration-arch-meta">
                                  {asset.schema ? <div>Schema: {asset.schema}</div> : null}
                                  {Array.isArray(asset.tables) && asset.tables.length > 0 && (
                                    <div>Tables: {asset.tables.join(', ')}</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Connection CARDS (not the old table) */}
                <div className="integration-conn-section">
                  <div className="integration-conn-section-head">
                    <div>
                      <h3 className="integration-conn-section-title">Connections</h3>
                      <p className="integration-conn-section-sub">
                        {filteredTools.length} live tool{filteredTools.length === 1 ? '' : 's'} · card view
                      </p>
                    </div>
                    <div className="integration-conn-section-tools">
                      <div className="search-box" style={{ minWidth: 200 }}>
                        <Search size={14} />
                        <input
                          type="text"
                          placeholder="Filter connections…"
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                        />
                      </div>
                      <button type="button" className="export-btn" onClick={() => setTab('catalog')}>
                        <Plus size={13} /> Add connection
                      </button>
                    </div>
                  </div>

                  {filteredTools.length === 0 ? (
                    <div className="integration-hero-empty">
                      No connections yet.{' '}
                      <button type="button" className="integration-section-link" onClick={() => setTab('catalog')}>
                        Open Connector Directory →
                      </button>
                    </div>
                  ) : (
                    <div className="integration-conn-grid">
                      {filteredTools.map((tool) => {
                        const role = roleFromTool(tool);
                        const test = testResults[tool.tool_id];
                        const meta = CONNECTOR_META[tool.connector_type] || {};
                        const ok = test?.ok ?? ((tool.status || '').toLowerCase() === 'active');
                        return (
                          <article
                            key={tool.tool_id || tool.instance_id}
                            className={`integration-conn-card${role ? ` role-${String(role).toLowerCase()}` : ''}`}
                          >
                            <div className="integration-conn-card-top">
                              <div
                                className="integration-market-logo"
                                style={{
                                  background: `${meta.color || '#64748B'}18`,
                                  color: meta.color || '#64748B',
                                  borderColor: `${meta.color || '#64748B'}33`,
                                }}
                              >
                                {meta.monogram || String(tool.connector_type || '??').slice(0, 2).toUpperCase()}
                              </div>
                              {role
                                ? <span className={`integration-role-badge ${roleClass(role)}`}>{role}</span>
                                : null}
                            </div>
                            <h4 className="integration-conn-card-name">{dash(tool.name)}</h4>
                            <div className="integration-conn-card-type">
                              {meta.label || tool.connector_type || '—'}
                            </div>
                            <p className="integration-conn-card-config">{configSummary(tool)}</p>
                            <div className="integration-conn-card-foot">
                              <span className={`integration-verify ${test?.ok === false ? 'is-warn' : ok ? 'is-ok' : 'is-warn'}`}>
                                <span className="integration-market-status-dot" />
                                {test?.ok === false ? 'Test failed' : test?.ok ? 'Verified' : dash(tool.status)}
                              </span>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  type="button"
                                  className="export-btn"
                                  style={{ padding: '4px 8px', fontSize: 11 }}
                                  disabled={testingToolId === tool.tool_id}
                                  onClick={() => handleTest(tool.tool_id)}
                                >
                                  <Zap size={12} className={testingToolId === tool.tool_id ? 'spin' : ''} /> Test
                                </button>
                                <button
                                  type="button"
                                  className="export-btn"
                                  style={{ padding: '4px 8px', fontSize: 11 }}
                                  onClick={() => setInspectTool(tool)}
                                >
                                  <Eye size={12} /> Details
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ═══════════════ DIRECTORY (secondary) ═══════════════ */}
            {tab === 'catalog' && (
              <>
                <div className="filters-bar integration-toolbar">
                  <div className="search-box integration-search">
                    <Search size={14} />
                    <input
                      type="text"
                      placeholder="Search connectors…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="integration-category-pills">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        className={`integration-pill${categoryFilter === cat.id ? ' is-active' : ''}`}
                        onClick={() => setCategoryFilter(cat.id)}
                      >
                        {cat.label} ({categoryCounts[cat.id] ?? 0})
                      </button>
                    ))}
                  </div>
                  {(search || categoryFilter !== 'all') && (
                    <button className="clear-filters-btn" onClick={() => { setSearch(''); setCategoryFilter('all'); }}>
                      <RotateCcw size={12} style={{ display: 'inline', marginRight: 4 }} /> Reset
                    </button>
                  )}
                </div>

                <div className="integration-directory">
                  {groupedDirectory.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No connectors match.</div>
                  ) : groupedDirectory.map((group) => {
                    const Icon = group.Icon || Database;
                    return (
                      <section key={group.id} className="integration-section">
                        <div className="integration-section-header">
                          <div className="integration-section-title-row">
                            <div className="integration-section-icon"><Icon size={16} color="#059669" /></div>
                            <div>
                              <h3 className="integration-section-title">{group.label}</h3>
                              <p className="integration-section-subtitle">{group.subtitle}</p>
                            </div>
                          </div>
                          <button type="button" className="integration-section-link" onClick={() => setCategoryFilter(group.id)}>
                            {group.items.length} connectors <ChevronRight size={14} />
                          </button>
                        </div>
                        <div className="integration-marketplace-grid">
                          {group.items.map((entry) => {
                            const n = connectedCountByType[entry.id] || 0;
                            const statusLabel = !entry.apiSupported ? 'Coming soon' : n > 0 ? `Connected (${n})` : 'Available';
                            const statusClass = !entry.apiSupported ? 'is-soon' : n > 0 ? 'is-connected' : 'is-available';
                            return (
                              <div key={entry.id} className="integration-market-card">
                                <div className="integration-market-card-top">
                                  <div className="integration-market-logo" style={{
                                    background: `${entry.color}18`, color: entry.color, borderColor: `${entry.color}33`
                                  }}>
                                    {entry.monogram}
                                  </div>
                                  <span className={`integration-market-status ${statusClass}`}>
                                    <span className="integration-market-status-dot" />
                                    {statusLabel}
                                  </span>
                                </div>
                                <div className="integration-market-title">{entry.label}</div>
                                <p className="integration-market-desc">{entry.desc}</p>
                                <button
                                  type="button"
                                  className={`integration-connect-btn${entry.apiSupported ? '' : ' is-disabled'}`}
                                  disabled={!entry.apiSupported}
                                  onClick={() => openConnect(entry)}
                                >
                                  {entry.apiSupported ? <>Connect <ArrowRight size={14} /></> : 'Coming soon'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                  {templates.length > 0 && (
                    <div className="integration-templates-note">
                      Pipeline templates: <strong>{templates.join(', ')}</strong>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Sync logs drawer — only after a sync run */}
        {syncDrawerOpen && (
          <div className="modal-backdrop" onClick={() => !syncing && setSyncDrawerOpen(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
              <div className="modal-header">
                <div>
                  <div style={{ fontWeight: 700 }}>Sync logs</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Live response from POST /v1/sync
                    {lastSyncOk != null && (
                      <span className={`integration-verify ${lastSyncOk ? 'is-ok' : 'is-warn'}`} style={{ marginLeft: 10 }}>
                        <span className="integration-market-status-dot" />
                        {lastSyncOk ? 'OK' : 'Failed'}
                      </span>
                    )}
                  </div>
                </div>
                <button type="button" className="icon-btn" disabled={syncing} onClick={() => setSyncDrawerOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="modal-body">
                <pre className="integration-sync-console" ref={syncLogRef} style={{ margin: 0, maxHeight: 360 }}>
                  {syncLogs.join('\n') || (syncing ? 'Waiting for API…' : 'No output')}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Connect modal */}
        {connectType && (
          <div className="modal-backdrop" onClick={() => !savingTool && setConnectType(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
              <div className="modal-header">
                <div>
                  <div style={{ fontWeight: 700 }}>Connect {connectType.label || connectType.id}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{connectType.kind}</div>
                </div>
                <button type="button" className="icon-btn" disabled={savingTool} onClick={() => setConnectType(null)}><X size={16} /></button>
              </div>
              <form className="modal-body" onSubmit={handleSaveTool} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {saveError && (
                  <div style={{ padding: 10, borderRadius: 6, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 12 }}>
                    {typeof saveError === 'string' ? saveError : JSON.stringify(saveError)}
                  </div>
                )}
                <label style={{ fontSize: 12, fontWeight: 600 }}>
                  Connection name
                  <input className="custom-date-input" style={{ width: '100%', marginTop: 4 }} value={connectionName}
                    onChange={e => setConnectionName(e.target.value)} required />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600 }}>
                  Role
                  <select className="select-control" style={{ width: '100%', marginTop: 4 }} value={connectionRole}
                    onChange={e => setConnectionRole(e.target.value)}>
                    <option value="SOURCE">SOURCE</option>
                    <option value="ETL">ETL</option>
                    <option value="TARGET">TARGET</option>
                  </select>
                </label>
                {fieldsForType(connectType.id).map(field => (
                  <label key={field.key} style={{ fontSize: 12, fontWeight: 600 }}>
                    {field.label}{field.required ? ' *' : ''}
                    {field.type === 'textarea' ? (
                      <textarea className="custom-date-input" style={{ width: '100%', marginTop: 4, minHeight: 72 }}
                        value={formValues[field.key] || ''} required={field.required}
                        onChange={e => setFormValues(v => ({ ...v, [field.key]: e.target.value }))} />
                    ) : (
                      <input className="custom-date-input" style={{ width: '100%', marginTop: 4 }}
                        type={field.type === 'password' ? 'password' : 'text'}
                        value={formValues[field.key] || ''} required={field.required}
                        placeholder={field.placeholder || ''}
                        autoComplete={field.type === 'password' ? 'new-password' : 'off'}
                        onChange={e => setFormValues(v => ({ ...v, [field.key]: e.target.value }))} />
                    )}
                  </label>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="export-btn" disabled={savingTool} onClick={() => setConnectType(null)}>Cancel</button>
                  <button type="submit" className="export-btn" disabled={savingTool}
                    style={{ background: '#059669', color: '#fff', borderColor: '#059669' }}>
                    {savingTool ? 'Saving…' : 'Register'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Compose modal */}
        {composeOpen && (
          <div className="modal-backdrop" onClick={() => !composing && setComposeOpen(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
              <div className="modal-header">
                <div style={{ fontWeight: 700 }}>Compose pipeline</div>
                <button type="button" className="icon-btn" disabled={composing} onClick={() => setComposeOpen(false)}><X size={16} /></button>
              </div>
              <form className="modal-body" onSubmit={handleCompose} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {composeError && (
                  <div style={{ padding: 10, borderRadius: 6, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 12 }}>
                    {typeof composeError === 'string' ? composeError : JSON.stringify(composeError)}
                  </div>
                )}
                <label style={{ fontSize: 12, fontWeight: 600 }}>
                  Pipeline name
                  <input className="custom-date-input" style={{ width: '100%', marginTop: 4 }}
                    value={composeForm.pipeline_name} required
                    onChange={e => setComposeForm(f => ({ ...f, pipeline_name: e.target.value }))} />
                </label>
                <div className="integration-compose-flow">
                  <div className="integration-compose-step is-source">
                    <span className={`integration-role-badge ${roleClass('SOURCE')}`}>Source</span>
                    <select className="select-control" style={{ width: '100%', marginTop: 8 }} required
                      value={composeForm.source_tool_id}
                      onChange={e => setComposeForm(f => ({ ...f, source_tool_id: e.target.value }))}>
                      <option value="">Select…</option>
                      {dbTools.map(t => <option key={t.tool_id} value={t.tool_id}>{toolLabel(t)}</option>)}
                    </select>
                  </div>
                  <ArrowRight size={16} className="integration-arch-arrow" />
                  <div className="integration-compose-step is-etl">
                    <span className={`integration-role-badge ${roleClass('ETL')}`}>ETL</span>
                    <select className="select-control" style={{ width: '100%', marginTop: 8 }} required
                      value={composeForm.etl_tool_id}
                      onChange={e => setComposeForm(f => ({ ...f, etl_tool_id: e.target.value }))}>
                      <option value="">Select…</option>
                      {etlTools.map(t => <option key={t.tool_id} value={t.tool_id}>{toolLabel(t)}</option>)}
                    </select>
                  </div>
                  <ArrowRight size={16} className="integration-arch-arrow" />
                  <div className="integration-compose-step is-target">
                    <span className={`integration-role-badge ${roleClass('TARGET')}`}>Target</span>
                    <select className="select-control" style={{ width: '100%', marginTop: 8 }} required
                      value={composeForm.target_tool_id}
                      onChange={e => setComposeForm(f => ({ ...f, target_tool_id: e.target.value }))}>
                      <option value="">Select…</option>
                      {dbTools.map(t => <option key={t.tool_id} value={t.tool_id}>{toolLabel(t)}</option>)}
                    </select>
                  </div>
                </div>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={composeForm.make_active}
                    onChange={e => setComposeForm(f => ({ ...f, make_active: e.target.checked }))} />
                  Make sync default
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="export-btn" disabled={composing} onClick={() => setComposeOpen(false)}>Cancel</button>
                  <button type="submit" className="export-btn" disabled={composing}
                    style={{ background: '#059669', color: '#fff', borderColor: '#059669' }}>
                    {composing ? 'Creating…' : 'Create pipeline'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Details */}
        {inspectTool && (
          <div className="modal-backdrop" onClick={() => setInspectTool(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
              <div className="modal-header">
                <div>
                  <div style={{ fontWeight: 700 }}>{dash(inspectTool.name)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {dash(inspectTool.connector_type)} · {dash(roleFromTool(inspectTool))}
                  </div>
                </div>
                <button type="button" className="icon-btn" onClick={() => setInspectTool(null)}><X size={16} /></button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Config (secrets hidden)</div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  {safeConfigEntries(inspectTool.config).length === 0 ? (
                    <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 12 }}>No config</div>
                  ) : safeConfigEntries(inspectTool.config).map(([k, v]) => (
                    <div key={k} style={{
                      display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8,
                      padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 12
                    }}>
                      <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                      <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {Array.isArray(v) ? v.join(', ') : String(v ?? '—')}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="export-btn" disabled={testingToolId === inspectTool.tool_id}
                    onClick={() => handleTest(inspectTool.tool_id)}>
                    <Play size={12} /> Test
                  </button>
                  <button type="button" className="export-btn" onClick={() => setInspectTool(null)}>Close</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
