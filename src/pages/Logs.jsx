import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  FileText, XCircle, CheckCircle, Clock, Search, Filter,
  Download, MoreVertical, Database, ArrowUpRight, ArrowDownRight,
  Columns, ChevronRight, ChevronDown, RefreshCw, Server, AlertTriangle
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SparkLine from '../components/SparkLine';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchLogs } from '../api/client';

export default function Logs() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedLogId, setExpandedLogId] = useState(null);

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
  const distinctTools = useMemo(() => Array.from(new Set(logs.map(l => l.tool_name || l.source_tool).filter(Boolean))), [logs]);

  // Filtered log items
  const filtered = useMemo(() => {
    return logs.filter(l => {
      const pName = l.pipeline_name || '';
      const tool = l.tool_name || l.source_tool || '';
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
        subtitle="Searchable live execution logs, error traces, and SQL queries from all pipeline runs."
        onRefresh={loadLogs}
        onDateChange={handleHeaderDateChange}
      />

      {loading && !logs.length ? (
        <LoadingSpinner />
      ) : (
        <div className="page-body">
          {/* 4 KPI Cards */}
          <div className="kpi-grid-4">
            <div className="kpi-card">
              <div className="kpi-card-header">
                <div className="kpi-icon" style={{ background: '#EEF2FF', color: '#6366F1' }}>
                  <FileText size={18} />
                </div>
                <span className="kpi-label">Total Logs</span>
              </div>
              <div className="kpi-value">{totalCount}</div>
              <div className="kpi-delta up">
                <ArrowUpRight size={12} />
                <span>Live backend logs</span>
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
                <span>Healthy runs</span>
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

          {/* Filters Bar */}
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

            <div className="search-box" style={{ flex: 1, maxWidth: 300 }}>
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

          {/* Logs Table Card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Live Execution Logs ({filtered.length})</span>
            </div>

            <div className="table-wrapper">
              <table className="vithi-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Timestamp</th>
                    <th>Pipeline Name</th>
                    <th>Run ID</th>
                    <th>Status</th>
                    <th>Tool</th>
                    <th>Message / SQL Details</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                        No logs match the active filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((l, i) => {
                      const isExpanded = expandedLogId === (l.run_id || i);
                      const status = (l.status || 'success').toLowerCase();
                      const isFailed = status === 'failed';

                      return (
                        <React.Fragment key={l.run_id || i}>
                          <tr
                            style={{ cursor: 'pointer', background: isExpanded ? 'rgba(99, 102, 241, 0.04)' : undefined }}
                            onClick={() => setExpandedLogId(isExpanded ? null : (l.run_id || i))}
                          >
                            <td style={{ width: 24, paddingLeft: 10 }}>
                              {isExpanded ? <ChevronDown size={14} color="#6366F1" /> : <ChevronRight size={14} color="#94A3B8" />}
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              {l.start_time ? new Date(l.start_time).toLocaleString() : 'recently'}
                            </td>
                            <td style={{ fontWeight: 600 }}>{l.pipeline_name}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#6366F1' }}>
                              {l.run_id ? `#${l.run_id}` : '#auto'}
                            </td>
                            <td>
                              <span className={`status-pill ${isFailed ? 'failed' : 'success'}`}>
                                {l.status}
                              </span>
                            </td>
                            <td>
                              <span className="tool-badge">
                                {l.tool_name || l.source_tool || 'dbt'}
                              </span>
                            </td>
                            <td style={{ fontSize: 12, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {l.error_message || l.sql_query || (isFailed ? 'Task execution failed' : 'Pipeline executed successfully')}
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              {l.duration_seconds != null ? `${l.duration_seconds}s` : (l.duration || '0s')}
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan={8} style={{ background: 'var(--bg-card-subtle)', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                                  <div><strong>Run ID:</strong> #{l.run_id}</div>
                                  {l.error_message && (
                                    <div style={{ color: '#EF4444', background: 'rgba(239, 68, 68, 0.08)', padding: 8, borderRadius: 6 }}>
                                      <strong>Error Trace:</strong> {l.error_message}
                                    </div>
                                  )}
                                  {l.sql_query && (
                                    <div>
                                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Executed Query:</div>
                                      <pre style={{ background: 'var(--bg-input)', color: '#38BDF8', padding: 10, borderRadius: 6, fontSize: 11, overflowX: 'auto', border: '1px solid var(--border)' }}>
                                        {l.sql_query}
                                      </pre>
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
      )}
    </div>
  );
}
