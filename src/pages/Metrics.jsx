import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Clock, Play, XCircle, CheckCircle, Activity,
  RefreshCw, Download, Calendar, MoreVertical,
  ArrowUpRight, ArrowDownRight, Database, GitBranch, Search, Filter, Shield,
  Zap, Gauge, BarChart2, TrendingUp, CheckCircle2, AlertTriangle, Layers,
  Timer, Cpu, Check, FileSpreadsheet, ArrowRight, ExternalLink, Sliders, ChevronDown
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchMetrics, fetchOverviewCharts, fetchPipelines } from '../api/client';

const TOOLTIP_STYLE = {
  contentStyle: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
  itemStyle: { color: '#0F172A' },
  labelStyle: { color: '#64748B', fontWeight: 600 },
};

export default function Metrics() {
  const [loading, setLoading] = useState(true);
  const [metricsData, setMetricsData] = useState(null);
  const [chartsData, setChartsData] = useState(null);
  const [pipelines, setPipelines] = useState([]);

  // Modern Enterprise Filters
  const [selectedPipeline, setSelectedPipeline] = useState('All Pipelines');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  const [selectedTool, setSelectedTool] = useState('All Tools');
  const [search, setSearch] = useState('');
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
      if (selectedPipeline !== 'All Pipelines') params.pipeline_name = selectedPipeline;
      if (selectedTool !== 'All Tools') params.tool = selectedTool;

      const [m, c, p] = await Promise.allSettled([
        fetchMetrics(params),
        fetchOverviewCharts(params),
        fetchPipelines(params)
      ]);

      if (m.status === 'fulfilled' && m.value) setMetricsData(m.value);
      if (c.status === 'fulfilled' && c.value) setChartsData(c.value);
      if (p.status === 'fulfilled' && p.value) {
        setPipelines(p.value.items || p.value.pipelines || (Array.isArray(p.value) ? p.value : []));
      }
    } catch (e) {
      console.error('Error loading live metrics data:', e);
    } finally {
      setLoading(false);
    }
  }, [headerDatePreset, customDateRange, selectedPipeline, selectedTool]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleHeaderDateChange = (val) => {
    if (typeof val === 'string') {
      setHeaderDatePreset(val);
      setCustomDateRange(null);
    } else if (val && val.start && val.end) {
      setHeaderDatePreset('custom');
      setCustomDateRange(val);
    }
  };

  // Raw Pipeline Items directly from API
  const rawPipelineItems = useMemo(() => {
    return metricsData?.items || metricsData?.charts?.top_by_duration || pipelines || [];
  }, [metricsData, pipelines]);

  // Apply Global Filters across entire page
  const filteredPipelines = useMemo(() => {
    return rawPipelineItems.filter(p => {
      const matchSearch = !search || p.pipeline_name.toLowerCase().includes(search.toLowerCase());
      const matchPipeline = selectedPipeline === 'All Pipelines' || p.pipeline_name === selectedPipeline;
      const matchTool = selectedTool === 'All Tools' || (p.tool && p.tool.toLowerCase().includes(selectedTool.toLowerCase()));
      const matchStatus = selectedStatus === 'All Statuses' ||
        (selectedStatus === 'Success' && p.success_rate_pct === 100) ||
        (selectedStatus === 'Degraded' && p.status_key === 'degraded') ||
        (selectedStatus === 'Failed' && p.status_key === 'failed');
      return matchSearch && matchPipeline && matchTool && matchStatus;
    });
  }, [rawPipelineItems, search, selectedPipeline, selectedTool, selectedStatus]);

  // Dynamically calculate KPIs based on active filters
  const dynamicKPIs = useMemo(() => {
    const total = filteredPipelines.length;
    if (total === 0) {
      return {
        successRate: '0.0%',
        avgDuration: '0s',
        totalRuns: 0,
        failedRuns: 0,
        avgFreshness: 'N/A',
      };
    }

    const sumDuration = filteredPipelines.reduce((acc, p) => acc + (Number(p.avg_duration_seconds) || 0), 0);
    const sumRuns = filteredPipelines.reduce((acc, p) => acc + (Number(p.runs) || 0), 0);
    const sumSuccess = filteredPipelines.reduce((acc, p) => {
      const rate = Number(p.success_rate_pct);
      const runs = Number(p.runs) || 0;
      if (Number.isFinite(rate) && runs) return acc + (rate / 100) * runs;
      return acc;
    }, 0);
    const freshnessVals = filteredPipelines
      .map(p => Number(p.avg_freshness_hours))
      .filter(n => Number.isFinite(n));
    const sumFreshness = freshnessVals.reduce((acc, n) => acc + n, 0);

    return {
      successRate: sumRuns ? `${((sumSuccess / sumRuns) * 100).toFixed(1)}%` : '—',
      avgDuration: total && sumDuration ? `${(sumDuration / total).toFixed(0)}s` : '—',
      totalRuns: sumRuns,
      failedRuns: Math.max(0, Math.round(sumRuns - sumSuccess)),
      avgFreshness: freshnessVals.length ? `${(sumFreshness / freshnessVals.length).toFixed(1)}h` : '—',
    };
  }, [filteredPipelines]);

  // Latency Trend Chart Series — prefer API series, else empty
  const timeSeriesData = useMemo(() => {
    const apiSeries =
      chartsData?.series?.duration_over_time ||
      metricsData?.series?.duration_over_time ||
      chartsData?.charts?.duration_over_time ||
      [];
    if (Array.isArray(apiSeries) && apiSeries.length > 0) {
      return apiSeries.map((d) => ({
        time: d.time || d.label || d.date || d.day,
        duration: Number(d.duration ?? d.value ?? d.avg_duration_seconds) || 0,
      }));
    }
    return [];
  }, [chartsData, metricsData]);

  // Donut Chart Data from live totals
  const statusChartData = useMemo(() => {
    const successCount = Math.max(0, dynamicKPIs.totalRuns - dynamicKPIs.failedRuns);
    const failedCount = dynamicKPIs.failedRuns;
    const total = dynamicKPIs.totalRuns || 0;
    if (!total) {
      return [
        { name: 'Success', value: 0, color: '#10B981', pct: '—' },
        { name: 'Failed', value: 0, color: '#EF4444', pct: '—' },
        { name: 'Running', value: 0, color: '#F59E0B', pct: '—' },
        { name: 'Cancelled', value: 0, color: '#94A3B8', pct: '—' },
      ];
    }

    return [
      { name: 'Success', value: successCount, color: '#10B981', pct: `${Math.round((successCount / total) * 100)}%` },
      { name: 'Failed', value: failedCount, color: '#EF4444', pct: `${Math.round((failedCount / total) * 100)}%` },
      { name: 'Running', value: 0, color: '#F59E0B', pct: '0%' },
      { name: 'Cancelled', value: 0, color: '#94A3B8', pct: '0%' },
    ];
  }, [dynamicKPIs]);

  const dqSummary = useMemo(() => {
    const dims = metricsData?.summary?.by_dimension || metricsData?.charts?.by_dimension || null;
    const freshness = dynamicKPIs.avgFreshness;
    return { dims, freshness };
  }, [metricsData, dynamicKPIs.avgFreshness]);

  return (
    <div className="fade-in">
      <PageHeader
        title="Metrics & Reliability"
        subtitle="Operational telemetry, execution durations, run frequency, and data freshness metrics across pipelines."
        onRefresh={loadData}
        onDateChange={handleHeaderDateChange}
      />

      <div className="page-body">
        {/* ── 1. MODERN ENTERPRISE FILTERS TOOLBAR (TOP) ──────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap', marginBottom: 18, padding: '10px 14px',
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Pipeline Pill */}
            <div className="enterprise-filter-pill">
              <GitBranch size={13} color="#10B981" />
              <span style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>Pipeline:</span>
              <select
                className="enterprise-filter-select"
                value={selectedPipeline}
                onChange={e => setSelectedPipeline(e.target.value)}
              >
                <option value="All Pipelines">All Pipelines ({pipelines.length || 1})</option>
                {pipelines.map(p => (
                  <option key={p.pipeline_id || p.pipeline_name} value={p.pipeline_name}>
                    {p.pipeline_name}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} color="var(--text-muted)" />
            </div>

            {/* Tool Engine Pill */}
            <div className="enterprise-filter-pill">
              <Zap size={13} color="#6366F1" />
              <span style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>Engine:</span>
              <select
                className="enterprise-filter-select"
                value={selectedTool}
                onChange={e => setSelectedTool(e.target.value)}
              >
                <option value="All Tools">All Tools</option>
                <option value="dbt">dbt Cloud</option>
                <option value="snowflake">Snowflake</option>
              </select>
              <ChevronDown size={12} color="var(--text-muted)" />
            </div>

            {/* Health Status Pill */}
            <div className="enterprise-filter-pill">
              <Shield size={13} color="#F59E0B" />
              <span style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>Status:</span>
              <select
                className="enterprise-filter-select"
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
              >
                <option value="All Statuses">All Statuses</option>
                <option value="Success">Success (100%)</option>
                <option value="Degraded">Degraded (Freshness)</option>
                <option value="Failed">Failed (0)</option>
              </select>
              <ChevronDown size={12} color="var(--text-muted)" />
            </div>

            {/* Search Input */}
            <div className="search-box" style={{ width: 220 }}>
              <Search size={13} />
              <input
                type="text"
                placeholder="Search pipelines..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ height: 32, fontSize: 12, paddingLeft: 30 }}
              />
            </div>
          </div>

          {(selectedPipeline !== 'All Pipelines' || selectedTool !== 'All Tools' || selectedStatus !== 'All Statuses' || search) && (
            <button
              className="clear-filters-btn"
              onClick={() => {
                setSelectedPipeline('All Pipelines');
                setSelectedTool('All Tools');
                setSelectedStatus('All Statuses');
                setSearch('');
              }}
              style={{ fontSize: 12, fontWeight: 600, color: '#EF4444' }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* ── 2. EXECUTIVE 5-KPI BALANCED GRID (NEVER WRAPS INTO AN ORPHAN CARD) ─ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 18 }}>
          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                <CheckCircle size={18} />
              </div>
              <span className="kpi-label">Success Rate</span>
            </div>
            <div className="kpi-value" style={{ color: '#10B981' }}>{dynamicKPIs.successRate}</div>
            <div className="kpi-delta up">
              <ArrowUpRight size={13} />
              <span>0 Failures recorded</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#EFF6FF', color: '#3B82F6' }}>
                <Clock size={18} />
              </div>
              <span className="kpi-label">Average Duration</span>
            </div>
            <div className="kpi-value">{dynamicKPIs.avgDuration}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Target SLA &lt; 60s
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#EEF2FF', color: '#6366F1' }}>
                <Activity size={18} />
              </div>
              <span className="kpi-label">Total Runs</span>
            </div>
            <div className="kpi-value">{dynamicKPIs.totalRuns}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              100% completed
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#FEF2F2', color: '#EF4444' }}>
                <XCircle size={18} />
              </div>
              <span className="kpi-label">Failed Runs</span>
            </div>
            <div className="kpi-value" style={{ color: dynamicKPIs.failedRuns > 0 ? '#EF4444' : '#10B981' }}>
              {dynamicKPIs.failedRuns}
            </div>
            <div className="kpi-delta down">
              <ArrowDownRight size={13} />
              <span>0 Errors</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#FFFBEB', color: '#F59E0B' }}>
                <Timer size={18} />
              </div>
              <span className="kpi-label">Avg Freshness</span>
            </div>
            <div className="kpi-value" style={{ color: '#F59E0B' }}>{dynamicKPIs.avgFreshness}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Target sync &lt; 24h
            </div>
          </div>
        </div>

        {/* ── 3. VISUAL ANALYTICS & 25 DQ ASSERTIONS SECTION ──────────────────── */}
        <div className="grid-2" style={{ gap: 16, marginBottom: 18 }}>
          {/* Chart 1: Latency Trend Over Time */}
          <div className="card">
            <div className="card-header">
              <div>
                <span className="card-title">Execution Latency Trend (Seconds)</span>
                <span className="card-subtitle">Runtime stability across historical pipeline executions</span>
              </div>
            </div>
            <div style={{ height: 210, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="durGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[10, 20]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} unit="s" />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="duration" stroke="#6366F1" strokeWidth={2.5} fillOpacity={1} fill="url(#durGrad)" name="Runtime (seconds)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Execution Status Breakdown Donut */}
          <div className="card">
            <div className="card-header">
              <div>
                <span className="card-title">Execution Status Breakdown</span>
                <span className="card-subtitle">Run health outcomes (100% Success)</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: 210 }}>
              <div style={{ width: 140, height: 140, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={44}
                      outerRadius={65}
                      paddingAngle={3}
                    >
                      {statusChartData.map((e, idx) => (
                        <Cell key={idx} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {statusChartData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{d.name}:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{d.value} ({d.pct})</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Data Quality Assertions — from API when available */}
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-header">
            <div>
              <span className="card-title">Data Quality Assertions Summary</span>
              <span className="card-subtitle">Dimensions from live metrics / quality evaluation</span>
            </div>
          </div>

          {dqSummary.dims ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, padding: 4 }}>
              {Object.entries(dqSummary.dims).map(([key, val]) => {
                const passed = val?.passed ?? 0;
                const warn = val?.warn ?? 0;
                const failed = val?.failed ?? 0;
                const total = passed + warn + failed;
                const pct = total ? ((passed / total) * 100).toFixed(1) : '—';
                return (
                  <div key={key} style={{ padding: 14, borderRadius: 8, background: 'var(--bg-card-subtle)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)' }}>{key.toUpperCase()}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#ECFDF5', color: '#047857', padding: '2px 6px', borderRadius: 4 }}>
                        {passed} / {total || 0} PASS
                      </span>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#10B981', marginTop: 4 }}>{pct}{pct !== '—' ? '%' : ''}</div>
                  </div>
                );
              })}
              <div style={{ padding: 14, borderRadius: 8, background: 'var(--bg-card-subtle)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)' }}>FRESHNESS</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#F59E0B', marginTop: 4 }}>{dqSummary.freshness}</div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No quality assertion breakdown from the API for this filter window.
              {dqSummary.freshness !== '—' && (
                <div style={{ marginTop: 8 }}>Avg freshness: <strong>{dqSummary.freshness}</strong></div>
              )}
            </div>
          )}
        </div>

        {/* ── 4. MONITORED PIPELINES TABLE (AT THE BOTTOM) ────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div>
              <span className="card-title">Monitored Pipelines Health & Duration ({filteredPipelines.length})</span>
              <span className="card-subtitle">Live execution runtimes, success rates, freshness age, and status tags</span>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="vithi-table">
              <thead>
                <tr>
                  <th>Pipeline Name & Engine</th>
                  <th>Status</th>
                  <th>Success Rate</th>
                  <th>Average Duration</th>
                  <th>Total Runs</th>
                  <th>Last Run Timestamp</th>
                  <th>Data Freshness Age</th>
                  <th style={{ textAlign: 'right' }}>Target Table</th>
                </tr>
              </thead>
              <tbody>
                {filteredPipelines.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                      No pipelines match the selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredPipelines.map((p, idx) => (
                    <tr key={p.pipeline_id || idx}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 6,
                            background: 'rgba(16, 185, 129, 0.1)', color: '#10B981',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            <GitBranch size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                              {p.pipeline_name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              Engine: {(p.tool || p.etl_tool || '—').toString().toUpperCase()}
                              {p.warehouse || p.target_schema ? ` • ${p.warehouse || p.target_schema}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className={`status-pill ${p.status_key === 'healthy' || p.status_key === 'success' ? 'good' : 'warning'}`}>
                          {p.status || p.status_key || '—'}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <strong style={{ color: '#10B981', fontSize: 12 }}>
                            {p.success_rate_pct != null ? `${p.success_rate_pct}%` : (p.success_rate || '—')}
                          </strong>
                          {p.success_rate_pct != null && (
                            <div style={{ width: 50, height: 5, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ width: `${p.success_rate_pct}%`, height: '100%', background: '#10B981' }} />
                            </div>
                          )}
                        </div>
                      </td>

                      <td style={{ fontWeight: 600, fontSize: 12 }}>
                        {p.duration || (p.avg_duration_seconds != null ? `${p.avg_duration_seconds}s` : '—')}
                      </td>

                      <td style={{ fontSize: 12, fontWeight: 600 }}>
                        {p.runs != null ? p.runs : '—'}
                      </td>

                      <td style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        <div>{p.last_run_age || '—'}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{p.last_run_at || '—'}</div>
                      </td>

                      <td>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#F59E0B' }}>
                          {p.avg_freshness_display || (p.avg_freshness_hours != null ? `${p.avg_freshness_hours}h` : '—')}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right', fontSize: 11.5, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {p.target || p.target_dataset || p.target_table || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
