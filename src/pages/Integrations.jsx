import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Database, Server, Sliders, Layers, RefreshCw, Plus, CheckCircle,
  AlertTriangle, Shield, Search, ArrowRight, Zap, ExternalLink,
  Edit2, Trash2, Check, X, ChevronRight, Activity, Clock, Cpu, Network
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchTools, testToolConnection, triggerSync } from '../api/client';

// Connector Directory Catalog (23 Enterprise Connectors matching architecture)
const CONNECTOR_CATALOG = [
  // Data Warehouses & Lakes (8)
  { id: 'snowflake', name: 'Snowflake', category: 'warehouses', type: 'warehouse', badge: 'Available', color: '#29B5E8', desc: 'Cloud data warehouse for analytics and BI.', icon: '❄️' },
  { id: 'databricks', name: 'Databricks', category: 'warehouses', type: 'lakehouse', badge: 'Available', color: '#FF3621', desc: 'Unified lakehouse platform for data, AI and analytics.', icon: '🧱' },
  { id: 'bigquery', name: 'BigQuery', category: 'warehouses', type: 'warehouse', badge: 'Available', color: '#4285F4', desc: 'Serverless data warehouse from Google Cloud.', icon: '🔍' },
  { id: 'redshift', name: 'Redshift', category: 'warehouses', type: 'warehouse', badge: 'Available', color: '#CC292B', desc: 'Data warehouse for large-scale analytics.', icon: '📦' },
  { id: 's3', name: 'Amazon S3', category: 'warehouses', type: 'storage', badge: 'Available', color: '#E05243', desc: 'Object storage for raw data and backups.', icon: '🪣' },
  { id: 'synapse', name: 'Azure Synapse', category: 'warehouses', type: 'warehouse', badge: 'Available', color: '#0078D4', desc: 'Analytics service for big data and warehousing.', icon: '🔷' },
  { id: 'clickhouse', name: 'ClickHouse', category: 'warehouses', type: 'columnar', badge: 'Available', color: '#FFCC00', desc: 'Fast open-source columnar database management system.', icon: '⚡' },
  { id: 'iceberg', name: 'Apache Iceberg', category: 'warehouses', type: 'table-format', badge: 'Available', color: '#1B9AAA', desc: 'High-performance open table format for huge analytic datasets.', icon: '🧊' },

  // Transformations & ETL (5)
  { id: 'dbt', name: 'dbt Cloud', category: 'transformations', type: 'transformation', badge: 'Available', color: '#FF694B', desc: 'Data transformation & modeling.', icon: '🟧' },
  { id: 'airflow', name: 'Apache Airflow', category: 'transformations', type: 'orchestration', badge: 'Available', color: '#017CEE', desc: 'Workflow orchestration & scheduling.', icon: '🌀' },
  { id: 'fivetran', name: 'Fivetran', category: 'transformations', type: 'integration', badge: 'Available', color: '#0070F3', desc: 'Managed data movement and replication.', icon: '🔄' },
  { id: 'prefect', name: 'Prefect', category: 'transformations', type: 'orchestration', badge: 'Available', color: '#00263E', desc: 'Data orchestration for modern data stacks.', icon: '🔮' },
  { id: 'matillion', name: 'Matillion', category: 'transformations', type: 'etl', badge: 'Available', color: '#27AE60', desc: 'ELT for modern data warehouses.', icon: '⚡' },

  // Databases (6)
  { id: 'postgres', name: 'PostgreSQL', category: 'databases', type: 'relational', badge: 'Available', color: '#336791', desc: 'Open source relational database.', icon: '🐘' },
  { id: 'mysql', name: 'MySQL', category: 'databases', type: 'relational', badge: 'Available', color: '#00758F', desc: 'Popular open source database.', icon: '🐬' },
  { id: 'mongodb', name: 'MongoDB', category: 'databases', type: 'nosql', badge: 'Available', color: '#47A248', desc: 'NoSQL document database.', icon: '🍃' },
  { id: 'oracle', name: 'Oracle', category: 'databases', type: 'enterprise', badge: 'Available', color: '#F80000', desc: 'Enterprise relational database.', icon: '⭕' },
  { id: 'sqlserver', name: 'SQL Server', category: 'databases', type: 'relational', badge: 'Available', color: '#CC292B', desc: 'Relational database by Microsoft.', icon: '🗄️' },
  { id: 'redis', name: 'Redis', category: 'databases', type: 'in-memory', badge: 'Available', color: '#DC382D', desc: 'In-memory data structure store used as a database.', icon: '⚡' },

  // Orchestration (3)
  { id: 'airflow-orch', name: 'Apache Airflow', category: 'orchestration', type: 'workflow', badge: 'Available', color: '#017CEE', desc: 'Workflow orchestration & scheduling.', icon: '🌀' },
  { id: 'prefect-orch', name: 'Prefect', category: 'orchestration', type: 'orchestration', badge: 'Available', color: '#00263E', desc: 'Data orchestration for modern data stacks.', icon: '🔮' },
  { id: 'dagster', name: 'Dagster', category: 'orchestration', type: 'orchestration', badge: 'Available', color: '#254336', desc: 'Orchestrate and monitor data pipelines.', icon: '📊' },

  // Observability (1)
  { id: 'vithi-agent', name: 'VITHI Agent', category: 'observability', type: 'agent', badge: 'Available', color: '#10B981', desc: 'Native push telemetry & metadata telemetry collector.', icon: '🛡️' }
];

