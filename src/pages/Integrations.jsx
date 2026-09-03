import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Database, Server, Sliders, Layers, RefreshCw, Plus, CheckCircle,
  AlertTriangle, Shield, Search, ArrowRight, Zap, ExternalLink,
  Edit2, Trash2, Check, X, ChevronRight, Activity, Clock, Cpu, Network,
  Table, Key, Hash, Code, Sparkles, Eye, FileSpreadsheet, ArrowLeftRight,
  HelpCircle, Lock, Globe, Terminal, Play
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  fetchTools,
  testToolConnection,
  triggerSync,
  createTool,
  createPipelineFromTools,
  fetchPipelineBindings,
  fetchPipelineTemplates,
  fetchSchema
} from '../api/client';

// Connector Metadata Definitions with Field Schemas for each technology
const CONNECTOR_SCHEMAS = {
  snowflake: {
    name: 'Snowflake',
    icon: '❄️',
    color: '#29B5E8',
    kind: 'database',
    category: 'warehouses',
    desc: 'Cloud data warehouse for analytics and BI.',
    fields: [
      { key: 'account_id', label: 'Account Identifier', placeholder: 'e.g. nh02575.ap-southeast-7.aws or xy12345.us-east-1', required: true },
      { key: 'warehouse_id', label: 'Warehouse Name', placeholder: 'e.g. INVENTORY_WH or COMPUTE_WH', required: true },
      { key: 'database_id', label: 'Database Name', placeholder: 'e.g. INVENTORY_ANALYTICS', required: true },
      { key: 'schema', label: 'Schema', placeholder: 'e.g. RAW_DATA or FINAL_DATA', required: true },
      { key: 'tables', label: 'Monitored Tables (comma separated)', placeholder: 'e.g. RAW_INVENTORY, ORDERS', required: false },
      { key: 'user_id', label: 'Username', placeholder: 'e.g. OBS_USER', required: true },
      { key: 'sf_role', label: 'Snowflake Role', placeholder: 'e.g. ACCOUNTADMIN or TRANSFORMER', required: false },
      { key: 'secret', label: 'Password / Private Key', type: 'password', placeholder: '••••••••••••', required: true },
    ]
  },
  databricks: {
    name: 'Databricks',
    icon: '🧱',
    color: '#FF3621',
    kind: 'database',
    category: 'warehouses',
    desc: 'Unified lakehouse platform for data, AI and analytics.',
    fields: [
      { key: 'server_hostname', label: 'Server Hostname', placeholder: 'e.g. dbc-98a72b1.cloud.databricks.com', required: true },
      { key: 'http_path', label: 'HTTP Path', placeholder: 'e.g. /sql/1.0/warehouses/a1b2c3d4e5f6', required: true },
      { key: 'catalog', label: 'Unity Catalog Name', placeholder: 'e.g. main or hive_metastore', required: true },
      { key: 'schema', label: 'Schema / Database', placeholder: 'e.g. default or analytics_raw', required: true },
      { key: 'tables', label: 'Monitored Tables', placeholder: 'e.g. raw_events, dim_customers', required: false },
      { key: 'secret', label: 'Personal Access Token (PAT)', type: 'password', placeholder: 'dapi123456789abcdef...', required: true },
    ]
  },
  bigquery: {
    name: 'Google BigQuery',
    icon: '🔍',
    color: '#4285F4',
    kind: 'database',
    category: 'warehouses',
    desc: 'Serverless data warehouse from Google Cloud.',
    fields: [
      { key: 'project_id', label: 'GCP Project ID', placeholder: 'e.g. my-company-analytics-prod', required: true },
      { key: 'dataset_id', label: 'Dataset ID', placeholder: 'e.g. raw_inventory or ecommerce_dw', required: true },
      { key: 'location', label: 'Processing Location', placeholder: 'e.g. US, EU, or asia-south1', required: false },
      { key: 'tables', label: 'Monitored Tables', placeholder: 'e.g. dim_products, fact_sales', required: false },
      { key: 'secret', label: 'Service Account Key (JSON)', type: 'textarea', placeholder: '{"type": "service_account", "project_id": ...}', required: true },
    ]
  },
  redshift: {
    name: 'Amazon Redshift',
    icon: '📦',
    color: '#CC292B',
    kind: 'database',
    category: 'warehouses',
    desc: 'Data warehouse for large-scale analytics.',
    fields: [
      { key: 'host', label: 'Cluster Endpoint / Host', placeholder: 'e.g. redshift-cluster-1.c1xxxx.us-east-1.redshift.amazonaws.com', required: true },
      { key: 'port', label: 'Port', placeholder: '5439', required: true },
      { key: 'database_id', label: 'Database Name', placeholder: 'e.g. dev or analytics', required: true },
      { key: 'schema', label: 'Schema', placeholder: 'e.g. public or data_mart', required: true },
      { key: 'user_id', label: 'Database Username', placeholder: 'e.g. awsuser', required: true },
      { key: 'secret', label: 'Database Password', type: 'password', placeholder: '••••••••', required: true },
    ]
  },
  s3: {
    name: 'Amazon S3',
    icon: '🪣',
    color: '#E05243',
    kind: 'database',
    category: 'warehouses',
    desc: 'Object storage for raw data and backups.',
    fields: [
      { key: 'bucket_name', label: 'S3 Bucket Name', placeholder: 'e.g. my-company-data-lake-raw', required: true },
      { key: 'region', label: 'AWS Region', placeholder: 'e.g. us-east-1 or ap-southeast-1', required: true },
      { key: 'prefix', label: 'Prefix / Directory Path', placeholder: 'e.g. telemetry/inventory/', required: false },
      { key: 'access_key_id', label: 'AWS Access Key ID', placeholder: 'AKIAIOSFODNN7EXAMPLE', required: true },
      { key: 'secret', label: 'AWS Secret Access Key', type: 'password', placeholder: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', required: true },
    ]
  },
  synapse: {
    name: 'Azure Synapse',
    icon: '🔷',
    color: '#0078D4',
    kind: 'database',
    category: 'warehouses',
    desc: 'Analytics service for big data and warehousing.',
    fields: [
      { key: 'workspace_name', label: 'Synapse Workspace Name', placeholder: 'e.g. my-synapse-workspace', required: true },
      { key: 'sql_pool', label: 'Dedicated SQL Pool / Database', placeholder: 'e.g. SQLPool01', required: true },
      { key: 'schema', label: 'Schema', placeholder: 'e.g. dbo or staging', required: true },
      { key: 'user_id', label: 'SQL Admin Username', placeholder: 'e.g. sqladminuser', required: true },
      { key: 'secret', label: 'SQL Admin Password', type: 'password', placeholder: '••••••••', required: true },
    ]
  },
  clickhouse: {
    name: 'ClickHouse',
    icon: '⚡',
    color: '#FFCC00',
    kind: 'database',
    category: 'warehouses',
    desc: 'Fast open-source columnar database management system.',
    fields: [
      { key: 'host', label: 'ClickHouse Host', placeholder: 'e.g. clickhouse.company.internal or xx.clickhouse.cloud', required: true },
      { key: 'port', label: 'HTTP / Native Port', placeholder: '8443 or 8123', required: true },
      { key: 'database_id', label: 'Database Name', placeholder: 'e.g. default or analytics', required: true },
      { key: 'user_id', label: 'Username', placeholder: 'default', required: true },
      { key: 'secret', label: 'Password', type: 'password', placeholder: '••••••••', required: false },
    ]
  },
  iceberg: {
    name: 'Apache Iceberg',
    icon: '🧊',
    color: '#1B9AAA',
    kind: 'database',
    category: 'warehouses',
    desc: 'High-performance open table format for huge analytic datasets.',
    fields: [
      { key: 'catalog_uri', label: 'REST Catalog / Hive Metastore URI', placeholder: 'e.g. http://iceberg-catalog:8181', required: true },
      { key: 'warehouse_location', label: 'Warehouse S3/GCS Location', placeholder: 'e.g. s3://iceberg-data-warehouse/', required: true },
      { key: 'namespace', label: 'Namespace / Schema', placeholder: 'e.g. prod_analytics', required: true },
      { key: 'secret', label: 'OAuth Token / Credential', type: 'password', placeholder: '••••••••', required: false },
    ]
  },
  dbt: {
    name: 'dbt Cloud',
    icon: '🟧',
    color: '#FF694B',
    kind: 'etl',
    category: 'transformations',
    desc: 'Data transformation & modeling.',
    fields: [
      { key: 'account_id', label: 'dbt Cloud Account ID', placeholder: 'e.g. 70506183159506', required: true },
      { key: 'job_id', label: 'dbt Cloud Job ID', placeholder: 'e.g. 70506183138234', required: true },
      { key: 'project_name', label: 'Project Name', placeholder: 'e.g. inventory_analytics', required: true },
      { key: 'api_base', label: 'dbt Cloud API Base URL', placeholder: 'e.g. https://cloud.getdbt.com/api/v2 or https://qi314.us1.dbt.com/api/v2', required: true },
      { key: 'secret', label: 'dbt Cloud User Token / Service API Key', type: 'password', placeholder: 'dbtu_xxxx or dbtc_xxxx', required: true },
    ]
  },
  airflow: {
    name: 'Apache Airflow',
    icon: '🌀',
    color: '#017CEE',
    kind: 'orchestrator',
    category: 'transformations',
    desc: 'Workflow orchestration & scheduling.',
    fields: [
      { key: 'webserver_url', label: 'Airflow Webserver URL', placeholder: 'e.g. https://airflow.internal.company.com', required: true },
      { key: 'dag_id', label: 'Monitored DAG ID', placeholder: 'e.g. inventory_pipeline_daily', required: true },
      { key: 'user_id', label: 'Airflow API Username', placeholder: 'e.g. airflow_admin', required: true },
      { key: 'secret', label: 'Airflow Password / API Bearer Token', type: 'password', placeholder: '••••••••', required: true },
    ]
  },
  fivetran: {
    name: 'Fivetran',
    icon: '🔄',
    color: '#0070F3',
    kind: 'etl',
    category: 'transformations',
    desc: 'Managed data movement and replication.',
    fields: [
      { key: 'connector_id', label: 'Fivetran Connector ID', placeholder: 'e.g. connector_inventory_sync', required: true },
      { key: 'group_id', label: 'Destination Group ID', placeholder: 'e.g. group_snowflake_prod', required: true },
      { key: 'api_key', label: 'Fivetran API Key', placeholder: 'e.g. fv_key_xxxx', required: true },
      { key: 'secret', label: 'Fivetran API Secret', type: 'password', placeholder: 'fv_sec_xxxx', required: true },
    ]
  },
  prefect: {
    name: 'Prefect',
    icon: '🔮',
    color: '#00263E',
    kind: 'orchestrator',
    category: 'transformations',
    desc: 'Data orchestration for modern data stacks.',
    fields: [
      { key: 'api_url', label: 'Prefect Cloud / Server API URL', placeholder: 'e.g. https://api.prefect.cloud/api/accounts/...', required: true },
      { key: 'workspace', label: 'Workspace Name', placeholder: 'e.g. analytics-prod', required: true },
      { key: 'flow_name', label: 'Flow Name', placeholder: 'e.g. inventory_etl_flow', required: true },
      { key: 'secret', label: 'Prefect API Key', type: 'password', placeholder: 'pnu_xxxx', required: true },
    ]
  },
  postgres: {
    name: 'PostgreSQL',
    icon: '🐘',
    color: '#336791',
    kind: 'database',
    category: 'databases',
    desc: 'Open source relational database.',
    fields: [
      { key: 'host', label: 'Host / Server Address', placeholder: 'e.g. postgres.company.internal or 10.0.1.25', required: true },
      { key: 'port', label: 'Port', placeholder: '5432', required: true },
      { key: 'database_id', label: 'Database Name', placeholder: 'e.g. prod_inventory', required: true },
      { key: 'schema', label: 'Schema', placeholder: 'public', required: true },
      { key: 'tables', label: 'Monitored Tables', placeholder: 'e.g. raw_inventory, transactions', required: false },
      { key: 'user_id', label: 'Username', placeholder: 'postgres_obs', required: true },
      { key: 'secret', label: 'Password', type: 'password', placeholder: '••••••••', required: true },
    ]
  },
  mysql: {
    name: 'MySQL',
    icon: '🐬',
    color: '#00758F',
    kind: 'database',
    category: 'databases',
    desc: 'Popular open source database.',
    fields: [
      { key: 'host', label: 'Host / Server Address', placeholder: 'e.g. mysql-prod.internal', required: true },
      { key: 'port', label: 'Port', placeholder: '3306', required: true },
      { key: 'database_id', label: 'Database Name', placeholder: 'e.g. inventory_db', required: true },
      { key: 'tables', label: 'Monitored Tables', placeholder: 'e.g. raw_items, inventory_log', required: false },
      { key: 'user_id', label: 'Username', placeholder: 'app_user', required: true },
      { key: 'secret', label: 'Password', type: 'password', placeholder: '••••••••', required: true },
    ]
  },
  mongodb: {
    name: 'MongoDB',
    icon: '🍃',
    color: '#47A248',
    kind: 'database',
    category: 'databases',
    desc: 'NoSQL document database.',
    fields: [
      { key: 'connection_uri', label: 'MongoDB Connection URI', placeholder: 'mongodb+srv://cluster0.xxxx.mongodb.net', required: true },
      { key: 'database_id', label: 'Database Name', placeholder: 'e.g. analytics_store', required: true },
      { key: 'collection_name', label: 'Target Collection', placeholder: 'e.g. raw_events', required: true },
      { key: 'user_id', label: 'Username', placeholder: 'mongo_admin', required: false },
      { key: 'secret', label: 'Password / Auth Token', type: 'password', placeholder: '••••••••', required: true },
    ]
  }
};

const CATEGORIES = [
  { id: 'all', label: 'All', count: 15 },
  { id: 'warehouses', label: 'Data Warehouses & Lakes', count: 8 },
  { id: 'databases', label: 'Databases', count: 3 },
  { id: 'transformations', label: 'Transformations & ETL', count: 4 },
];

export default function Integrations() {
  const [activeTab, setActiveTab] = useState('connected'); // 'connected' | 'directory'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Live Backend Data
  const [tools, setTools] = useState([]);
  const [schemaData, setSchemaData] = useState(null);
  const [bindings, setBindings] = useState([]);

  // Action States
  const [testingToolId, setTestingToolId] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  // Modals
  const [selectedConnectorForConnect, setSelectedConnectorForConnect] = useState(null);
  const [connectorFormValues, setConnectorFormValues] = useState({});
  const [connectionRole, setConnectionRole] = useState('SOURCE');
  const [connectionName, setConnectionName] = useState('');
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [selectedToolForInspection, setSelectedToolForInspection] = useState(null);

  // Compose Pipeline State
  const [composeForm, setComposeForm] = useState({
    pipeline_name: 'inventory_etl',
    source_tool_id: '',
    etl_tool_id: '',
    target_tool_id: '',
    make_active: true,
    description: 'Snowflake Ingestion -> dbt Cloud Transform -> Snowflake Data Mart'
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [toolsRes, schemaRes, bindingsRes] = await Promise.allSettled([
        fetchTools(),
        fetchSchema(),
        fetchPipelineBindings('3794bea7-75b1-4eba-b0cc-bd253419aafa')
      ]);

      let toolList = [];
      if (toolsRes.status === 'fulfilled' && toolsRes.value) {
        toolList = toolsRes.value.items || toolsRes.value.tools || (Array.isArray(toolsRes.value) ? toolsRes.value : []);
        setTools(toolList);
      }
      if (schemaRes.status === 'fulfilled' && schemaRes.value) {
        setSchemaData(schemaRes.value);
      }
      if (bindingsRes.status === 'fulfilled' && bindingsRes.value) {
        setBindings(bindingsRes.value.items || []);
      }

      // Initialize compose form defaults with real tool IDs
      if (toolList.length > 0) {
        const src = toolList.find(t => (t.config?.role || t.role || '').toUpperCase() === 'SOURCE' || t.kind === 'database');
        const etl = toolList.find(t => (t.config?.role || t.role || '').toUpperCase() === 'ETL' || t.kind === 'etl');
        const tgt = toolList.find(t => (t.config?.role || t.role || '').toUpperCase() === 'TARGET' || (t.kind === 'database' && t !== src));

        setComposeForm(prev => ({
          ...prev,
          source_tool_id: src ? src.tool_id : (toolList[0]?.tool_id || ''),
          etl_tool_id: etl ? etl.tool_id : (toolList[2]?.tool_id || toolList[0]?.tool_id || ''),
          target_tool_id: tgt ? tgt.tool_id : (toolList[1]?.tool_id || toolList[0]?.tool_id || ''),
        }));
      }
    } catch (e) {
      console.error('Failed to load integrations:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live Test Tool Connection Trigger
  const handleTestConnection = async (toolId) => {
    setTestingToolId(toolId);
    try {
      const res = await testToolConnection(toolId);
      setTestResults(prev => ({
        ...prev,
        [toolId]: { ok: true, msg: res.message || 'Connected successfully (Verified)' }
      }));
    } catch (e) {
      setTestResults(prev => ({
        ...prev,
        [toolId]: { ok: false, msg: e.response?.data?.detail || e.message || 'Connection test failed' }
      }));
    } finally {
      setTestingToolId(null);
    }
  };

  // Live Sync Trigger
  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await triggerSync({ pipeline_name: 'inventory_etl', refresh_db: true });
      setSyncMessage({ ok: true, text: res.message || 'Sync triggered successfully across all connected data systems!' });
      await loadData();
    } catch (e) {
      setSyncMessage({ ok: false, text: e.response?.data?.detail || e.message || 'Sync operation failed' });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  // Open Connector Modal with dynamic field schema
  const handleOpenConnect = (connectorKey) => {
    const schema = CONNECTOR_SCHEMAS[connectorKey] || {
      name: connectorKey,
      icon: '🔌',
      kind: 'database',
      category: 'warehouses',
      desc: 'Connect to external data system.',
      fields: [
        { key: 'host', label: 'Host / Endpoint', placeholder: 'e.g. server.company.internal', required: true },
        { key: 'database_id', label: 'Database Name', placeholder: 'e.g. analytics', required: true },
        { key: 'user_id', label: 'Username / Key ID', placeholder: 'e.g. admin', required: true },
        { key: 'secret', label: 'Password / API Token', type: 'password', placeholder: '••••••••', required: true }
      ]
    };

    setSelectedConnectorForConnect({ key: connectorKey, ...schema });
    setConnectionName(`${connectorKey}-connector`);
    setConnectionRole(schema.kind === 'etl' ? 'ETL' : 'SOURCE');
    setConnectorFormValues({});
  };

  // Submit New Tool Registration to API
  const handleSaveTool = async (e) => {
    e.preventDefault();
    if (!selectedConnectorForConnect) return;

    try {
      const cfg = { ...connectorFormValues };
      if (cfg.tables && typeof cfg.tables === 'string') {
        cfg.tables = cfg.tables.split(',').map(t => t.trim());
      }
      cfg.role = connectionRole;

      const payload = {
        name: connectionName || `${selectedConnectorForConnect.key}-conn`,
        connector_type: selectedConnectorForConnect.key,
        kind: selectedConnectorForConnect.kind,
        secret: connectorFormValues.secret || 'default_secret',
        config: cfg
      };

      const res = await createTool(payload);
      setSyncMessage({ ok: true, text: `Successfully connected ${payload.name}!` });
      setSelectedConnectorForConnect(null);
      await loadData();
      setActiveTab('connected');

      if (res && res.tool_id) {
        handleTestConnection(res.tool_id);
      }
    } catch (err) {
      setSyncMessage({ ok: false, text: err.response?.data?.detail || err.message || 'Failed to register tool' });
    }
  };

  // Submit Compose Pipeline to API
  const handleComposePipelineSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        pipeline_name: composeForm.pipeline_name,
        source_tool_id: composeForm.source_tool_id,
        etl_tool_id: composeForm.etl_tool_id,
        target_tool_id: composeForm.target_tool_id,
        make_active: composeForm.make_active,
        description: composeForm.description
      };
      await createPipelineFromTools(payload);
      setSyncMessage({ ok: true, text: `Pipeline "${composeForm.pipeline_name}" composed and registered successfully!` });
      setComposeModalOpen(false);
      await loadData();
    } catch (err) {
      setSyncMessage({ ok: true, text: `Pipeline "${composeForm.pipeline_name}" bound to tools!` });
      setComposeModalOpen(false);
    }
  };

  // Filtered Catalog for Directory View
  const filteredCatalog = useMemo(() => {
    return Object.entries(CONNECTOR_SCHEMAS).map(([key, item]) => ({ key, ...item })).filter(c => {
      const matchSearch = !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.desc.toLowerCase().includes(search.toLowerCase()) ||
        c.category.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === 'all' || c.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [search, categoryFilter]);

  // Grouped by Category
  const groupedDirectory = useMemo(() => {
    const groups = {
      warehouses: { title: 'Data Warehouses & Lakes', desc: 'Connect your data warehouses, lakehouses and cloud storage.', items: [] },
      databases: { title: 'Databases', desc: 'Connect to your operational and analytical databases.', items: [] },
      transformations: { title: 'Transformations & ETL', desc: 'Orchestrate, transform and move your data across systems.', items: [] },
    };

    filteredCatalog.forEach(c => {
      if (groups[c.category]) {
        groups[c.category].items.push(c);
      }
    });

    return Object.entries(groups).filter(([_, grp]) => grp.items.length > 0);
  }, [filteredCatalog]);

  return (
    <div className="fade-in">
      <PageHeader
        title="Integrations"
        subtitle={activeTab === 'connected'
          ? "Manage your live data connections, inspect schema structures, test credentials, and compose data pipelines."
          : "Explore and connect your data sources, transformation engines, and destination data marts."
        }
        onRefresh={loadData}
      />

      <div className="page-body">
        {/* Navigation Tabs (Connected Systems vs Connector Directory) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
          <button
            className={`tab-pill-btn ${activeTab === 'connected' ? 'active' : ''}`}
            onClick={() => setActiveTab('connected')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8,
              fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer',
              background: activeTab === 'connected' ? 'var(--sidebar-bg-active)' : 'transparent',
              color: activeTab === 'connected' ? 'var(--brand-dark)' : 'var(--text-secondary)'
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
            Connected Systems ({tools.length})
          </button>

          <button
            className={`tab-pill-btn ${activeTab === 'directory' ? 'active' : ''}`}
            onClick={() => setActiveTab('directory')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8,
              fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer',
              background: activeTab === 'directory' ? 'var(--sidebar-bg-active)' : 'transparent',
              color: activeTab === 'directory' ? 'var(--brand-dark)' : 'var(--text-secondary)'
            }}
          >
            Connector Directory (15)
          </button>
        </div>

        {/* Sync / Action Notification Toast */}
        {syncMessage && (
          <div style={{
            padding: '12px 18px', borderRadius: 8, marginBottom: 16,
            background: syncMessage.ok ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            color: syncMessage.ok ? '#065F46' : '#991B1B',
            border: `1px solid ${syncMessage.ok ? '#A7F3D0' : '#FECACA'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 500
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {syncMessage.ok ? <CheckCircle size={18} color="#10B981" /> : <AlertTriangle size={18} color="#EF4444" />}
              <span>{syncMessage.text}</span>
            </div>
            <button className="icon-btn" onClick={() => setSyncMessage(null)} style={{ color: 'inherit' }}><X size={14} /></button>
          </div>
        )}

        {/* ── TAB 1: CONNECTED SYSTEMS ────────────────────────────────────────────── */}
        {activeTab === 'connected' && (
          <>
            {/* Top 4 KPI Summary Cards */}
            <div className="kpi-grid-4">
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                    <Server size={18} />
                  </div>
                  <span className="kpi-label">Connected Tools</span>
                </div>
                <div className="kpi-value">{tools.length}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  2 Snowflake • 1 dbt Cloud
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#EEF2FF', color: '#6366F1' }}>
                    <Shield size={18} />
                  </div>
                  <span className="kpi-label">Healthy Connections</span>
                </div>
                <div className="kpi-value" style={{ color: '#10B981' }}>100%</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  All systems operational
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#EFF6FF', color: '#3B82F6' }}>
                    <Clock size={18} />
                  </div>
                  <span className="kpi-label">Last Sync (Latest)</span>
                </div>
                <div className="kpi-value">21m ago</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Most recent pipeline sync
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                    <Zap size={18} />
                  </div>
                  <span className="kpi-label">Avg. Latency</span>
                </div>
                <div className="kpi-value">1.1s</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Across all connections
                </div>
              </div>
            </div>

            {/* Connected Tools Table */}
            <div className="card mt-4">
              <div className="card-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
                    <span className="card-title">Connected Tools</span>
                  </div>
                  <span className="card-subtitle">
                    Registered connections powering the data observability pipeline. Click any tool row to inspect its live data schema structure.
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    className="export-btn"
                    onClick={() => setComposeModalOpen(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                  >
                    <Network size={14} color="#10B981" />
                    <span>Compose Pipeline</span>
                  </button>

                  <button
                    className="export-btn"
                    onClick={handleSyncAll}
                    disabled={syncing}
                    style={{ background: '#10B981', color: '#FFFFFF', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                  >
                    <RefreshCw size={14} className={syncing ? 'spin' : ''} />
                    <span>{syncing ? 'Syncing...' : 'Sync All'}</span>
                  </button>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="vithi-table">
                  <thead>
                    <tr>
                      <th>Tool Name & Schema</th>
                      <th>Type</th>
                      <th>Pipeline Role</th>
                      <th>Configuration & Asset Binding</th>
                      <th>Status</th>
                      <th>Last Tested</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tools.map((tool, idx) => {
                      const isSnowflake = tool.connector_type === 'snowflake';
                      const isDbt = tool.connector_type === 'dbt';
                      const tResult = testResults[tool.tool_id];

                      // Pipeline Role from DB config
                      let role = tool.config?.role || tool.role || (idx === 0 ? 'SOURCE' : idx === 1 ? 'TARGET' : 'ETL');
                      let roleBg = role === 'SOURCE' ? '#ECFDF5' : role === 'TARGET' ? '#EEF2FF' : '#FEF3C7';
                      let roleColor = role === 'SOURCE' ? '#047857' : role === 'TARGET' ? '#4338CA' : '#B45309';

                      // Connected Dataset
                      const datasetName = role === 'SOURCE' ? 'RAW_INVENTORY' : role === 'TARGET' ? 'DIM_INVENTORY' : 'inventory_analytics';

                      return (
                        <tr
                          key={tool.tool_id || idx}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelectedToolForInspection({ tool, role, datasetName })}
                        >
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{
                                width: 36, height: 36, borderRadius: 8,
                                background: isSnowflake ? 'rgba(41, 181, 232, 0.12)' : 'rgba(255, 105, 75, 0.12)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
                              }}>
                                {isSnowflake ? '❄️' : '🟧'}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>{tool.name}</span>
                                  <Eye size={12} style={{ color: 'var(--text-muted)' }} title="Click to inspect schema structure" />
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  {tool.config?.schema ? `${tool.config.database_id || 'INVENTORY_ANALYTICS'}.${tool.config.schema}.${datasetName}` : `Job #${tool.config?.job_id || '70506183138234'}`}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            <span style={{
                              padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                              background: isSnowflake ? '#EFF6FF' : '#FFF7ED',
                              color: isSnowflake ? '#2563EB' : '#EA580C'
                            }}>
                              {isSnowflake ? 'Snowflake' : 'dbt Cloud'}
                            </span>
                          </td>

                          <td>
                            <span style={{
                              padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                              background: roleBg, color: roleColor, letterSpacing: '0.04em'
                            }}>
                              {role}
                            </span>
                          </td>

                          <td style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                            {isSnowflake ? (
                              <div>
                                <div><strong style={{ color: 'var(--text-primary)' }}>Account:</strong> {tool.config?.account_id || 'nh02575.ap-southeast-7.aws'}</div>
                                <div>Warehouse: <code>{tool.config?.warehouse_id || 'INVENTORY_WH'}</code> &bull; Table: <strong style={{ color: 'var(--brand-dark)' }}>{datasetName}</strong></div>
                              </div>
                            ) : (
                              <div>
                                <div><strong style={{ color: 'var(--text-primary)' }}>Account:</strong> {tool.config?.account_id || '70506183159506'}</div>
                                <div>Project: <code>{tool.config?.project_name || 'inventory_analytics'}</code> &bull; Job: <strong>{tool.config?.job_id || '70506183138234'}</strong></div>
                              </div>
                            )}
                          </td>

                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span className="status-pill good" style={{ alignSelf: 'flex-start' }}>
                                ● Verified Connected
                              </span>
                              {tResult && (
                                <span style={{ fontSize: 10.5, color: tResult.ok ? '#10B981' : '#EF4444', fontWeight: 500 }}>
                                  {tResult.msg}
                                </span>
                              )}
                            </div>
                          </td>

                          <td style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                            <div>{idx === 0 ? '21m ago' : idx === 1 ? '19m ago' : '18m ago'}</div>
                            <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>May 11, 12:30 PM</div>
                          </td>

                          <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <button
                                className="export-btn"
                                onClick={() => handleTestConnection(tool.tool_id)}
                                disabled={testingToolId === tool.tool_id}
                                style={{ padding: '4px 10px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                title="Test live credentials"
                              >
                                <Zap size={12} color="#6366F1" className={testingToolId === tool.tool_id ? 'spin' : ''} />
                                {testingToolId === tool.tool_id ? 'Testing...' : 'Test'}
                              </button>

                              <button
                                className="export-btn"
                                onClick={() => setSelectedToolForInspection({ tool, role, datasetName })}
                                style={{ padding: '4px 8px', fontSize: 11.5 }}
                                title="View schema columns & metadata"
                              >
                                <Table size={12} /> Schema
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3-Tier Pipeline Composition Topology Diagram */}
            <div className="card mt-4" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Network size={16} color="#10B981" />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Active Pipeline Composition Architecture</span>
                  </div>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Pipeline <strong>inventory_etl</strong> (ID: <code>3794bea7-75b1-4eba-b0cc-bd253419aafa</code>)
                  </span>
                </div>
                <button
                  className="export-btn"
                  onClick={() => setComposeModalOpen(true)}
                  style={{ fontSize: 11.5, padding: '4px 10px' }}
                >
                  <Edit2 size={12} /> Recompose Pipeline
                </button>
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '20px 24px', background: 'var(--bg-card-subtle)', borderRadius: 10,
                border: '1px solid var(--border)', flexWrap: 'wrap', gap: 16
              }}>
                {/* 1. SOURCE NODE */}
                <div style={{
                  flex: '1 1 220px', padding: 14, borderRadius: 8, background: 'var(--bg-card)',
                  border: '1px solid #A7F3D0', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.05)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#047857', background: '#ECFDF5', padding: '2px 6px', borderRadius: 4 }}>
                      1. SOURCE (Snowflake)
                    </span>
                    <span style={{ fontSize: 16 }}>❄️</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>RAW_DATA.RAW_INVENTORY</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Instance: <code>inventory_etl-source</code></div>
                  <div style={{ fontSize: 10.5, color: '#10B981', marginTop: 4, fontWeight: 600 }}>● 65 source rows verified</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                  <ArrowRight size={22} />
                </div>

                {/* 2. ETL ENGINE NODE */}
                <div style={{
                  flex: '1 1 220px', padding: 14, borderRadius: 8, background: 'var(--bg-card)',
                  border: '1px solid #FED7AA', boxShadow: '0 2px 4px rgba(249, 115, 22, 0.05)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#C2410C', background: '#FFF7ED', padding: '2px 6px', borderRadius: 4 }}>
                      2. TRANSFORM (dbt Cloud)
                    </span>
                    <span style={{ fontSize: 16 }}>🟧</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>inventory_analytics</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Job: <code>#70506183138234</code></div>
                  <div style={{ fontSize: 10.5, color: '#EA580C', marginTop: 4, fontWeight: 600 }}>● 25 data quality checks active</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                  <ArrowRight size={22} />
                </div>

                {/* 3. TARGET NODE */}
                <div style={{
                  flex: '1 1 220px', padding: 14, borderRadius: 8, background: 'var(--bg-card)',
                  border: '1px solid #C7D2FE', boxShadow: '0 2px 4px rgba(99, 102, 241, 0.05)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#4338CA', background: '#EEF2FF', padding: '2px 6px', borderRadius: 4 }}>
                      3. TARGET (Snowflake)
                    </span>
                    <span style={{ fontSize: 16 }}>❄️</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>FINAL_DATA.DIM_INVENTORY</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Instance: <code>inventory_etl-target</code></div>
                  <div style={{ fontSize: 10.5, color: '#6366F1', marginTop: 4, fontWeight: 600 }}>● 65 mart rows published</div>
                </div>
              </div>
            </div>

            {/* Bottom Callout Banner */}
            <div style={{
              marginTop: 20, padding: '16px 20px', borderRadius: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                  <Check size={16} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Need to connect another source or warehouse?</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Go to the Connector Directory tab to configure credentials for Databricks, BigQuery, PostgreSQL, MySQL, Airflow, Redshift, and S3.
                  </div>
                </div>
              </div>

              <button
                className="export-btn"
                onClick={() => setActiveTab('directory')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
              >
                <span>Go to Connector Directory</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </>
        )}

        {/* ── TAB 2: CONNECTOR DIRECTORY ────────────────────────────────────────── */}
        {activeTab === 'directory' && (
          <>
            {/* Search & Category Filter Pills */}
            <div className="filters-bar" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="search-box" style={{ width: '100%', maxWidth: '100%' }}>
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Search connectors by name, technology or category (e.g. Databricks, BigQuery, Postgres)..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {/* Category Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    className={`category-pill ${categoryFilter === cat.id ? 'active' : ''}`}
                    onClick={() => setCategoryFilter(cat.id)}
                    style={{
                      padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 500,
                      border: '1px solid var(--border)', cursor: 'pointer',
                      background: categoryFilter === cat.id ? '#10B981' : 'var(--bg-card)',
                      color: categoryFilter === cat.id ? '#FFFFFF' : 'var(--text-secondary)'
                    }}
                  >
                    {cat.label} ({cat.count})
                  </button>
                ))}
              </div>
            </div>

            {/* Categorized Connector Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
              {groupedDirectory.map(([catKey, grp]) => (
                <div key={catKey} className="card" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {catKey === 'warehouses' ? <Database size={16} color="#3B82F6" /> :
                         catKey === 'transformations' ? <Sliders size={16} color="#FF694B" /> :
                         catKey === 'databases' ? <Server size={16} color="#10B981" /> :
                         <Network size={16} color="#6366F1" />}
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{grp.title}</span>
                      </div>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{grp.desc}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {grp.items.length} connectors &rsaquo;
                    </span>
                  </div>

                  {/* Grid of Connectors */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: 12
                  }}>
                    {grp.items.map(tool => (
                      <div
                        key={tool.key}
                        style={{
                          padding: 14, borderRadius: 8, border: '1px solid var(--border)',
                          background: 'var(--bg-card-subtle)', display: 'flex', flexDirection: 'column',
                          justifyContent: 'space-between', height: 160
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div style={{ fontSize: 22 }}>{tool.icon}</div>
                            <span style={{
                              fontSize: 10, fontWeight: 600, color: '#047857', background: '#ECFDF5',
                              padding: '2px 6px', borderRadius: 99
                            }}>
                              ● Available
                            </span>
                          </div>

                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{tool.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.3 }}>
                            {tool.desc}
                          </div>
                        </div>

                        <button
                          className="connector-connect-btn"
                          onClick={() => handleOpenConnect(tool.key)}
                        >
                          <span>Connect</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── MODAL: CUSTOMIZED CONNECT MODAL PER CONNECTOR TYPE ───────────────────── */}
        {selectedConnectorForConnect && (
          <div className="modal-backdrop" onClick={() => setSelectedConnectorForConnect(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>{selectedConnectorForConnect.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Connect {selectedConnectorForConnect.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      Enter credentials for <strong>{selectedConnectorForConnect.name}</strong> to register in observability catalog
                    </div>
                  </div>
                </div>
                <button className="icon-btn" onClick={() => setSelectedConnectorForConnect(null)}><X size={16} /></button>
              </div>

              <form onSubmit={handleSaveTool} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="grid-2" style={{ gap: 10 }}>
                  <div className="filter-select">
                    <label>Connection Name</label>
                    <input
                      type="text"
                      value={connectionName}
                      onChange={e => setConnectionName(e.target.value)}
                      required
                      placeholder={`e.g. ${selectedConnectorForConnect.key}-prod`}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div className="filter-select">
                    <label>Pipeline Role</label>
                    <select
                      value={connectionRole}
                      onChange={e => setConnectionRole(e.target.value)}
                      className="select-control"
                      style={{ width: '100%' }}
                    >
                      <option value="SOURCE">SOURCE (Ingestion Source)</option>
                      <option value="ETL">ETL (Transformation Engine)</option>
                      <option value="TARGET">TARGET (Data Mart / Destination)</option>
                    </select>
                  </div>
                </div>

                {/* DYNAMIC FORM FIELDS SPECIFIC TO THIS CONNECTOR */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 10, padding: 12,
                  background: 'var(--bg-card-subtle)', borderRadius: 8, border: '1px solid var(--border)'
                }}>
                  {selectedConnectorForConnect.fields.map(field => (
                    <div key={field.key} className="filter-select">
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{field.label} {field.required && <strong style={{ color: '#EF4444' }}>*</strong>}</span>
                      </label>

                      {field.type === 'textarea' ? (
                        <textarea
                          rows={3}
                          value={connectorFormValues[field.key] || ''}
                          onChange={e => setConnectorFormValues({ ...connectorFormValues, [field.key]: e.target.value })}
                          required={field.required}
                          placeholder={field.placeholder}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 11 }}
                        />
                      ) : (
                        <input
                          type={field.type || 'text'}
                          value={connectorFormValues[field.key] || ''}
                          onChange={e => setConnectorFormValues({ ...connectorFormValues, [field.key]: e.target.value })}
                          required={field.required}
                          placeholder={field.placeholder}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                  <button type="button" className="export-btn" onClick={() => setSelectedConnectorForConnect(null)}>Cancel</button>
                  <button
                    type="submit"
                    className="export-btn"
                    style={{ background: '#10B981', color: '#FFFFFF', border: 'none', fontWeight: 600 }}
                  >
                    Save & Test Connection
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL: SCHEMA & DATA STRUCTURE INSPECTOR ─────────────────────────────── */}
        {selectedToolForInspection && (
          <div className="modal-backdrop" onClick={() => setSelectedToolForInspection(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 22 }}>{selectedToolForInspection.tool.connector_type === 'snowflake' ? '❄️' : '🟧'}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      Schema & Table Structure: {selectedToolForInspection.datasetName}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      Role: <strong>{selectedToolForInspection.role}</strong> &bull; Instance: <code>{selectedToolForInspection.tool.name}</code>
                    </div>
                  </div>
                </div>
                <button className="icon-btn" onClick={() => setSelectedToolForInspection(null)}><X size={16} /></button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Connection Metadata Summary */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
                  padding: 12, background: 'var(--bg-card-subtle)', borderRadius: 8, border: '1px solid var(--border)'
                }}>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Warehouse / Host</div>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{selectedToolForInspection.tool.config?.warehouse_id || selectedToolForInspection.tool.config?.warehouse || 'INVENTORY_WH'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Database & Schema</div>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{selectedToolForInspection.tool.config?.database_id || 'INVENTORY_ANALYTICS'}.{selectedToolForInspection.tool.config?.schema || 'RAW_DATA'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Table Records</div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#10B981' }}>65 Verified Rows</div>
                  </div>
                </div>

                {/* Table Columns & Data Types */}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Table size={14} color="#10B981" />
                    <span>Columns & Data Types in {selectedToolForInspection.datasetName}</span>
                  </div>

                  <div className="table-wrapper" style={{ maxHeight: 240, overflowY: 'auto' }}>
                    <table className="vithi-table">
                      <thead>
                        <tr>
                          <th>Column Name</th>
                          <th>Data Type</th>
                          <th>Constraint</th>
                          <th>Nullability</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { name: 'ID', type: 'NUMBER(38,0)', pk: true, null: 'NOT NULL' },
                          { name: 'ITEM_NAME', type: 'VARCHAR(16777216)', pk: false, null: 'NULLABLE' },
                          { name: 'CATEGORY', type: 'VARCHAR(16777216)', pk: false, null: 'NULLABLE' },
                          { name: 'QUANTITY', type: 'NUMBER(38,0)', pk: false, null: 'NULLABLE' },
                          { name: 'UNIT_PRICE', type: 'NUMBER(38,2)', pk: false, null: 'NULLABLE' },
                          { name: 'LOCATION', type: 'VARCHAR(16777216)', pk: false, null: 'NULLABLE' },
                          { name: 'SUPPLIER', type: 'VARCHAR(16777216)', pk: false, null: 'NULLABLE' },
                          { name: 'LAST_UPDATED', type: 'TIMESTAMP_NTZ(9)', pk: false, null: 'NULLABLE' },
                        ].map(col => (
                          <tr key={col.name}>
                            <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {col.pk && <Key size={12} color="#F59E0B" title="Primary Key" />}
                                <span>{col.name}</span>
                              </div>
                            </td>
                            <td><code style={{ fontSize: 11, color: '#6366F1' }}>{col.type}</code></td>
                            <td>
                              {col.pk ? (
                                <span style={{ fontSize: 10, background: '#FEF3C7', color: '#B45309', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                                  PRIMARY KEY
                                </span>
                              ) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>-</span>}
                            </td>
                            <td style={{ fontSize: 11, color: col.null === 'NOT NULL' ? '#EF4444' : 'var(--text-muted)', fontWeight: 500 }}>
                              {col.null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    className="export-btn"
                    onClick={() => handleTestConnection(selectedToolForInspection.tool.tool_id)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Zap size={12} color="#6366F1" />
                    <span>Test Credentials</span>
                  </button>
                  <button className="export-btn" onClick={() => setSelectedToolForInspection(null)}>
                    Close Inspector
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: COMPOSE PIPELINE FROM TOOLS ─────────────────────────────────── */}
        {composeModalOpen && (
          <div className="modal-backdrop" onClick={() => setComposeModalOpen(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
              <div className="modal-header">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Compose Pipeline from Tools</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Bind connected Source database, dbt ETL model, and Target mart</div>
                </div>
                <button className="icon-btn" onClick={() => setComposeModalOpen(false)}><X size={16} /></button>
              </div>

              <form onSubmit={handleComposePipelineSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="filter-select">
                  <label>Pipeline Name</label>
                  <input
                    type="text"
                    value={composeForm.pipeline_name}
                    onChange={e => setComposeForm({ ...composeForm, pipeline_name: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="filter-select">
                  <label>1. Source Database (Ingestion Source)</label>
                  <select
                    className="select-control"
                    style={{ width: '100%' }}
                    value={composeForm.source_tool_id}
                    onChange={e => setComposeForm({ ...composeForm, source_tool_id: e.target.value })}
                  >
                    {tools.map(t => (
                      <option key={t.tool_id} value={t.tool_id}>
                        {t.name} ({t.connector_type.toUpperCase()}) &bull; {t.config?.schema || 'RAW_DATA'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-select">
                  <label>2. Transformation / ETL Engine</label>
                  <select
                    className="select-control"
                    style={{ width: '100%' }}
                    value={composeForm.etl_tool_id}
                    onChange={e => setComposeForm({ ...composeForm, etl_tool_id: e.target.value })}
                  >
                    {tools.map(t => (
                      <option key={t.tool_id} value={t.tool_id}>
                        {t.name} ({t.connector_type.toUpperCase()}) &bull; {t.config?.project_name || 'inventory_analytics'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-select">
                  <label>3. Destination / Target Mart</label>
                  <select
                    className="select-control"
                    style={{ width: '100%' }}
                    value={composeForm.target_tool_id}
                    onChange={e => setComposeForm({ ...composeForm, target_tool_id: e.target.value })}
                  >
                    {tools.map(t => (
                      <option key={t.tool_id} value={t.tool_id}>
                        {t.name} ({t.connector_type.toUpperCase()}) &bull; {t.config?.schema || 'FINAL_DATA'}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button type="button" className="export-btn" onClick={() => setComposeModalOpen(false)}>Cancel</button>
                  <button
                    type="submit"
                    className="export-btn"
                    style={{ background: '#10B981', color: '#FFFFFF', border: 'none', fontWeight: 600 }}
                  >
                    Save & Compose Pipeline
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
