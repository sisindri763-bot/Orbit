import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch, CheckCircle, Clock, AlertTriangle,
  ArrowUpRight, Search, RotateCcw, ChevronRight, Activity, Shield, Database,
  Layers
} from 'lucide-react';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  fetchOverview,
  fetchLogs,
  fetchFilters
} from '../api/client';

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 8,
    fontSize: 12,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    color: '#0F172A'
  },
  itemStyle: { color: '#0F172A' },
  labelStyle: { color: '#64748B', fontWeight: 600 },
};

export default function Overview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Live state from API
  const [overviewData, setOverviewData] = useState(null);
  const [runs, setRuns] = useState([]);
  const [filterCatalog, setFilterCatalog] = useState(null);

  // Top Filters
  const [search, setSearch] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [toolFilter, setToolFilter] = useState('All');
  const [headerDatePreset, setHeaderDatePreset] = useState('all');
  const [customDateRange, setCustomDateRange] = useState(null);

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

      const [ovRes, logsRes, filtersRes] = await Promise.allSettled([
        fetchOverview(params),
        fetchLogs({ limit: 100 }),
        fetchFilters()
      ]);

      if (ovRes.status === 'fulfilled' && ovRes.value) {
        setOverviewData(ovRes.value);
      }
      if (logsRes.status === 'fulfilled' && logsRes.value) {
        const lList = logsRes.value.items || logsRes.value.logs || (Array.isArray(logsRes.value) ? logsRes.value : []);
        setRuns(lList);
      }
      if (filtersRes.status === 'fulfilled' && filtersRes.value) {
        setFilterCatalog(filtersRes.value);
      }
    } catch (e) {
      console.error('Failed to load live overview data:', e);
    } finally {
      setLoading(false);
    }
  }, [headerDatePreset, customDateRange, pipelineFilter, statusFilter, toolFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Distinct pipeline names for filter dropdown
  const distinctPipelineNames = useMemo(() => {
    const fromApi = filterCatalog?.items?.map(p => p.pipeline_name) || [];
    const fromOverview = overviewData?.items?.map(p => p.pipeline_name) || overviewData?.pipelines?.map(p => p.pipeline_name) || [];
    const fromRuns = runs.map(r => r.pipeline_name);
    return Array.from(new Set([...fromApi, ...fromOverview, ...fromRuns].filter(Boolean)));
  }, [filterCatalog, overviewData, runs]);

  // Handle header date range change
  const handleHeaderDateChange = (val) => {
    if (typeof val === 'string') {
      setHeaderDatePreset(val);
      setCustomDateRange(null);
    } else if (val && val.start && val.end) {
      setHeaderDatePreset('custom');
      setCustomDateRange(val);
    }
  };

  // Live KPIs extraction from backend overviewData.kpis
  const kpiMap = useMemo(() => {
    const map = {};
    if (overviewData?.kpis && Array.isArray(overviewData.kpis)) {
      overviewData.kpis.forEach(k => {
        map[k.id] = k;
      });
    }
    return map;
  }, [overviewData]);

  // Pipelines from overview
  const pipelinesList = useMemo(() => {
    return overviewData?.items || overviewData?.pipelines || [];
  }, [overviewData]);

  // Filtered pipelines based on client search
  const filteredPipelines = useMemo(() => {
    return pipelinesList.filter(p => {
      const pName = (p.pipeline_name || '').toLowerCase();
      const sTool = (p.source_tool || '').toLowerCase();
      const tTool = (p.target_tool || '').toLowerCase();
      const eTool = (p.etl_tool || '').toLowerCase();
      const status = (p.status || '').toLowerCase();

      const matchSearch = !search ||
        pName.includes(search.toLowerCase()) ||
        sTool.includes(search.toLowerCase()) ||
        tTool.includes(search.toLowerCase()) ||
        eTool.includes(search.toLowerCase());

      const matchStatus = statusFilter === 'All' || status === statusFilter.toLowerCase();
      const matchPipeline = pipelineFilter === 'All' || p.pipeline_name === pipelineFilter;
      const matchTool = toolFilter === 'All' ||
        sTool === toolFilter.toLowerCase() ||
        tTool === toolFilter.toLowerCase() ||
        eTool === toolFilter.toLowerCase();

      return matchSearch && matchStatus && matchPipeline && matchTool;
    });
  }, [pipelinesList, search, statusFilter, pipelineFilter, toolFilter]);

  // Incidents
  const incidentsList = useMemo(() => {
    const incs = overviewData?.incidents || [];
    return incs.map(inc => ({
      title: inc.title ?? inc.pipeline_name ?? 'Pipeline execution issue',
      desc: inc.description ?? inc.error_message ?? 'Execution error detected',
      pipeline_name: inc.pipeline_name || '',
      severity: inc.severity ?? 'Critical',
      state: inc.state ?? inc.status ?? 'OPEN',
      start_time: inc.opened_at || inc.start_time,
      time: inc.opened_age ?? (inc.opened_at || inc.start_time ? new Date(inc.opened_at || inc.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently')
    }));
  }, [overviewData]);

  // Health Pillars (Freshness, Volume, Data Quality, Schema, Uniqueness)
  const healthPillars = useMemo(() => {
    if (overviewData?.pillars && Array.isArray(overviewData.pillars) && overviewData.pillars.length > 0) {
      return overviewData.pillars;
    }
    if (overviewData?.health && Array.isArray(overviewData.health) && overviewData.health.length > 0) {
      return overviewData.health;
    }
    return [];
  }, [overviewData]);

  // Charts from backend series/charts
  const runsChart = useMemo(() => {
    if (overviewData?.charts?.labels && overviewData?.charts?.runs_over_time) {
      const labels = overviewData.charts.labels;
      const successArr = overviewData.charts.runs_over_time.success || [];
      const failedArr = overviewData.charts.runs_over_time.failed || [];
      return labels.map((lbl, idx) => ({
        time: lbl,
        Success: successArr[idx] ?? 0,
        Failed: failedArr[idx] ?? 0,
        Total: (successArr[idx] ?? 0) + (failedArr[idx] ?? 0)
      }));
    }
    // Fallback from runs if charts array is empty
    const dateMap = {};
    runs.forEach(r => {
      const dateKey = (r.start_time || '').substring(0, 10);
      if (!dateKey) return;
      const fmt = new Date(dateKey).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
      if (!dateMap[fmt]) dateMap[fmt] = { time: fmt, Success: 0, Failed: 0, dateRaw: dateKey };
      if ((r.status || '').toLowerCase() === 'success') {
        dateMap[fmt].Success += 1;
      } else {
        dateMap[fmt].Failed += 1;
      }
    });
    const entries = Object.values(dateMap);
    entries.sort((a, b) => (a.dateRaw || '').localeCompare(b.dateRaw || ''));
    return entries;
  }, [overviewData, runs]);

  const successChart = useMemo(() => {
    if (overviewData?.charts?.labels && overviewData?.charts?.success_rate_over_time) {
      const labels = overviewData.charts.labels;
      const rates = overviewData.charts.success_rate_over_time;
      return labels.map((lbl, idx) => ({
        time: lbl,
        rate: rates[idx] != null ? Math.round(rates[idx]) : 100
      }));
    }
    return runsChart.map(item => {
      const total = item.Success + item.Failed;
      const rate = total > 0 ? Math.round((item.Success / total) * 100) : 100;
      return { time: item.time, rate };
    });
  }, [overviewData, runsChart]);

  const incidentsChart = useMemo(() => {
    if (overviewData?.charts?.labels && overviewData?.charts?.incidents_over_time) {
      const labels = overviewData.charts.labels;
      const openInc = overviewData.charts.incidents_over_time.open || overviewData.charts.incidents_over_time.failed_runs || [];
      return labels.map((lbl, idx) => ({
        time: lbl,
        count: openInc[idx] ?? 0
      }));
    }
    return runsChart.map(item => ({
      time: item.time,
      count: item.Failed
    }));
  }, [overviewData, runsChart]);

  const clearFilters = () => {
    setSearch('');
    setPipelineFilter('All');
    setStatusFilter('All');
    setToolFilter('All');
    setHeaderDatePreset('all');
    setCustomDateRange(null);
  };

  const hasActiveFilters = search || pipelineFilter !== 'All' || statusFilter !== 'All' || toolFilter !== 'All' || headerDatePreset !== 'all';

  return (
    <div className="fade-in">
      <PageHeader
        title="Overview"
        subtitle="Real-time data observability, pipeline health, and SLAs powered by live backend."
        onRefresh={loadData}
        onDateChange={handleHeaderDateChange}
      />

      <div className="page-body">
        {/* Top Filters Toolbar */}
        <div className="filters-bar">
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search pipelines, tools, source, target..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-select">
            <label>Pipeline</label>
            <select
              className="select-control"
              value={pipelineFilter}
              onChange={e => setPipelineFilter(e.target.value)}
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
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Success">Success</option>
              <option value="Failed">Failed</option>
              <option value="Degraded">Degraded</option>
            </select>
          </div>

          <div className="filter-select">
            <label>Engine / Tool</label>
            <select
              className="select-control"
              value={toolFilter}
              onChange={e => setToolFilter(e.target.value)}
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
        </div>

        {loading && !overviewData ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* KPI Cards Grid */}
            <div className="kpi-grid-5">
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#EEF2FF', color: '#6366F1' }}>
                    <GitBranch size={16} />
                  </div>
                  <span className="kpi-label">
                    {kpiMap.total_pipelines?.title || 'Total Pipelines'}
                  </span>
                </div>
                <div className="kpi-value">
                  {kpiMap.total_pipelines?.display ?? pipelinesList.length}
                </div>
                <div className="kpi-delta up">
                  <ArrowUpRight size={12} />
                  <span>Monitored in catalog</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                    <CheckCircle size={16} />
                  </div>
                  <span className="kpi-label">
                    {kpiMap.success_rate?.title || 'Successful Runs'}
                  </span>
                </div>
                <div className="kpi-value" style={{ color: '#10B981' }}>
                  {kpiMap.success_rate?.display ?? (kpiMap.successful_runs?.display || '100%')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {kpiMap.successful_runs ? `${kpiMap.successful_runs.value} runs completed` : 'Passing rate'}
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#EFF6FF', color: '#3B82F6' }}>
                    <Activity size={16} />
                  </div>
                  <span className="kpi-label">
                    {kpiMap.total_runs?.title || 'Total Runs'}
                  </span>
                </div>
                <div className="kpi-value">
                  {kpiMap.total_runs?.display ?? runs.length}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Selected time window
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#FEF2F2', color: '#EF4444' }}>
                    <AlertTriangle size={16} />
                  </div>
                  <span className="kpi-label">
                    {kpiMap.open_incidents?.title || 'Open Incidents'}
                  </span>
                </div>
                <div className="kpi-value" style={{ color: (kpiMap.open_incidents?.value || 0) > 0 ? '#EF4444' : '#10B981' }}>
                  {kpiMap.open_incidents?.display ?? incidentsList.length}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {incidentsList.length === 0 ? 'No open incidents' : 'Requires review'}
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#F8FAFC', color: '#64748B' }}>
                    <Clock size={16} />
                  </div>
                  <span className="kpi-label">
                    {kpiMap.avg_duration?.title || 'Avg Latency'}
                  </span>
                </div>
                <div className="kpi-value">
                  {kpiMap.avg_duration?.display || '15s'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Execution duration
                </div>
              </div>
            </div>

            {/* Observability Health Pillars (Live Backend Scoring) */}
            {healthPillars.length > 0 && (
              <div className="card mt-4">
                <div className="card-header">
                  <div>
                    <span className="card-title">Data Observability Health Pillars</span>
                    <span className="card-subtitle">
                      Live reliability status computed across freshness SLAs, data volume, data quality rules, and schema drift.
                    </span>
                  </div>
                  <button className="export-btn" onClick={() => navigate('/observability')}>
                    Deep Dive <ChevronRight size={13} />
                  </button>
                </div>

                <div className="grid-4" style={{ gap: 14 }}>
                  {healthPillars.map(pillar => {
                    const score = pillar.score != null ? Math.round(pillar.score) : 100;
                    const tone = pillar.status === 'Critical' ? '#EF4444' : pillar.status === 'Warning' || pillar.status === 'Degraded' ? '#F59E0B' : '#10B981';
                    const iconMap = {
                      freshness: <Clock size={18} style={{ color: tone }} />,
                      volume: <Database size={18} style={{ color: tone }} />,
                      data_quality: <Shield size={18} style={{ color: tone }} />,
                      schema: <Layers size={18} style={{ color: tone }} />,
                      uniqueness: <CheckCircle size={18} style={{ color: tone }} />
                    };

                    return (
                      <div
                        key={pillar.id}
                        className="health-pillar-card"
                        onClick={() => {
                          if (pillar.id === 'freshness') navigate('/observability/freshness');
                          else if (pillar.id === 'volume') navigate('/observability/volume');
                          else if (pillar.id === 'data_quality') navigate('/observability/data-quality');
                          else if (pillar.id === 'schema') navigate('/observability/schema');
                          else navigate('/observability');
                        }}
                        style={{
                          background: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: '14px 16px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {iconMap[pillar.id] || <Activity size={18} style={{ color: tone }} />}
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{pillar.name}</span>
                          </div>
                          <span
                            className={`status-pill ${pillar.status === 'Good' ? 'good' : pillar.status === 'Critical' ? 'critical' : 'warning'}`}
                          >
                            {pillar.status || 'Good'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 24, fontWeight: 700, color: tone }}>{pillar.display || `${score}%`}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>score</span>
                        </div>
                        <div style={{ width: '100%', height: 5, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, Math.max(0, score))}%`, height: '100%', background: tone, borderRadius: 4 }} />
                        </div>
                        {pillar.details && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
                            {pillar.id === 'freshness' && `${pillar.details.fresh ?? 0} fresh / ${pillar.details.delayed ?? 0} delayed`}
                            {pillar.id === 'data_quality' && `${pillar.details.passed ?? 0} pass / ${pillar.details.warn ?? 0} warn / ${pillar.details.failed ?? 0} fail`}
                            {pillar.id === 'schema' && `${pillar.details.changes ?? 0} changes / ${pillar.details.breaking ?? 0} breaking`}
                            {pillar.id === 'volume' && `${pillar.details.healthy ?? 0} healthy / ${pillar.details.total ?? 1} datasets`}
                            {pillar.id === 'uniqueness' && `${pillar.details.checks_run ?? 0} uniqueness checks`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Live Visual Charts */}
            <div className="grid-3 mt-4" style={{ gap: 16 }}>
              <div className="card">
                <div className="card-header">
                  <div>
                    <span className="card-title">Runs Over Time</span>
                    <span className="card-subtitle">Execution distribution by status</span>
                  </div>
                </div>
                <div style={{ height: 180, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={runsChart} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Bar dataKey="Success" fill="#10B981" radius={[4, 4, 0, 0]} stackId="a" />
                      <Bar dataKey="Failed" fill="#EF4444" radius={[4, 4, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div>
                    <span className="card-title">Success Rate Trend</span>
                    <span className="card-subtitle">Reliability percentage (%)</span>
                  </div>
                </div>
                <div style={{ height: 180, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={successChart} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Area type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#successGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div>
                    <span className="card-title">Incident Activity</span>
                    <span className="card-subtitle">Anomalies & failures</span>
                  </div>
                </div>
                <div style={{ height: 180, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={incidentsChart} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="incidentGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Area type="monotone" dataKey="count" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#incidentGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Monitored Pipelines Live Table */}
            <div className="card mt-4">
              <div className="card-header">
                <div>
                  <span className="card-title">Pipeline Monitoring</span>
                  <span className="card-subtitle">Live health status, success rates, and engine topology across all pipelines</span>
                </div>
                <button className="export-btn" onClick={() => navigate('/pipelines')}>
                  View All Pipelines <ChevronRight size={13} />
                </button>
              </div>

              <div className="table-wrapper">
                <table className="vithi-table">
                  <thead>
                    <tr>
                      <th>Pipeline</th>
                      <th>Source → ETL → Target</th>
                      <th>Status</th>
                      <th>Total Runs</th>
                      <th>Success Rate</th>
                      <th>Avg Duration</th>
                      <th>Last Run</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPipelines.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                          No pipelines matching the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredPipelines.map((pipe) => {
                        const isPassing = (pipe.status || '').toLowerCase() === 'success' || (pipe.status || '') === 'Good';
                        const isDegraded = (pipe.status || '').toLowerCase() === 'degraded' || (pipe.status || '').toLowerCase() === 'n/a';
                        const statusClass = isPassing ? 'good' : isDegraded ? 'warning' : 'critical';

                        return (
                          <tr key={pipe.pipeline_id || pipe.pipeline_name} className="interactive-row" onClick={() => navigate('/pipelines')}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <GitBranch size={15} style={{ color: 'var(--accent)' }} />
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pipe.pipeline_name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {pipe.pipeline_id ? pipe.pipeline_id.substring(0, 8) + '...' : 'default'}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                <span className="tag">{pipe.source_tool || 'snowflake'}</span>
                                <span style={{ color: 'var(--text-muted)' }}>→</span>
                                <span className="tag accent">{pipe.etl_tool || 'dbt'}</span>
                                <span style={{ color: 'var(--text-muted)' }}>→</span>
                                <span className="tag">{pipe.target_tool || 'snowflake'}</span>
                              </div>
                            </td>
                            <td>
                              <span className={`status-pill ${statusClass}`}>
                                {pipe.status || 'Active'}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600 }}>{pipe.total_runs ?? pipe.runs ?? 0}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 48, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${pipe.success_rate_pct != null ? pipe.success_rate_pct : (pipe.total_runs > 0 ? (pipe.success_runs / pipe.total_runs) * 100 : 100)}%`,
                                      height: '100%',
                                      background: isPassing ? '#10B981' : '#F59E0B'
                                    }}
                                  />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 500 }}>
                                  {pipe.success_rate_pct != null ? `${pipe.success_rate_pct}%` : (pipe.success_rate || '100%')}
                                </span>
                              </div>
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>
                              {pipe.avg_duration ?? (pipe.avg_duration_seconds ? `${pipe.avg_duration_seconds}s` : '15s')}
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>
                              {pipe.last_run_age || pipe.last_run || pipe.global_last_run || 'recently'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="export-btn"
                                style={{ padding: '4px 8px', fontSize: 11 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate('/pipelines');
                                }}
                              >
                                View Runs
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Incidents Section */}
            {incidentsList.length > 0 && (
              <div className="card mt-4">
                <div className="card-header">
                  <div>
                    <span className="card-title">Recent Open Incidents</span>
                    <span className="card-subtitle">Active alerts and pipeline failures requiring attention</span>
                  </div>
                  <button className="export-btn" onClick={() => navigate('/incidents')}>
                    View All Incidents <ChevronRight size={13} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {incidentsList.map((inc, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        background: 'var(--bg-card-subtle)',
                        borderRadius: 8,
                        borderLeft: `4px solid ${inc.severity === 'Critical' ? '#EF4444' : '#F59E0B'}`
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <AlertTriangle size={18} style={{ color: inc.severity === 'Critical' ? '#EF4444' : '#F59E0B' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{inc.title}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{inc.desc}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="tag">{inc.pipeline_name || 'Pipeline'}</span>
                        <span className={`status-pill ${inc.severity === 'Critical' ? 'critical' : 'warning'}`}>
                          {inc.severity}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inc.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
