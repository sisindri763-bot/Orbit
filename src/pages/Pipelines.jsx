import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  GitBranch, CheckCircle, AlertCircle, Clock,
  ArrowUpRight, ArrowDownRight, Search, Play, Eye,
  ChevronLeft, ChevronRight, X, Terminal, AlertTriangle,
  RotateCcw, ArrowRight, Activity
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchPipelines, fetchLogs, fetchFilters } from '../api/client';

const fmtDuration = (sec) => {
  if (sec == null || Number.isNaN(Number(sec))) return '—';
  const s = Math.round(Number(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
};

const fmtDate = (str) => {
  if (!str) return '—';
  try {
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return String(str);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(str);
  }
};

function buildQueryParams({ headerDatePreset, customDateRange, pipelineFilter, statusFilter }) {
  const params = {};
  if (headerDatePreset === 'custom' && customDateRange?.start && customDateRange?.end) {
    params.start_date = customDateRange.start;
    params.end_date = customDateRange.end;
  } else if (headerDatePreset && headerDatePreset !== 'custom') {
    params.preset = headerDatePreset;
  }
  if (pipelineFilter && pipelineFilter !== 'All') params.pipeline_name = pipelineFilter;
  if (statusFilter && statusFilter !== 'All') params.status = String(statusFilter).toLowerCase();
  return params;
}

function statusPillClass(status) {
  const s = (status || '').toLowerCase();
  if (s === 'success' || s === 'good') return 'success';
  if (s === 'failed' || s === 'error' || s === 'critical') return 'failed';
  if (s === 'running' || s === 'degraded' || s === 'n/a' || s === 'cancelled') return 'warning';
  return 'warning';
}

function formatApiTime(raw) {
  if (!raw) return null;
  const s = String(raw);
  if (s.startsWith('1970-01-01')) return null;
  return s;
}

function FlowChip({ label }) {
  if (!label) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  return (
    <span className="tag" style={{ textTransform: 'none', letterSpacing: 0 }}>
      {label}
    </span>
  );
}

export default function Pipelines() {
  const [runs, setRuns] = useState([]);
  const [pipelinesList, setPipelinesList] = useState([]);
  const [pipelinePayload, setPipelinePayload] = useState(null);
  const [filterCatalog, setFilterCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedPipelineName, setSelectedPipelineName] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [pipelineFilter, setPipelineFilter] = useState('All');
  const [headerDatePreset, setHeaderDatePreset] = useState('all');
  const [customDateRange, setCustomDateRange] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const requestIdRef = useRef(0);

  const loadData = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = buildQueryParams({
        headerDatePreset,
        customDateRange,
        pipelineFilter,
        statusFilter,
      });

      const [pRes, lRes, fRes] = await Promise.allSettled([
        fetchPipelines(params),
        fetchLogs({ ...params, limit: 100 }),
        fetchFilters(),
      ]);

      if (reqId !== requestIdRef.current) return;

      if (pRes.status === 'fulfilled' && pRes.value && typeof pRes.value === 'object') {
        if (pRes.value.ok === false || pRes.value.error) {
          setError(pRes.value.error || 'Pipelines API returned an error');
          setPipelinePayload(null);
          setPipelinesList([]);
        } else if (Array.isArray(pRes.value.kpis) || Array.isArray(pRes.value.items) || pRes.value.generated_at) {
          setPipelinePayload(pRes.value);
          const list = pRes.value.items || pRes.value.pipelines || [];
          setPipelinesList(Array.isArray(list) ? list : []);
        } else {
          setError('Invalid pipelines response (is the API proxy / API_BACKEND_URL working?)');
          setPipelinePayload(null);
          setPipelinesList([]);
        }
      } else if (pRes.status === 'rejected') {
        const msg = pRes.reason?.response?.data?.error
          || pRes.reason?.message
          || 'Failed to load pipelines';
        setError(msg);
        setPipelinePayload(null);
        setPipelinesList([]);
      }

      if (lRes.status === 'fulfilled' && lRes.value) {
        const logs = lRes.value.items || lRes.value.logs || (Array.isArray(lRes.value) ? lRes.value : []);
        setRuns(Array.isArray(logs) ? logs : []);
      } else {
        setRuns([]);
      }

      if (fRes.status === 'fulfilled' && fRes.value) {
        setFilterCatalog(fRes.value);
      }
    } catch (e) {
      if (reqId !== requestIdRef.current) return;
      console.error('Failed to load pipelines & runs:', e);
      setError(e.message || 'Failed to load pipelines');
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, [headerDatePreset, customDateRange, pipelineFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep selection valid when list changes; default to first pipeline
  useEffect(() => {
    if (!pipelinesList.length) {
      setSelectedPipelineName(null);
      return;
    }
    const names = pipelinesList.map(p => p.pipeline_name).filter(Boolean);
    if (!selectedPipelineName || !names.includes(selectedPipelineName)) {
      setSelectedPipelineName(names[0]);
      setPage(1);
    }
  }, [pipelinesList, selectedPipelineName]);

  const distinctPipelineNames = useMemo(() => {
    const fromApi = [
      ...(filterCatalog?.items || []),
      ...(filterCatalog?.pipelines || []),
    ].map(p => p.pipeline_name);
    const fromList = pipelinesList.map(p => p.pipeline_name || p.name);
    return Array.from(new Set([...fromApi, ...fromList].filter(Boolean))).sort();
  }, [filterCatalog, pipelinesList]);

  const statusOptions = useMemo(() => filterCatalog?.statuses || [], [filterCatalog]);

  const datePresets = useMemo(() => {
    const fromApi = filterCatalog?.presets;
    if (Array.isArray(fromApi) && fromApi.length) {
      return fromApi.map(p => ({ id: p.id, label: p.label || p.id }));
    }
    return [];
  }, [filterCatalog]);

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

  const selectedPipeline = useMemo(
    () => pipelinesList.find(p => p.pipeline_name === selectedPipelineName) || null,
    [pipelinesList, selectedPipelineName]
  );

  // Runs for the focused pipeline + optional search
  const focusedRuns = useMemo(() => {
    let list = runs;
    if (selectedPipelineName) {
      list = list.filter(r => r.pipeline_name === selectedPipelineName);
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(r => {
      const hay = [
        r.pipeline_name, r.run_id, r.tool, r.tool_name,
        r.error_message, r.message, r.status,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [runs, selectedPipelineName, search]);

  const catalogFiltered = useMemo(() => {
    if (!search.trim()) return pipelinesList;
    const q = search.toLowerCase();
    return pipelinesList.filter(p => {
      const hay = [
        p.pipeline_name, p.source_tool, p.etl_tool, p.target_tool,
        p.status, p.activity, p.pipeline_id,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [pipelinesList, search]);

  const kpiMap = useMemo(() => {
    const map = {};
    (pipelinePayload?.kpis || []).forEach(k => { map[k.id] = k; });
    return map;
  }, [pipelinePayload]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setPipelineFilter('All');
    setHeaderDatePreset('all');
    setCustomDateRange(null);
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(search.trim()) ||
    statusFilter !== 'All' ||
    pipelineFilter !== 'All' ||
    headerDatePreset !== 'all';

  const paginated = focusedRuns.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.max(1, Math.ceil(focusedRuns.length / perPage));

  const rangeLabel = useMemo(() => {
    if (headerDatePreset === 'custom' && customDateRange?.start && customDateRange?.end) {
      return `${customDateRange.start} → ${customDateRange.end} (custom)`;
    }
    const presetMeta = datePresets.find(p => p.id === headerDatePreset);
    const presetName = presetMeta?.label || headerDatePreset || 'all';
    const from = formatApiTime(pipelinePayload?.range?.from);
    const to = formatApiTime(pipelinePayload?.range?.to) || pipelinePayload?.range?.to;
    if (!from && (headerDatePreset === 'all' || pipelinePayload?.range?.preset === 'all')) {
      return `All recorded history (${presetName})`;
    }
    if (from && to) return `${from} → ${to} (${presetName})`;
    return presetName;
  }, [pipelinePayload, headerDatePreset, customDateRange, datePresets]);

  const statusFilterLabel = statusOptions.find(s => s.id === statusFilter)?.label || statusFilter;
  const dash = (v) => (v == null || v === '' ? '—' : v);

  return (
    <div className="fade-in">
      <PageHeader
        title="Pipelines"
        subtitle="Monitor registered pipelines and drill into each run — catalog first, then execution history."
        onRefresh={loadData}
        onDateChange={handleHeaderDateChange}
        datePreset={headerDatePreset}
        customStart={customDateRange?.start || ''}
        customEnd={customDateRange?.end || ''}
        latestTimestamp={pipelinePayload?.generated_at}
        presets={datePresets}
      />

      <div className="page-body">
        <div className="filters-bar">
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search pipelines or runs…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div className="filter-select">
            <label>Pipeline</label>
            <select
              className="select-control"
              value={pipelineFilter}
              onChange={e => {
                setPipelineFilter(e.target.value);
                setPage(1);
                if (e.target.value !== 'All') setSelectedPipelineName(e.target.value);
              }}
            >
              <option value="All">All Pipelines</option>
              {distinctPipelineNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="filter-select">
            <label>Run status</label>
            <select
              className="select-control"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="All">All run statuses</option>
              {statusOptions.map(s => (
                <option key={s.id} value={s.id}>{s.label || s.id}</option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button className="clear-filters-btn" onClick={clearFilters} title="Reset all filters">
              <RotateCcw size={12} style={{ display: 'inline', marginRight: 4 }} />
              Reset Filters
            </button>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>
              Time range: <strong style={{ color: 'var(--text-secondary)' }}>{rangeLabel || '—'}</strong>
            </span>
            {pipelineFilter !== 'All' && <span className="tag">Pipeline: {pipelineFilter}</span>}
            {statusFilter !== 'All' && <span className="tag">Run status: {statusFilterLabel}</span>}
            {search.trim() && <span className="tag">Search: {search.trim()}</span>}
            {pipelinePayload?.generated_at && (
              <span>· Updated {new Date(pipelinePayload.generated_at).toLocaleString()}</span>
            )}
          </div>
          {loading && pipelinePayload && (
            <span style={{ color: '#059669', fontWeight: 600 }}>Refreshing…</span>
          )}
        </div>

        {error && (
          <div style={{
            padding: '12px 14px', marginBottom: 14, borderRadius: 8,
            background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 13
          }}>
            <strong>Cannot load Pipelines data.</strong> {error}
          </div>
        )}

        {loading && !pipelinePayload ? (
          <LoadingSpinner />
        ) : (
          <div style={{ opacity: loading ? 0.72 : 1, transition: 'opacity 0.15s ease' }}>
            {/* KPI strip */}
            <div className="kpi-grid-5">
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#EEF2FF', color: '#6366F1' }}>
                    <GitBranch size={16} />
                  </div>
                  <span className="kpi-label">{kpiMap.total_pipelines?.title || 'Total Pipelines'}</span>
                </div>
                <div className="kpi-value">
                  {kpiMap.total_pipelines?.display ?? dash(kpiMap.total_pipelines?.value)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>In catalog</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                    <CheckCircle size={16} />
                  </div>
                  <span className="kpi-label">{kpiMap.success_rate?.title || 'Successful Runs'}</span>
                </div>
                <div className="kpi-value" style={{ color: '#10B981' }}>
                  {kpiMap.success_rate?.display ?? '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {kpiMap.success_rate?.delta_label || '—'}
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#EFF6FF', color: '#3B82F6' }}>
                    <Activity size={16} />
                  </div>
                  <span className="kpi-label">{kpiMap.total_runs?.title || 'Runs'}</span>
                </div>
                <div className="kpi-value">
                  {kpiMap.total_runs?.display ?? '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Selected window
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#FEF2F2', color: '#EF4444' }}>
                    <AlertCircle size={16} />
                  </div>
                  <span className="kpi-label">{kpiMap.failed_runs?.title || 'Failed Runs'}</span>
                </div>
                <div className="kpi-value" style={{
                  color: Number(kpiMap.failed_runs?.value) > 0 ? '#EF4444' : '#10B981'
                }}>
                  {kpiMap.failed_runs?.display ?? '—'}
                </div>
                <div className={`kpi-delta ${Number(kpiMap.failed_runs?.value) > 0 ? 'down' : 'up'}`}>
                  {Number(kpiMap.failed_runs?.value) > 0
                    ? <ArrowDownRight size={12} />
                    : <ArrowUpRight size={12} />}
                  <span>{kpiMap.failed_runs?.delta_label || '—'}</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#F8FAFC', color: '#64748B' }}>
                    <Clock size={16} />
                  </div>
                  <span className="kpi-label">{kpiMap.avg_duration?.title || 'Avg Duration'}</span>
                </div>
                <div className="kpi-value">
                  {kpiMap.avg_duration?.display ?? '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {kpiMap.avg_duration?.delta_label || '—'}
                </div>
              </div>
            </div>

            {/* Catalog = what is registered */}
            <div className="card mt-4">
              <div className="card-header">
                <div>
                  <span className="card-title">Pipeline catalog</span>
                  <span className="card-subtitle">
                    Registered definitions (source → ETL → target). Select one to inspect its runs below.
                  </span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {catalogFiltered.length} pipeline{catalogFiltered.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="pipeline-catalog-list">
                {catalogFiltered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)', fontSize: 13 }}>
                    No pipelines in this filter window.
                  </div>
                ) : (
                  catalogFiltered.map(pipe => {
                    const active = pipe.pipeline_name === selectedPipelineName;
                    const activityLabel = pipe.activity || null;
                    return (
                      <button
                        key={pipe.pipeline_id || pipe.pipeline_name}
                        type="button"
                        className={`pipeline-catalog-row${active ? ' is-selected' : ''}`}
                        onClick={() => {
                          setSelectedPipelineName(pipe.pipeline_name);
                          setPage(1);
                        }}
                      >
                        <div className="pipeline-catalog-identity">
                          <div className="pipeline-catalog-name">
                            <GitBranch size={15} />
                            <span>{dash(pipe.pipeline_name)}</span>
                          </div>
                          <div className="pipeline-catalog-id">
                            {pipe.pipeline_id ? `${String(pipe.pipeline_id).slice(0, 13)}…` : '—'}
                          </div>
                        </div>

                        <div className="pipeline-catalog-flow">
                          <FlowChip label={pipe.source_tool} />
                          <ArrowRight size={12} className="pipeline-flow-arrow" />
                          <FlowChip label={pipe.etl_tool} />
                          <ArrowRight size={12} className="pipeline-flow-arrow" />
                          <FlowChip label={pipe.target_tool} />
                        </div>

                        <div className="pipeline-catalog-meta">
                          <div className="pipeline-catalog-meta-label">Last status</div>
                          <span className={`status-pill ${statusPillClass(pipe.status)}`}>
                            {dash(pipe.status)}
                          </span>
                        </div>

                        <div className="pipeline-catalog-meta">
                          <div className="pipeline-catalog-meta-label">Activity</div>
                          <span className={`pipeline-activity${(activityLabel || '').toLowerCase() === 'active' ? ' is-active' : ''}`}>
                            {dash(activityLabel)}
                          </span>
                        </div>

                        <div className="pipeline-catalog-meta">
                          <div className="pipeline-catalog-meta-label">Success</div>
                          <div className="pipeline-catalog-meta-value">
                            {pipe.success_rate
                              ?? (pipe.success_rate_pct != null ? `${pipe.success_rate_pct}%` : '—')}
                          </div>
                          <div className="pipeline-catalog-meta-sub">
                            {dash(pipe.total_runs ?? pipe.runs)} runs · {dash(pipe.avg_duration)}
                          </div>
                        </div>

                        <div className="pipeline-catalog-meta">
                          <div className="pipeline-catalog-meta-label">Last run</div>
                          <div className="pipeline-catalog-meta-value">{dash(pipe.last_run_age)}</div>
                          <div className="pipeline-catalog-meta-sub">
                            {pipe.last_run ? fmtDate(pipe.last_run) : '—'}
                          </div>
                          {pipe.has_open_incident ? (
                            <div className="pipeline-incident-flag">Open incident</div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Runs = what happened for the selected pipeline */}
            <div className="card mt-4">
              <div className="card-header" style={{ marginBottom: 14 }}>
                <div>
                  <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Play size={16} color="#10B981" />
                    <span>
                      Run history
                      {selectedPipeline ? (
                        <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
                          {' '}· {selectedPipeline.pipeline_name}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="card-subtitle">
                    Individual executions for the selected catalog pipeline (not the definition itself).
                  </span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {focusedRuns.length} run{focusedRuns.length === 1 ? '' : 's'}
                </span>
              </div>

              {selectedPipeline && (
                <div className="pipeline-focus-banner">
                  <span>
                    Flow:{' '}
                    <strong>{dash(selectedPipeline.source_tool)}</strong>
                    {' → '}
                    <strong>{dash(selectedPipeline.etl_tool)}</strong>
                    {' → '}
                    <strong>{dash(selectedPipeline.target_tool)}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    {dash(selectedPipeline.success_runs)} success / {dash(selectedPipeline.failed_runs)} failed
                  </span>
                  <span>·</span>
                  <span>Avg {dash(selectedPipeline.avg_duration)}</span>
                </div>
              )}

              <div className="table-wrapper">
                <table className="vithi-table">
                  <thead>
                    <tr>
                      <th>Run ID</th>
                      <th>Status</th>
                      <th>Timestamp</th>
                      <th>Duration</th>
                      <th>Tool</th>
                      <th>Message / Error</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedPipelineName ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                          Select a pipeline above to see its runs.
                        </td>
                      </tr>
                    ) : paginated.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                          No runs for <strong>{selectedPipelineName}</strong> in this window.
                        </td>
                      </tr>
                    ) : (
                      paginated.map((r, idx) => {
                        const st = (r.status || '').toLowerCase();
                        const isFailed = st === 'failed' || st === 'error';
                        const tool = r.tool || r.tool_name;
                        const detail = r.error_message || r.message;

                        return (
                          <tr
                            key={r.run_id || idx}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedRun(r)}
                          >
                            <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#3B82F6' }}>
                              {r.run_id != null ? `#${r.run_id}` : '—'}
                            </td>
                            <td>
                              <span className={`status-pill ${statusPillClass(r.status)}`}>
                                {dash(r.status)}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                                <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                                <span>{fmtDate(r.timestamp || r.start_time)}</span>
                              </div>
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {r.duration ?? fmtDuration(r.duration_seconds)}
                            </td>
                            <td>{tool ? <span className="tool-badge">{tool}</span> : '—'}</td>
                            <td style={{ maxWidth: 280 }}>
                              {detail ? (
                                <span style={{
                                  color: isFailed ? '#EF4444' : 'var(--text-secondary)',
                                  fontSize: 12,
                                  display: 'block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }} title={detail}>
                                  {detail}
                                </span>
                              ) : '—'}
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
                    <button className="export-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft size={14} /> Previous
                    </button>
                    <button className="export-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedRun && (
          <div className="modal-backdrop" onClick={() => setSelectedRun(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Terminal size={18} style={{ color: '#3B82F6' }} />
                  <span style={{ fontWeight: 600, fontSize: 15 }}>
                    Run details {selectedRun.run_id != null ? `— #${selectedRun.run_id}` : ''}
                  </span>
                </div>
                <button className="icon-btn" onClick={() => setSelectedRun(null)}>
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <div style={{ padding: 10, background: 'var(--bg-card-subtle)', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pipeline</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{dash(selectedRun.pipeline_name)}</div>
                  </div>
                  <div style={{ padding: 10, background: 'var(--bg-card-subtle)', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Status</div>
                    <span className={`status-pill ${statusPillClass(selectedRun.status)}`}>
                      {dash(selectedRun.status)}
                    </span>
                  </div>
                  <div style={{ padding: 10, background: 'var(--bg-card-subtle)', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Timestamp</div>
                    <div style={{ fontSize: 12 }}>{fmtDate(selectedRun.timestamp || selectedRun.start_time)}</div>
                  </div>
                  <div style={{ padding: 10, background: 'var(--bg-card-subtle)', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Duration</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      {selectedRun.duration ?? fmtDuration(selectedRun.duration_seconds)}
                    </div>
                  </div>
                  <div style={{ padding: 10, background: 'var(--bg-card-subtle)', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tool</div>
                    <div style={{ fontSize: 12 }}>{dash(selectedRun.tool || selectedRun.tool_name)}</div>
                  </div>
                  <div style={{ padding: 10, background: 'var(--bg-card-subtle)', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Level</div>
                    <div style={{ fontSize: 12 }}>{dash(selectedRun.level)}</div>
                  </div>
                </div>

                {(selectedRun.message || selectedRun.error_message) && (
                  <div style={{
                    padding: 12,
                    background: selectedRun.error_message ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-card-subtle)',
                    border: `1px solid ${selectedRun.error_message ? 'rgba(239, 68, 68, 0.2)' : 'var(--border)'}`,
                    borderRadius: 6
                  }}>
                    <div style={{
                      fontSize: 12, fontWeight: 600, marginBottom: 4,
                      display: 'flex', alignItems: 'center', gap: 6,
                      color: selectedRun.error_message ? '#EF4444' : 'var(--text-primary)'
                    }}>
                      {selectedRun.error_message ? <AlertTriangle size={14} /> : null}
                      {selectedRun.error_message ? 'Error' : 'Message'}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: selectedRun.error_message ? '#EF4444' : 'var(--text-secondary)',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {selectedRun.error_message || selectedRun.message}
                    </div>
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
