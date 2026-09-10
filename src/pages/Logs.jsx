import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  FileText, XCircle, CheckCircle, Clock, Search, Filter,
  Download, MoreVertical, Database, ArrowUpRight, ArrowDownRight,
  Columns, ChevronRight, ChevronDown, RefreshCw, Server, AlertTriangle,
  Terminal, Code, Copy, Check, Shield, Layers, Hash, Zap, ExternalLink
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchLogs, fetchRcaContext, fetchRunDetail } from '../api/client';

export default function Logs() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [rcaDataMap, setRcaDataMap] = useState({});
  const [loadingRcaId, setLoadingRcaId] = useState(null);
  const [activeLogTab, setActiveLogTab] = useState('console'); // 'console' | 'dq' | 'assets' | 'sql'
  const [copiedId, setCopiedId] = useState(null);

  // Filters
  const [pipelineFilter, setPipelineFilter] = useState('All Pipelines');
  const [toolFilter, setToolFilter] = useState('All Tools');
  const [levelFilter, setLevelFilter] = useState('All Levels');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [headerDatePreset, setHeaderDatePreset] = useState('all');
  const [customDateRange, setCustomDateRange] = useState(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (headerDatePreset && headerDatePreset !== 'all' && headerDatePreset !== 'custom') {
        params.preset = headerDatePreset;
      }
      if (headerDatePreset === 'custom' && customDateRange) {
        params.start_date = customDateRange.start;
        params.end_date = customDateRange.end;
      }

      const res = await fetchLogs(params);
      if (res) {
        const list = res.items || res.logs || (Array.isArray(res) ? res : []);
        setLogs(list);
        setTotalCount(res.pagination?.total_items || res.pagination?.total || list.length);
      }
    } catch (e) {
      console.error('Error fetching live logs:', e);
    } finally {
      setLoading(false);
    }
  }, [headerDatePreset, customDateRange]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Load deep RCA execution details when a log is expanded
  const handleToggleExpand = async (runId) => {
    if (expandedLogId === runId) {
      setExpandedLogId(null);
      return;
    }
    setExpandedLogId(runId);
    if (!rcaDataMap[runId]) {
      setLoadingRcaId(runId);
      try {
        const rca = await fetchRcaContext(runId);
        if (rca) {
          setRcaDataMap(prev => ({ ...prev, [runId]: rca }));
        }
      } catch (err) {
        console.error('Failed to load RCA detail:', err);
      } finally {
        setLoadingRcaId(null);
      }
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleHeaderDateChange = (val) => {
    if (typeof val === 'string') {
      setHeaderDatePreset(val);
      setCustomDateRange(null);
    } else if (val && val.start && val.end) {
      setHeaderDatePreset('custom');
      setCustomDateRange(val);
    }
    setPage(1);
  };

  // Aggregated live KPIs
  const failedCount = useMemo(() => logs.filter(l => (l.status || '').toLowerCase() === 'failed').length, [logs]);
  const successCount = useMemo(() => logs.filter(l => (l.status || '').toLowerCase() === 'success').length, [logs]);
  const avgDuration = useMemo(() => {
    if (!logs.length) return '0s';
    const sum = logs.reduce((acc, l) => acc + (Number(l.duration_seconds || l.duration) || 0), 0);
    return `${(sum / logs.length).toFixed(1)}s`;
  }, [logs]);

  // Distinct pipelines & tools for dropdowns
  const distinctPipelines = useMemo(() => Array.from(new Set(logs.map(l => l.pipeline_name).filter(Boolean))), [logs]);
  const distinctTools = useMemo(() => Array.from(new Set(logs.map(l => l.tool_name || l.source_tool || l.tool).filter(Boolean))), [logs]);

  // Filtered log items
  const filtered = useMemo(() => {
    return logs.filter(l => {
      const pName = l.pipeline_name || '';
      const tool = l.tool_name || l.source_tool || l.tool || '';
      const status = (l.status || '').toUpperCase();
      const msg = l.error_message || l.message || l.sql_query || '';

      const matchSearch = !search ||
        pName.toLowerCase().includes(search.toLowerCase()) ||
        tool.toLowerCase().includes(search.toLowerCase()) ||
        msg.toLowerCase().includes(search.toLowerCase()) ||
        String(l.run_id || '').toLowerCase().includes(search.toLowerCase());

      const matchPipeline = pipelineFilter === 'All Pipelines' || pName === pipelineFilter;
      const matchTool = toolFilter === 'All Tools' || tool.toLowerCase() === toolFilter.toLowerCase();
      const matchLevel = levelFilter === 'All Levels' ||
        (levelFilter === 'ERROR' && status === 'FAILED') ||
        (levelFilter === 'SUCCESS' && status === 'SUCCESS');

      return matchSearch && matchPipeline && matchTool && matchLevel;
    });
  }, [logs, search, pipelineFilter, toolFilter, levelFilter]);

  const paginated = useMemo(() => {
    return filtered.slice((page - 1) * perPage, page * perPage);
  }, [filtered, page]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

  return (
    <div className="fade-in">
      <PageHeader
        title="Logs"
        subtitle="Real-time execution traces, dbt compiler diagnostics, and Snowflake database query logs."
        onRefresh={loadLogs}
        onDateChange={handleHeaderDateChange}
      />

      <div className="page-body">
        {/* 4 KPI Cards */}
        <div className="kpi-grid-4">
          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#EEF2FF', color: '#6366F1' }}>
                <FileText size={18} />
              </div>
              <span className="kpi-label">Total Execution Logs</span>
            </div>
            <div className="kpi-value">{totalCount}</div>
            <div className="kpi-delta up">
              <ArrowUpRight size={12} />
              <span>Live backend telemetry</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#FEF2F2', color: '#EF4444' }}>
                <XCircle size={18} />
              </div>
              <span className="kpi-label">Failed Logs</span>
            </div>
            <div className="kpi-value" style={{ color: failedCount > 0 ? '#EF4444' : '#10B981' }}>{failedCount}</div>
            <div className="kpi-delta down">
              <ArrowUpRight size={12} />
              <span>Errors flagged</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                <CheckCircle size={18} />
              </div>
              <span className="kpi-label">Success Logs</span>
            </div>
            <div className="kpi-value" style={{ color: '#10B981' }}>{successCount}</div>
            <div className="kpi-delta up">
              <ArrowUpRight size={12} />
              <span>Healthy pipeline runs</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#EFF6FF', color: '#3B82F6' }}>
                <Clock size={18} />
              </div>
              <span className="kpi-label">Average Runtime</span>
            </div>
            <div className="kpi-value">{avgDuration}</div>
            <div className="kpi-delta up">
              <ArrowDownRight size={12} />
              <span>Across executions</span>
            </div>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="filters-bar mt-4">
          <div className="filter-select">
            <label>Pipelines</label>
            <select className="select-control" value={pipelineFilter} onChange={e => { setPipelineFilter(e.target.value); setPage(1); }}>
              <option value="All Pipelines">All Pipelines</option>
              {distinctPipelines.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="filter-select">
            <label>Tool</label>
            <select className="select-control" value={toolFilter} onChange={e => { setToolFilter(e.target.value); setPage(1); }}>
              <option value="All Tools">All Tools</option>
              {distinctTools.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="filter-select">
            <label>Log Status</label>
            <select className="select-control" value={levelFilter} onChange={e => { setLevelFilter(e.target.value); setPage(1); }}>
              <option value="All Levels">All Levels</option>
              <option value="ERROR">Failed / Error</option>
              <option value="SUCCESS">Success</option>
            </select>
          </div>

          <div className="search-box" style={{ flex: 1, maxWidth: 320 }}>
            <Search size={13} />
            <input
              type="text"
              placeholder="Search pipeline, Run ID, or SQL query..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ width: '100%' }}
            />
          </div>

          <button className="clear-filters-btn" style={{ marginLeft: 'auto' }} onClick={() => {
            setPipelineFilter('All Pipelines');
            setToolFilter('All Tools');
            setLevelFilter('All Levels');
            setSearch('');
            setPage(1);
          }}>
            Reset
          </button>
        </div>

        {/* Enterprise Real-Time Log Viewer Table */}
        <div className="card mt-4">
          <div className="card-header">
            <div>
              <span className="card-title">Live Execution Logs ({filtered.length})</span>
              <span className="card-subtitle">Click any log row to expand deep terminal output, dbt test results, and SQL traces</span>
            </div>
            <button className="export-btn" onClick={() => window.print()} style={{ fontSize: 11.5, padding: '4px 10px' }}>
              <Download size={12} /> Export Logs
            </button>
          </div>

          <div className="table-wrapper">
            <table className="vithi-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}></th>
                  <th>Timestamp</th>
                  <th>Pipeline Name</th>
                  <th>Run ID</th>
                  <th>Status</th>
                  <th>Tool Engine</th>
                  <th>Message / Execution Summary</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                      No execution logs match the selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginated.map((l, i) => {
                    const runId = l.run_id || `auto_${i}`;
                    const isExpanded = expandedLogId === runId;
                    const status = (l.status || 'success').toLowerCase();
                    const isFailed = status === 'failed';
                    const rca = rcaDataMap[runId];

                    return (
                      <React.Fragment key={runId}>
                        <tr
                          style={{ cursor: 'pointer', background: isExpanded ? 'rgba(16, 185, 129, 0.04)' : undefined }}
                          onClick={() => handleToggleExpand(runId)}
                        >
                          <td style={{ width: 30, paddingLeft: 10 }}>
                            {isExpanded ? <ChevronDown size={15} color="#10B981" /> : <ChevronRight size={15} color="#94A3B8" />}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {l.timestamp || (l.start_time ? new Date(l.start_time).toLocaleString() : 'recently')}
                          </td>
                          <td style={{ fontWeight: 600 }}>{l.pipeline_name}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#6366F1' }}>
                            #{l.run_id || '—'}
                          </td>
                          <td>
                            <span className={`status-pill ${isFailed ? 'failed' : 'success'}`}>
                              {l.status}
                            </span>
                          </td>
                          <td>
                            <span className="tool-badge">
                              {l.tool_name || l.source_tool || l.tool || '—'}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {l.error_message || l.message || (isFailed ? 'Execution failure' : 'Run completed')}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {l.duration_seconds != null ? `${l.duration_seconds}s` : (l.duration || '—')}
                          </td>
                        </tr>

                        {/* Expanded Enterprise Diagnostic Console */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} style={{ background: 'var(--bg-card-subtle)', padding: '16px 22px', borderBottom: '2px solid var(--border)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {/* Diagnostic Header & Tabs */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                      onClick={() => setActiveLogTab('console')}
                                      style={{
                                        padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                                        background: activeLogTab === 'console' ? 'var(--brand-dark)' : 'var(--bg-card)',
                                        color: activeLogTab === 'console' ? '#FFFFFF' : 'var(--text-secondary)'
                                      }}
                                    >
                                      Console Output
                                    </button>

                                    <button
                                      onClick={() => setActiveLogTab('dq')}
                                      style={{
                                        padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                                        background: activeLogTab === 'dq' ? 'var(--brand-dark)' : 'var(--bg-card)',
                                        color: activeLogTab === 'dq' ? '#FFFFFF' : 'var(--text-secondary)'
                                      }}
                                    >
                                      25 DQ Assertions ({rca?.dq_checks?.length || rca?.checks?.length || 0})
                                    </button>

                                    <button
                                      onClick={() => setActiveLogTab('assets')}
                                      style={{
                                        padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                                        background: activeLogTab === 'assets' ? 'var(--brand-dark)' : 'var(--bg-card)',
                                        color: activeLogTab === 'assets' ? '#FFFFFF' : 'var(--text-secondary)'
                                      }}
                                    >
                                      Dataset Assets & Rows
                                    </button>
                                  </div>

                                  <button
                                    className="export-btn"
                                    onClick={() => handleCopy(JSON.stringify(rca || l, null, 2), runId)}
                                    style={{ fontSize: 11, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  >
                                    {copiedId === runId ? <Check size={11} color="#10B981" /> : <Copy size={11} />}
                                    <span>{copiedId === runId ? 'Copied' : 'Copy JSON'}</span>
                                  </button>
                                </div>

                                {/* TAB 1: Console / Terminal Output */}
                                {activeLogTab === 'console' && (
                                  <div style={{
                                    background: '#0F172A', color: '#F8FAFC', borderRadius: 8, padding: '12px 16px',
                                    fontFamily: 'monospace', fontSize: 11.5, lineHeight: 1.5, maxHeight: 220, overflowY: 'auto'
                                  }}>
                                    {(rca?.console || rca?.logs || rca?.output || l.raw_log || l.message) ? (
                                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                        {typeof (rca?.console || rca?.logs || rca?.output || l.raw_log || l.message) === 'string'
                                          ? (rca?.console || rca?.logs || rca?.output || l.raw_log || l.message)
                                          : JSON.stringify(rca?.console || rca?.logs || rca?.output || l, null, 2)}
                                      </pre>
                                    ) : (
                                      <div style={{ color: '#94A3B8' }}>No console output from API for this run.</div>
                                    )}
                                  </div>
                                )}

                                {/* TAB 2: DQ Assertions List */}
                                {activeLogTab === 'dq' && (
                                  <div className="table-wrapper" style={{ maxHeight: 200, overflowY: 'auto' }}>
                                    <table className="vithi-table">
                                      <thead>
                                        <tr>
                                          <th>Test Name</th>
                                          <th>Dimension</th>
                                          <th>Status</th>
                                          <th>Latency</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(rca?.dq_checks || rca?.checks || []).length === 0 ? (
                                          <tr>
                                            <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>
                                              No DQ assertions from RCA API for this run.
                                            </td>
                                          </tr>
                                        ) : (rca?.dq_checks || rca?.checks || []).map((t, idx) => (
                                          <tr key={idx}>
                                            <td style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 500 }}>{t.test || t.name || t.rule_name || '—'}</td>
                                            <td><span className="tag">{t.dim || t.dimension || '—'}</span></td>
                                            <td>
                                              <span className={`status-pill ${(t.status || '').toLowerCase().includes('pass') ? 'good' : 'warning'}`}>
                                                {(t.status || '—').toString().toUpperCase()}
                                              </span>
                                            </td>
                                            <td style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t.dur || t.duration || '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}

                                {/* TAB 3: Dataset Assets & Row Counts */}
                                {activeLogTab === 'assets' && (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                                    {(rca?.assets || []).length === 0 ? (
                                      <div style={{ gridColumn: '1 / -1', padding: 16, color: 'var(--text-muted)', textAlign: 'center' }}>
                                        No dataset assets from API for this run.
                                        {(l.rows_read != null || l.rows_written != null) && (
                                          <div style={{ marginTop: 8 }}>
                                            Rows read: <strong>{l.rows_read ?? '—'}</strong> · Rows written: <strong>{l.rows_written ?? '—'}</strong>
                                          </div>
                                        )}
                                      </div>
                                    ) : (rca.assets.map((a, idx) => (
                                      <div key={idx} style={{ padding: 12, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 12, color: 'var(--brand-dark)' }}>
                                          <Database size={14} />
                                          <span>{a.asset_role || a.role || 'Asset'}: {a.object_name || a.name || a.table || '—'}</span>
                                        </div>
                                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                                          Rows: <strong style={{ color: 'var(--text-primary)' }}>{a.row_count ?? a.rows ?? '—'}</strong>
                                        </div>
                                      </div>
                                    )))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="export-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  ‹ Previous
                </button>
                <button className="export-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  Next ›
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
