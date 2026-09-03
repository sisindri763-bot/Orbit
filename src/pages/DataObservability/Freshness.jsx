import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  CheckCircle, Clock, AlertTriangle, Search,
  Database, Info, RotateCcw, Tag, X, ArrowUpRight, ArrowDownRight,
  ChevronLeft, ChevronRight, RefreshCw, GitBranch
} from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import { fetchFreshness, evaluateMonitors } from '../../api/client';

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Freshness() {
  const [data, setData] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
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

      const res = await fetchFreshness(params);
      if (res) {
        const list = res.items || res.freshness_checks || (Array.isArray(res) ? res : []);
        setData(list);
        if (res.kpis) setKpis(res.kpis);
      }
    } catch (e) {
      console.error('Failed to load freshness data:', e);
    } finally {
      setLoading(false);
    }
  }, [headerDatePreset, customDateRange, pipelineFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      await evaluateMonitors();
      await loadData();
    } catch (e) {
      console.error('Evaluate freshness error:', e);
    } finally {
      setEvaluating(false);
    }
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

  // Distinct pipelines
  const distinctPipelines = useMemo(() => {
    return Array.from(new Set(data.map(d => d.pipeline_name).filter(Boolean)));
  }, [data]);

  // KPI mapping
  const kpiMap = useMemo(() => {
    const map = {};
    kpis.forEach(k => { map[k.id] = k; });
    return map;
  }, [kpis]);

  const freshCount = kpiMap.fresh?.value ?? data.filter(d => (d.status_key || d.status || '').toLowerCase() === 'fresh').length;
  const delayedCount = kpiMap.delayed?.value ?? data.filter(d => (d.status_key || d.status || '').toLowerCase() === 'delayed').length;
  const staleCount = kpiMap.stale?.value ?? data.filter(d => (d.status_key || d.status || '').toLowerCase() === 'stale').length;
  const totalMonitored = kpiMap.datasets_monitored?.value ?? data.length;

  // Filtered dataset
  const filtered = useMemo(() => {
    return data.filter(d => {
      const pName = (d.pipeline_name || '').toLowerCase();
      const st = (d.status_key || d.status || '').toLowerCase();
      const sTool = (d.source_tool || '').toLowerCase();
      const tTool = (d.target_tool || '').toLowerCase();

      const matchSearch = !search ||
        pName.includes(search.toLowerCase()) ||
        sTool.includes(search.toLowerCase()) ||
        tTool.includes(search.toLowerCase());

      const matchPipeline = pipelineFilter === 'All' || d.pipeline_name === pipelineFilter;
      const matchStatus = statusFilter === 'All' || st === statusFilter.toLowerCase();

      return matchSearch && matchPipeline && matchStatus;
    });
  }, [data, search, pipelineFilter, statusFilter]);

  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

  return (
    <div className="fade-in">
      <PageHeader
        title="Freshness"
        subtitle="Monitor data arrival latency, update SLAs and freshness schedules in real time."
        onRefresh={loadData}
        onDateChange={handleHeaderDateChange}
      />

      <div className="page-body">
        {/* Filter Toolbar */}
        <div className="filters-bar">
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search pipeline or tool..."
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
              {distinctPipelines.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="filter-select">
            <label>Freshness Status</label>
            <select
              className="select-control"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="All">All Statuses</option>
              <option value="fresh">Fresh (On Time)</option>
              <option value="delayed">Delayed (Lagging)</option>
              <option value="stale">Stale (Breached SLA)</option>
            </select>
          </div>

          <button
            className="export-btn"
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={handleEvaluate}
            disabled={evaluating}
          >
            <RefreshCw size={13} className={evaluating ? 'spin' : ''} />
            {evaluating ? 'Evaluating...' : 'Evaluate Freshness'}
          </button>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="kpi-grid-4 mt-4">
          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                <CheckCircle size={18} />
              </div>
              <span className="kpi-label">Fresh Pipelines</span>
            </div>
            <div className="kpi-value" style={{ color: '#10B981' }}>
              {kpiMap.fresh?.display || freshCount}
            </div>
            <div className="kpi-delta up">
              <ArrowUpRight size={13} />
              <span>Within configured SLA</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#FFFBEB', color: '#F59E0B' }}>
                <Clock size={18} />
              </div>
              <span className="kpi-label">Delayed Pipelines</span>
            </div>
            <div className="kpi-value" style={{ color: delayedCount > 0 ? '#F59E0B' : '#10B981' }}>
              {kpiMap.delayed?.display || delayedCount}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Approaching SLA threshold
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#FEF2F2', color: '#EF4444' }}>
                <AlertTriangle size={18} />
              </div>
              <span className="kpi-label">Stale (SLA Breached)</span>
            </div>
            <div className="kpi-value" style={{ color: staleCount > 0 ? '#EF4444' : '#10B981' }}>
              {kpiMap.stale?.display || staleCount}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {staleCount === 0 ? '0 SLA breaches' : 'Immediate sync needed'}
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#EFF6FF', color: '#3B82F6' }}>
                <GitBranch size={18} />
              </div>
              <span className="kpi-label">Monitored Models</span>
            </div>
            <div className="kpi-value">{totalMonitored}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Active SLA monitors
            </div>
          </div>
        </div>

        {/* Freshness SLAs Table */}
        <div className="card mt-4">
          <div className="card-header">
            <div>
              <span className="card-title">Freshness Status & Lag by Pipeline</span>
              <span className="card-subtitle">Real-time update intervals vs declared SLAs</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Showing {filtered.length === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length} pipelines
            </span>
          </div>

          <div className="table-wrapper">
            <table className="vithi-table">
              <thead>
                <tr>
                  <th>Pipeline Name</th>
                  <th>Source → Target</th>
                  <th>Status</th>
                  <th>Configured SLA</th>
                  <th>Current Lag</th>
                  <th>Last Updated</th>
                  <th>Last Check Time</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                      No freshness monitoring records match your criteria.
                    </td>
                  </tr>
                ) : (
                  paginated.map((item, idx) => {
                    const st = (item.status_key || item.status || '').toLowerCase();
                    const isFresh = st === 'fresh';
                    const isDelayed = st === 'delayed';
                    const statusClass = isFresh ? 'good' : isDelayed ? 'warning' : 'critical';

                    return (
                      <tr key={item.pipeline_id || idx}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <GitBranch size={15} style={{ color: 'var(--accent)' }} />
                            <div>
                              <div style={{ fontWeight: 600 }}>{item.pipeline_name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {item.pipeline_id ? item.pipeline_id.substring(0, 8) + '...' : 'default'}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <span className="tag">{item.source_tool || 'snowflake'}</span>
                            <span style={{ color: 'var(--text-muted)' }}>→</span>
                            <span className="tag accent">{item.etl_tool || 'dbt'}</span>
                            <span style={{ color: 'var(--text-muted)' }}>→</span>
                            <span className="tag">{item.target_tool || 'snowflake'}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill ${statusClass}`}>
                            {item.status || (isFresh ? 'Fresh' : isDelayed ? 'Delayed' : 'Stale')}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {item.sla_hours ? `${item.sla_hours} hrs` : '24 hrs'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Clock size={13} style={{ color: isFresh ? '#10B981' : '#F59E0B' }} />
                            <strong style={{ color: isFresh ? '#10B981' : '#F59E0B' }}>
                              {item.current_lag_display || `${item.current_lag_hours || 0}h`}
                            </strong>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {item.last_updated_age || item.last_updated_at || 'recently'}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>
                          {fmtTime(item.as_of)}
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
        </div>
      </div>
    </div>
  );
}