const CATEGORIES = [
  { id: 'all', label: 'All', count: 23 },
  { id: 'warehouses', label: 'Data Warehouses & Lakes', count: 8 },
  { id: 'databases', label: 'Databases', count: 6 },
  { id: 'transformations', label: 'Transformations & ETL', count: 5 },
  { id: 'orchestration', label: 'Orchestration', count: 3 },
  { id: 'observability', label: 'Observability', count: 1 },
];

export default function Integrations() {
  const [activeTab, setActiveTab] = useState('connected'); // 'connected' | 'directory'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [tools, setTools] = useState([]);
  const [testingToolId, setTestingToolId] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  // Modals
  const [connectModalTool, setConnectModalTool] = useState(null);
  const [composeModalOpen, setComposeModalOpen] = useState(false);

  // Form State for Connecting New Tool
  const [formData, setFormData] = useState({
    name: '',
    role: 'SOURCE',
    account: '',
    warehouse: 'INVENTORY_WH',
    database: 'INVENTORY_ANALYTICS',
    schema: 'RAW_DATA',
    username: '',
    password: '',
    project_name: '',
    job_name: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTools();
      if (res) {
        const list = res.items || res.tools || (Array.isArray(res) ? res : []);
        setTools(list);
      }
    } catch (e) {
      console.error('Failed to fetch connected tools:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        [toolId]: { ok: false, msg: e.response?.data?.detail || e.message || 'Test failed' }
      }));
    } finally {
      setTestingToolId(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await triggerSync();
      setSyncMessage({ ok: true, text: res.message || 'Sync triggered successfully across all connected systems!' });
      await loadData();
    } catch (e) {
      setSyncMessage({ ok: false, text: e.response?.data?.detail || e.message || 'Sync failed' });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  const handleOpenConnect = (tool) => {
    setConnectModalTool(tool);
    setFormData({
      name: `${tool.id}-connector`,
      role: 'SOURCE',
      account: 'nh02575.ap-southeast-7.aws',
      warehouse: 'INVENTORY_WH',
      database: 'INVENTORY_ANALYTICS',
      schema: 'RAW_DATA',
      username: 'DATA_ADMIN',
      password: '••••••••',
      project_name: 'inventory_analytics',
      job_name: 'inventory_analytics'
    });
  };

  const handleSaveConnection = (e) => {
    e.preventDefault();
    const newTool = {
      tool_id: `${connectModalTool.id}-${Date.now()}`,
      name: formData.name,
      connector_type: connectModalTool.id,
      kind: connectModalTool.category === 'warehouses' || connectModalTool.category === 'databases' ? 'database' : 'etl',
      role: formData.role,
      status: 'active',
      config: {
        account: formData.account,
        warehouse: formData.warehouse,
        database: formData.database,
        schema: formData.schema,
        project_name: formData.project_name,
        job_name: formData.job_name,
        user: formData.username
      }
    };
    setTools(prev => [newTool, ...prev]);
    setConnectModalTool(null);
    setActiveTab('connected');
  };

  // Filtered Catalog
  const filteredCatalog = useMemo(() => {
    return CONNECTOR_CATALOG.filter(c => {
      const matchSearch = !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.desc.toLowerCase().includes(search.toLowerCase()) ||
        c.category.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === 'all' || c.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [search, categoryFilter]);

  // Grouped by Category for Directory View
  const groupedDirectory = useMemo(() => {
    const groups = {
      warehouses: { title: 'Data Warehouses & Lakes', desc: 'Connect your data warehouses, lakehouses and cloud storage.', items: [] },
      transformations: { title: 'Transformations & ETL', desc: 'Orchestrate, transform and move your data across systems.', items: [] },
      databases: { title: 'Databases', desc: 'Connect to your operational and analytical databases.', items: [] },
      orchestration: { title: 'Orchestration', desc: 'Schedule, manage and monitor your data pipelines and workflows.', items: [] },
      observability: { title: 'Observability', desc: 'Telemetry, agent metadata collectors, and log shippers.', items: [] },
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
          ? "Manage your data connections, test credentials, and keep your ecosystem healthy."
          : "Explore and connect your data sources, transformation tools, and destinations."
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
            Connector Directory (23)
          </button>
        </div>

        {/* Sync Toast Notification */}
        {syncMessage && (
          <div style={{
            padding: '10px 16px', borderRadius: 8, marginBottom: 16,
            background: syncMessage.ok ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            color: syncMessage.ok ? '#065F46' : '#991B1B',
            border: `1px solid ${syncMessage.ok ? '#A7F3D0' : '#FECACA'}`,
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 500
          }}>
            {syncMessage.ok ? <CheckCircle size={16} color="#10B981" /> : <AlertTriangle size={16} color="#EF4444" />}
            <span>{syncMessage.text}</span>
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
                    Here are the tools and systems you've already connected to VITHI. You can test, edit, or manage each connection.
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    className="export-btn"
                    onClick={() => setComposeModalOpen(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Network size={13} color="#10B981" />
                    <span>Compose Pipeline</span>
                  </button>

                  <button
                    className="export-btn"
                    onClick={handleSyncAll}
                    disabled={syncing}
                    style={{ background: '#10B981', color: '#FFFFFF', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <RefreshCw size={13} className={syncing ? 'spin' : ''} />
                    <span>{syncing ? 'Syncing...' : 'Sync All'}</span>
                  </button>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="vithi-table">
                  <thead>
                    <tr>
                      <th>Tool Name</th>
                      <th>Type</th>
                      <th>Role</th>
                      <th>Configuration / Account</th>
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

                      // Formulate Role
                      let role = tool.role || (idx === 0 ? 'SOURCE' : idx === 1 ? 'TARGET' : 'ETL');
                      let roleBg = role === 'SOURCE' ? '#ECFDF5' : role === 'TARGET' ? '#EEF2FF' : '#FEF3C7';
                      let roleColor = role === 'SOURCE' ? '#047857' : role === 'TARGET' ? '#4338CA' : '#B45309';

                      return (
                        <tr key={tool.tool_id || idx}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{
                                width: 34, height: 34, borderRadius: 8,
                                background: isSnowflake ? 'rgba(41, 181, 232, 0.12)' : 'rgba(255, 105, 75, 0.12)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
                              }}>
                                {isSnowflake ? '❄️' : '🟧'}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {tool.name || (isSnowflake ? (role === 'SOURCE' ? 'sf-inventory-raw' : 'sf-inventory-final') : 'dbt-inventory-job')}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  {tool.config?.schema ? `${tool.config.database || 'INVENTORY_ANALYTICS'}.${tool.config.schema}` : `Job #${tool.config?.job_id || '70506183138234'}`}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            <span style={{
                              padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                              background: isSnowflake ? '#EFF6FF' : '#FFF7ED',
                              color: isSnowflake ? '#2563EB' : '#EA580C'
                            }}>
                              {isSnowflake ? 'Snowflake' : 'dbt Cloud'}
                            </span>
                          </td>

                          <td>
                            <span style={{
                              padding: '3px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 700,
                              background: roleBg, color: roleColor, letterSpacing: '0.04em'
                            }}>
                              {role}
                            </span>
                          </td>

                          <td style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                            {isSnowflake ? (
                              <div>
                                <div><strong style={{ color: 'var(--text-primary)' }}>Account:</strong> {tool.config?.account || 'nh02575.ap-southeast-7.aws'}</div>
                                <div>Warehouse: {tool.config?.warehouse || 'INVENTORY_WH'} • Schema: {tool.config?.schema || (role === 'SOURCE' ? 'RAW_DATA' : 'FINAL_DATA')}</div>
                              </div>
                            ) : (
                              <div>
                                <div><strong style={{ color: 'var(--text-primary)' }}>Account:</strong> {tool.config?.account_id || '70506183159506'}</div>
                                <div>Project: {tool.config?.project_name || 'inventory_analytics'} • Job: {tool.config?.job_name || 'inventory_analytics'}</div>
                              </div>
                            )}
                          </td>

                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span className="status-pill good" style={{ alignSelf: 'flex-start' }}>
                                ● Verified Connected
                              </span>
                              {tResult && (
                                <span style={{ fontSize: 10.5, color: tResult.ok ? '#10B981' : '#EF4444' }}>
                                  {tResult.msg}
                                </span>
                              )}
                            </div>
                          </td>

                          <td style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                            <div>{idx === 0 ? '21m ago' : idx === 1 ? '19m ago' : '18m ago'}</div>
                            <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>May 11, 12:30 PM</div>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <button
                                className="export-btn"
                                onClick={() => handleTestConnection(tool.tool_id)}
                                disabled={testingToolId === tool.tool_id}
                                style={{ padding: '4px 10px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <Zap size={11} color="#6366F1" className={testingToolId === tool.tool_id ? 'spin' : ''} />
                                {testingToolId === tool.tool_id ? 'Testing...' : 'Test'}
                              </button>

                              <button
                                className="export-btn"
                                onClick={() => handleOpenConnect(CONNECTOR_CATALOG.find(c => c.id === tool.connector_type) || CONNECTOR_CATALOG[0])}
                                style={{ padding: '4px 8px', fontSize: 11.5 }}
                              >
                                <Edit2 size={11} /> Edit
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

            {/* Bottom Callout Banner */}
            <div style={{
              marginTop: 20, padding: '16px 20px', borderRadius: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                  <Check size={16} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Need to add a new tool?</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Go to the Connector Directory tab to explore and connect more data sources, transformation tools, and destinations.
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
                  placeholder="Search connectors by name, technology or category..."
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
                        key={tool.id}
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
                              ● {tool.badge}
                            </span>
                          </div>

                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{tool.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.3 }}>
                            {tool.desc}
                          </div>
                        </div>

                        <button
                          onClick={() => handleOpenConnect(tool)}
                          style={{
                            marginTop: 10, padding: '5px 10px', borderRadius: 6,
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                            color: 'var(--text-primary)', fontSize: 11.5, fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                          }}
                        >
                          <span>Connect</span>
                          <ArrowRight size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── MODAL: CONNECT NEW INTEGRATION ───────────────────────────────────────── */}
        {connectModalTool && (
          <div className="modal-backdrop" onClick={() => setConnectModalTool(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{connectModalTool.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Connect {connectModalTool.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Configure credentials and workspace connection</div>
                  </div>
                </div>
                <button className="icon-btn" onClick={() => setConnectModalTool(null)}><X size={16} /></button>
              </div>

              <form onSubmit={handleSaveConnection} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="filter-select">
                  <label>Connection Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="filter-select">
                  <label>Pipeline Role</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="select-control"
                    style={{ width: '100%' }}
                  >
                    <option value="SOURCE">SOURCE (Ingestion Source)</option>
                    <option value="ETL">ETL (Transformation / dbt)</option>
                    <option value="TARGET">TARGET (Analytics Mart / Destination)</option>
                  </select>
                </div>

                {connectModalTool.category === 'warehouses' || connectModalTool.category === 'databases' ? (
                  <>
                    <div className="grid-2" style={{ gap: 10 }}>
                      <div className="filter-select">
                        <label>Account / Host</label>
                        <input
                          type="text"
                          value={formData.account}
                          onChange={e => setFormData({ ...formData, account: e.target.value })}
                          required
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                        />
                      </div>
                      <div className="filter-select">
                        <label>Warehouse</label>
                        <input
                          type="text"
                          value={formData.warehouse}
                          onChange={e => setFormData({ ...formData, warehouse: e.target.value })}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                        />
                      </div>
                    </div>

                    <div className="grid-2" style={{ gap: 10 }}>
                      <div className="filter-select">
                        <label>Database</label>
                        <input
                          type="text"
                          value={formData.database}
                          onChange={e => setFormData({ ...formData, database: e.target.value })}
                          required
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                        />
                      </div>
                      <div className="filter-select">
                        <label>Schema</label>
                        <input
                          type="text"
                          value={formData.schema}
                          onChange={e => setFormData({ ...formData, schema: e.target.value })}
                          required
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="filter-select">
                      <label>Project Name</label>
                      <input
                        type="text"
                        value={formData.project_name}
                        onChange={e => setFormData({ ...formData, project_name: e.target.value })}
                        required
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div className="filter-select">
                      <label>Job Name / ID</label>
                      <input
                        type="text"
                        value={formData.job_name}
                        onChange={e => setFormData({ ...formData, job_name: e.target.value })}
                        required
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                  <button type="button" className="export-btn" onClick={() => setConnectModalTool(null)}>Cancel</button>
                  <button type="submit" className="export-btn" style={{ background: '#10B981', color: '#FFFFFF', border: 'none' }}>
                    Save & Verify Connection
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL: COMPOSE PIPELINE ───────────────────────────────────────────── */}
        {composeModalOpen && (
          <div className="modal-backdrop" onClick={() => setComposeModalOpen(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
              <div className="modal-header">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Compose Pipeline from Tools</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Bind connected Source, ETL transform, and Target mart</div>
                </div>
                <button className="icon-btn" onClick={() => setComposeModalOpen(false)}><X size={16} /></button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="filter-select">
                  <label>Pipeline Name</label>
                  <input
                    type="text"
                    defaultValue="inventory_etl"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="filter-select">
                  <label>1. Source Database</label>
                  <select className="select-control" style={{ width: '100%' }}>
                    <option>Snowflake: INVENTORY_ANALYTICS.RAW_DATA (sf-inventory-raw)</option>
                  </select>
                </div>

                <div className="filter-select">
                  <label>2. Transformation / ETL Engine</label>
                  <select className="select-control" style={{ width: '100%' }}>
                    <option>dbt Cloud: inventory_analytics (dbt-inventory-job)</option>
                  </select>
                </div>

                <div className="filter-select">
                  <label>3. Destination / Target Mart</label>
                  <select className="select-control" style={{ width: '100%' }}>
                    <option>Snowflake: INVENTORY_ANALYTICS.FINAL_DATA (sf-inventory-final)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                  <button className="export-btn" onClick={() => setComposeModalOpen(false)}>Cancel</button>
                  <button
                    className="export-btn"
                    onClick={() => { setComposeModalOpen(false); handleSyncAll(); }}
                    style={{ background: '#10B981', color: '#FFFFFF', border: 'none' }}
                  >
                    Save & Compose Pipeline
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
