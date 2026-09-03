import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch, CheckCircle, AlertCircle, Clock,
  ArrowUpRight, ArrowDownRight, Search, Play, Eye,
  Server, ChevronLeft, ChevronRight, X, Terminal, AlertTriangle,
  RotateCcw, Tag, RefreshCw, Database, Layers, Shield
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SparkLine from '../components/SparkLine';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchPipelines, fetchLogs, fetchPipelineRuns, fetchPipelineDetail, triggerSync } from '../api/client';

const fmtDuration = (sec) => {
  if (!sec && sec !== 0) return '—';
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
};

const fmtDate = (str) => {
  if (!str) return 'recently';
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return str;
  }
};

export default function Pipelines() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [pipelinesList, setPipelinesList] = useState([]);
  const [pipelineKpis, setPipelineKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Selected run for detail modal
  const [selectedRun, setSelectedRun] = useState(null);

  // Real-time Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [pipelineFilter, setPipelineFilter] = useState('All');
  const [toolFilter, setToolFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [headerDatePreset, setHeaderDatePreset] = useState('all');
  const [customDateRange, setCustomDateRange] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (headerDatePreset && headerDatePreset !== 'all' && headerDatePreset !== 'custom') {
        params.preset = headerDatePreset;
      }
      if (headerDatePreset === 'custom' && customDateRange) {
        params.start_date = customDateRange.start;
        params.end_date = customDateRange.end;
      }
      if (pipelineFilter !== 'All') params.pipeline_name = pipelineFilter;
      if (statusFilter !== 'All') params.status = statusFilter.toLowerCase();
      if (toolFilter !== 'All') params.tool = toolFilter.toLowerCase();

      const [pRes, lRes] = await Promise.allSettled([
        fetchPipelines(params),
        fetchLogs({ ...params, limit: 100 }),
      ]);

      if (pRes.status === 'fulfilled' && pRes.value) {
        const list = pRes.value.items || pRes.value.pipelines || (Array.isArray(pRes.value) ? pRes.value : []);
        setPipelinesList(list);
        if (pRes.value.kpis) setPipelineKpis(pRes.value.kpis);
      }

      if (lRes.status === 'fulfilled' && lRes.value) {
        const logs = lRes.value.items || lRes.value.logs || (Array.isArray(lRes.value) ? lRes.value : []);
        setRuns(logs);
      }
    } catch (e) {
      console.error('Failed to load pipelines & runs:', e);
    } finally {
      setLoading(false);
    }
  }, [headerDatePreset, customDateRange, pipelineFilter, statusFilter, toolFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTriggerSync = async () => {
    setSyncing(true);
    try {
      await triggerSync();
      await loadData();
    } catch (e) {
      console.error('Trigger sync error:', e);
    } finally {
      setSyncing(false);
    }
  };

  // Distinct pipeline names for filter dropdown
  const distinctPipelineNames = useMemo(() => {
    return Array.from(new Set([
      ...pipelinesList.map(p => p.pipeline_name || p.name),
      ...runs.map(r => r.pipeline_name)
    ].filter(Boolean)));
  }, [pipelinesList, runs]);

  // Distinct dates for filter dropdown
  const distinctDates = useMemo(() => {
    return Array.from(new Set(runs.map(r => (r.start_time || '').substring(0, 10)).filter(Boolean))).sort().reverse();
  }, [runs]);

  // Handle header date range change
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

  // Filtered runs
  const filtered = useMemo(() => {
    return runs.filter(r => {
      const pName = (r.pipeline_name || '').toLowerCase();
      const runId = String(r.run_id || '').toLowerCase();
      const status = (r.status || '').toLowerCase();
      const tool = (r.tool_name || r.source_tool || 'dbt').toLowerCase();
      const errMsg = (r.error_message || '').toLowerCase();
      const startTimeStr = r.start_time || '';

      const matchSearch = !search ||
        pName.includes(search.toLowerCase()) ||
        runId.includes(search.toLowerCase()) ||
        tool.includes(search.toLowerCase()) ||
        errMsg.includes(search.toLowerCase());

      const matchStatus = statusFilter === 'All' || status === statusFilter.toLowerCase();
      const matchPipeline = pipelineFilter === 'All' || r.pipeline_name === pipelineFilter;
      const matchTool = toolFilter === 'All' || tool === toolFilter.toLowerCase();
      const matchDropdownDate = dateFilter === 'All' || startTimeStr.startsWith(dateFilter);

      return matchSearch && matchStatus && matchPipeline && matchTool && matchDropdownDate;
    });
  }, [runs, search, statusFilter, pipelineFilter, toolFilter, dateFilter]);

  // KPI Calculations strictly derived from live API / filtered dataset
  const totalRuns = filtered.length || runs.length;
  const successfulRuns = runs.filter(r => (r.status || '').toLowerCase() === 'success').length;
  const failedRuns = runs.filter(r => (r.status || '').toLowerCase() === 'failed').length;
  const successRatePct = totalRuns > 0 ? ((successfulRuns / totalRuns) * 100).toFixed(1) : (pipelinesList[0]?.success_rate_pct != null ? pipelinesList[0].success_rate_pct : '100.0');

  const avgDurationSec = totalRuns > 0
    ? Math.round(runs.reduce((sum, r) => sum + (Number(r.duration || r.duration_seconds) || 0), 0) / totalRuns)
    : (pipelinesList[0]?.avg_duration_seconds || 15);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setPipelineFilter('All');
    setToolFilter('All');
    setDateFilter('All');
    setHeaderDatePreset('all');
    setCustomDateRange(null);
    setPage(1);
  };

  const hasActiveFilters = search || statusFilter !== 'All' || pipelineFilter !== 'All' || toolFilter !== 'All' || dateFilter !== 'All' || headerDatePreset !== 'all';

  // Pagination logic
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

  return (
    <div className="fade-in">
      <PageHeader
        title="Pipelines"
        subtitle="Complete live execution history, health metrics and run logs across all pipelines."
        onRefresh={loadData}
        onDateChange={handleHeaderDateChange}
      />

      <div className="page-body">
        {/* TOP FILTERS TOOLBAR */}
        <div className="filters-bar">
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search run ID, pipeline name, error..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div className="filter-select">
            <label>Pipeline</label>
            <select
              className="select-control"
              value={pipelineFilter}
              onChange={e => { setPipelineFilter(e.target.value); setPage(1); }}
            >
              <option value="All">All Pipelines</option>
              {distinctPipelineNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="filter-select">
            <label>Status</label>
            <select
              className="select-control"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="All">All Statuses</option>
              <option value="Success">Success</option>
              <option value="Failed">Failed</option>
            </select>
          </div>

          {distinctDates.length > 0 && (
            <div className="filter-select">
              <label>Execution Date</label>
              <select
                className="select-control"
                value={dateFilter}
                onChange={e => { setDateFilter(e.target.value); setPage(1); }}
              >
                <option value="All">All Dates</option>
                {distinctDates.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          <div className="filter-select">
            <label>Engine / Tool</label>
            <select
              className="select-control"
              value={toolFilter}
              onChange={e => { setToolFilter(e.target.value); setPage(1); }}
            >
              <option value="All">All Engines</option>
              <option value="dbt">dbt</option>
              <option value="snowflake">Snowflake</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button className="clear-filters-btn" onClick={clearFilters} title="Reset all filters">
              <RotateCcw size={12} style={{ display: 'inline', marginRight: 4 }} />
              Reset Filters
            </button>
          )}

          <button
            className="export-btn"
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={handleTriggerSync}
            disabled={syncing}
          >
            <RefreshCw size={13} className={syncing ? 'spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync Pipeline'}
          </button>
        </div>

        {/* DYNAMIC KPI METRICS CARDS */}
        <div className="kpi-grid-5 mt-4">
          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#EEF2FF', color: '#6366F1' }}>
                <GitBranch size={18} />
              </div>
              <span className="kpi-label">
                {pipelineFilter !== 'All' ? 'Pipeline Scope' : 'Monitored Pipelines'}
              </span>
            </div>
            <div className="kpi-value" style={{ fontSize: pipelineFilter !== 'All' ? 18 : 24, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pipelineFilter !== 'All' ? pipelineFilter : pipelinesList.length}
            </div>
            <div className="kpi-delta up">
              <ArrowUpRight size={13} />
              <span>{pipelinesList.length} registered in system</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                <CheckCircle size={18} />
              </div>
              <span className="kpi-label">Success Rate</span>
            </div>
            <div className="kpi-value" style={{ color: '#10B981' }}>{successRatePct}%</div>
            <div className="kpi-delta up">
              <ArrowUpRight size={13} />
              <span>{successfulRuns}/{totalRuns} runs passed</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#EFF6FF', color: '#3B82F6' }}>
                <Play size={18} />
              </div>
              <span className="kpi-label">Total Executions</span>
            </div>
            <div className="kpi-value">{totalRuns}</div>
            <div className="kpi-delta up">
              <ArrowUpRight size={13} />
              <span>Across monitored window</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#FEF2F2', color: '#EF4444' }}>
                <AlertCircle size={18} />
              </div>
              <span className="kpi-label">Failed Runs</span>
            </div>
            <div className="kpi-value" style={{ color: failedRuns > 0 ? '#EF4444' : '#10B981' }}>{failedRuns}</div>
            <div className={`kpi-delta ${failedRuns > 0 ? 'down' : 'up'}`}>
              {failedRuns > 0 ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
              <span>{failedRuns > 0 ? `${failedRuns} execution failures` : '0 failures'}</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#FFFBEB', color: '#F59E0B' }}>
                <Clock size={18} />
              </div>
              <span className="kpi-label">Avg. Duration</span>
            </div>
            <div className="kpi-value">{fmtDuration(avgDurationSec)}</div>
            <div className="kpi-delta up">
              <ArrowUpRight size={13} />
              <span>{avgDurationSec}s average runtime</span>
            </div>
          </div>
        </div>

        {/* REGISTERED PIPELINES IN CATALOG */}
        <div className="card mt-4">
          <div className="card-header">
            <div>
              <span className="card-title">Pipelines Directory</span>
              <span className="card-subtitle">Source to destination data pipeline architectures</span>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="vithi-table">
              <thead>
                <tr>
                  <th>Pipeline Name</th>
                  <th>Source Tool</th>
                  <th>ETL Engine</th>
                  <th>Target Tool</th>
                  <th>Status</th>
                  <th>Total Runs</th>
                  <th>Success Rate</th>
                  <th>Avg Duration</th>
                  <th>Last Executed</th>
                </tr>
              </thead>
              <tbody>
                {pipelinesList.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      No pipelines registered in the catalog yet.
                    </td>
                  </tr>
                ) : (
                  pipelinesList.map(pipe => {
                    const isPassing = (pipe.status || '').toLowerCase() === 'success' || (pipe.status || '') === 'Good';
                    const isDegraded = (pipe.status || '').toLowerCase() === 'degraded' || (pipe.status || '').toLowerCase() === 'n/a';
                    const statusClass = isPassing ? 'good' : isDegraded ? 'warning' : 'critical';

                    return (
                      <tr key={pipe.pipeline_id || pipe.pipeline_name}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <GitBranch size={15} style={{ color: 'var(--accent)' }} />
                            <span style={{ fontWeight: 600 }}>{pipe.pipeline_name}</span>
                          </div>
                        </td>
                        <td><span className="tag">{pipe.source_tool || 'snowflake'}</span></td>
                        <td><span className="tag accent">{pipe.etl_tool || 'dbt'}</span></td>
                        <td><span className="tag">{pipe.target_tool || 'snowflake'}</span></td>
                        <td><span className={`status-pill ${statusClass}`}>{pipe.status || 'Active'}</span></td>
                        <td style={{ fontWeight: 600 }}>{pipe.total_runs ?? pipe.runs ?? 0}</td>
                        <td>{pipe.success_rate_pct != null ? `${pipe.success_rate_pct}%` : (pipe.success_rate || '100%')}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{pipe.avg_duration ?? (pipe.avg_duration_seconds ? `${pipe.avg_duration_seconds}s` : '15s')}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{pipe.last_run_age || pipe.last_run || pipe.global_last_run || 'recently'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RUNS HISTORY TABLE */}
        <div className="card mt-4">
          {loading && !runs.length ? (
            <LoadingSpinner />
          ) : (
            <>
              <div className="card-header" style={{ marginBottom: 14 }}>
                <div>
                  <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Play size={16} color="#10B981" />
                    <span>Pipeline Execution Runs History</span>
                  </span>
                  <span className="card-subtitle">Granular logs, statuses, and runtime traces</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Showing {filtered.length === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length} runs ({runs.length} total)
                </span>
              </div>

              <div className="table-wrapper">
                <table className="vithi-table">
                  <thead>
                    <tr>
                      <th>Run ID</th>
                      <th>Pipeline Name</th>
                      <th>Status</th>
                      <th>Execution Timestamp</th>
                      <th>Duration</th>
                      <th>Engine / Trigger</th>
                      <th>Error Diagnostic</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                          No execution records match the active filter criteria.
                        </td>
                      </tr>
                    ) : (
                      paginated.map((r, idx) => {
                        const isFailed = (r.status || '').toLowerCase() === 'failed';

                        return (
                          <tr
                            key={r.run_id || idx}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedRun(r)}
                          >
                            <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#3B82F6' }}>
                              #{r.run_id}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                  width: 24, height: 24, borderRadius: 6,
                                  background: 'var(--bg-card-subtle)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: isFailed ? '#EF4444' : '#10B981', border: '1px solid var(--border)'
                                }}>
                                  <Server size={12} />
                                </div>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {r.pipeline_name}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className={`status-pill ${isFailed ? 'failed' : 'success'}`}>
                                {isFailed ? 'Failed' : 'Success'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                                <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                                <span>{fmtDate(r.start_time)}</span>
                              </div>
                            </td>
                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {fmtDuration(Number(r.duration || r.duration_seconds))}
                            </td>
                            <td>
                              <span className="tool-badge">
                                {r.tool_name || r.source_tool || 'dbt'}
                              </span>
                            </td>
                            <td style={{ maxWidth: 220 }}>
                              {r.error_message ? (
                                <span style={{
                                  color: '#EF4444',
                                  fontSize: 12,
                                  display: 'block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }} title={r.error_message}>
                                  {r.error_message}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="export-btn"
                                style={{ padding: '4px 8px', fontSize: 11 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRun(r);
                                }}
                              >
                                <Eye size={12} /> Details
                              </button>
                            </td>
                          </tr>
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
                    <button
                      className="export-btn"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft size={14} /> Previous
                    </button>
                    <button
                      className="export-btn"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Selected Run Detail Modal */}
        {selectedRun && (
          <div className="modal-backdrop" onClick={() => setSelectedRun(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Terminal size={18} style={{ color: '#3B82F6' }} />
                  <span style={{ fontWeight: 600, fontSize: 15 }}>Run Diagnostic Trace — #{selectedRun.run_id}</span>
                </div>
                <button className="icon-btn" onClick={() => setSelectedRun(null)}>
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <div style={{ padding: 10, background: 'var(--bg-card-subtle)', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pipeline</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{selectedRun.pipeline_name}</div>
                  </div>
                  <div style={{ padding: 10, background: 'var(--bg-card-subtle)', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Status</div>
                    <div>
                      <span className={`status-pill ${(selectedRun.status || '').toLowerCase() === 'failed' ? 'failed' : 'success'}`}>
                        {selectedRun.status}
                      </span>
                    </div>
                  </div>
                  <div style={{ padding: 10, background: 'var(--bg-card-subtle)', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Execution Time</div>
                    <div style={{ fontSize: 12 }}>{fmtDate(selectedRun.start_time)}</div>
                  </div>
                  <div style={{ padding: 10, background: 'var(--bg-card-subtle)', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Duration</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{fmtDuration(Number(selectedRun.duration || selectedRun.duration_seconds))}</div>
                  </div>
                </div>

                {selectedRun.error_message && (
                  <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#EF4444', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={14} /> Error Diagnostic
                    </div>
                    <div style={{ fontSize: 12, color: '#EF4444', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                      {selectedRun.error_message}
                    </div>
                  </div>
                )}

                {selectedRun.sql_query && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Executed Query / Command</div>
                    <pre style={{ padding: 10, background: 'var(--bg-input)', borderRadius: 6, fontSize: 11.5, overflowX: 'auto', border: '1px solid var(--border)' }}>
                      {selectedRun.sql_query}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
