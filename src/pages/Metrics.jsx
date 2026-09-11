import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  XCircle, CheckCircle, Search, AlertTriangle, GitBranch,
  ChevronLeft, ChevronRight, ArrowUpRight,
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  fetchMetrics,
  fetchFilters,
  fetchOverviewCharts,
  fetchOverviewHealth,
  fetchFreshness,
  fetchVolume,
  fetchDataQuality,
  fetchIncidents,
  fetchSchema,
} from '../api/client';
import {
  dash, kpiMapFrom, buildDateParams, handleDateChange,
  formatSeriesTick, TOOLTIP_STYLE,
} from './DataObservability/obsUtils';

/**
 * Metrics wall — Datadog-style multi-widget dashboard.
 *
 * Sources (all live, parallel):
 *  - GET /api/v1/metrics
 *  - GET /api/v1/overview/charts
 *  - GET /api/v1/overview/health
 *  - GET /api/v1/observability/freshness
 *  - GET /api/v1/observability/volume
 *  - GET /api/v1/observability/quality
 *  - GET /api/v1/observability/schema
 *  - GET /api/v1/incidents
 *
 * Charts share syncId so hover lines track together (Datadog crosshair pattern).
 */

const SYNC = 'orbit-metrics-wall';

const STATUS_COLORS = {
  success: '#10B981',
  failed: '#EF4444',
  running: '#F59E0B',
  cancelled: '#94A3B8',
};

function asList(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function displayKpi(kpi, fallback) {
  if (kpi && kpi.available !== false && kpi.display != null && kpi.display !== '') {
    return kpi.display;
  }
  if (fallback != null && fallback !== '') return fallback;
  return '—';
}

function statusPillClass(statusKey, status) {
  const s = String(statusKey || status || '').toLowerCase();
  if (['healthy', 'success', 'good', 'ok', 'fresh'].includes(s)) return 'good';
  if (['failed', 'error', 'critical', 'stale'].includes(s)) return 'critical';
  if (['degraded', 'warning', 'warn', 'delayed'].includes(s)) return 'warning';
  return 'info';
}

function healthTone(status) {
  const s = String(status || '').toLowerCase();
  if (['good', 'healthy', 'ok'].includes(s)) return 'is-ok';
  if (['warning', 'warn', 'degraded'].includes(s)) return 'is-warn';
  if (['critical', 'bad', 'stale', 'poor'].includes(s)) return 'is-bad';
  return '';
}

function zipLabeled(labels, seriesObj) {
  const labs = asList(labels);
  if (!labs.length) return [];
  const keys = Object.keys(seriesObj || {}).filter((k) => Array.isArray(seriesObj[k]));
  return labs.map((lab, i) => {
    const row = { time: formatSeriesTick(lab), raw: lab };
    keys.forEach((k) => {
      row[k] = Number(seriesObj[k]?.[i]) || 0;
    });
    return row;
  });
}

function Widget({ title, subtitle, children, height = 220, link }) {
  return (
    <div className="met-widget">
      <div className="met-widget-head">
        <div>
          <div className="met-widget-title">{title}</div>
          {subtitle ? <div className="met-widget-sub">{subtitle}</div> : null}
        </div>
        {link}
      </div>
      <div className="met-widget-body" style={{ height }}>
        {children}
      </div>
    </div>
  );
}

function ChartEmpty({ text }) {
  return <div className="obs-simple-empty" style={{ height: '100%' }}>{text}</div>;
}

export default function Metrics() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [charts, setCharts] = useState(null);
  const [health, setHealth] = useState(null);
  const [freshness, setFreshness] = useState(null);
  const [volume, setVolume] = useState(null);
  const [quality, setQuality] = useState(null);
  const [schema, setSchema] = useState(null);
  const [incidents, setIncidents] = useState(null);

  const [pipelineOptions, setPipelineOptions] = useState([]);
  const [toolOptions, setToolOptions] = useState([]);
  const [search, setSearch] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('All');
  const [toolFilter, setToolFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [headerDatePreset, setHeaderDatePreset] = useState('all');
  const [customDateRange, setCustomDateRange] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchFilters()
      .then((res) => {
        if (!alive || !res) return;
        const pipes = asList(res.pipelines || res.items);
        const seen = new Set();
        setPipelineOptions(pipes.filter((p) => {
          if (!p?.pipeline_id || seen.has(p.pipeline_id)) return false;
          seen.add(p.pipeline_id);
          return true;
        }));
        setToolOptions(asList(res.tools));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const sharedParams = useCallback(() => {
    const params = { ...buildDateParams(headerDatePreset, customDateRange) };
    if (pipelineFilter !== 'All') {
      const pipe = pipelineOptions.find((p) => p.pipeline_id === pipelineFilter);
      if (pipe?.pipeline_name) params.pipeline_name = pipe.pipeline_name;
      params.pipeline_id = pipelineFilter;
    }
    if (toolFilter !== 'All') params.tool = toolFilter;
    return params;
  }, [headerDatePreset, customDateRange, pipelineFilter, toolFilter, pipelineOptions]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const params = sharedParams();
    const metricParams = { ...params, page, page_size: 20 };

    const settled = await Promise.allSettled([
      fetchMetrics(metricParams),
      fetchOverviewCharts(params),
      fetchOverviewHealth(params),
      fetchFreshness(params),
      fetchVolume(params),
      fetchDataQuality(params),
      fetchSchema(params),
      fetchIncidents({ ...params, page: 1, page_size: 5 }),
    ]);

    const val = (i) => (settled[i].status === 'fulfilled' ? settled[i].value : null);
    const failed = settled.filter((s) => s.status === 'rejected');

    setMetrics(val(0));
    setCharts(val(1));
    setHealth(val(2));
    setFreshness(val(3));
    setVolume(val(4));
    setQuality(val(5));
    setSchema(val(6));
    setIncidents(val(7));

    if (failed.length === settled.length) {
      setLoadError(failed[0]?.reason?.message || 'Failed to load metrics');
    }
    setLoading(false);
  }, [sharedParams, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const kpiMap = useMemo(() => kpiMapFrom(metrics?.kpis), [metrics]);
  const summary = metrics?.summary || {};
  const healthItems = useMemo(
    () => asList(health?.items || health?.health).filter((h) => h?.available !== false),
    [health],
  );

  const pipelineItems = useMemo(() => {
    const list = asList(metrics?.items);
    return list.length ? list : asList(metrics?.charts?.top_by_duration);
  }, [metrics]);

  const statusOptions = useMemo(() => {
    const set = new Set();
    pipelineItems.forEach((p) => {
      const key = p.status_key || p.status;
      if (key) set.add(String(key));
    });
    return Array.from(set).sort();
  }, [pipelineItems]);

  const filteredPipelines = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pipelineItems.filter((p) => {
      const st = String(p.status_key || p.status || '').toLowerCase();
      if (statusFilter !== 'All' && st !== statusFilter.toLowerCase()) return false;
      if (!q) return true;
      const hay = [p.pipeline_name, p.tool, p.status, p.status_key]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [pipelineItems, search, statusFilter]);

  const overviewCharts = charts?.charts || {};
  const overviewLabels = asList(overviewCharts.labels);

  const runsTrend = useMemo(() => {
    const rot = overviewCharts.runs_over_time || charts?.series?.runs_over_time || {};
    return zipLabeled(overviewLabels, {
      Success: rot.success,
      Failed: rot.failed,
      Running: rot.running,
      Cancelled: rot.cancelled,
    });
  }, [overviewCharts, charts, overviewLabels]);

  const successTrend = useMemo(() => {
    const rates = asList(
      overviewCharts.success_rate_over_time
      ?? charts?.series?.success_rate_over_time,
    );
    if (overviewLabels.length && rates.length) {
      return overviewLabels.map((lab, i) => ({
        time: formatSeriesTick(lab),
        rate: Number(rates[i]) || 0,
      }));
    }
    return asList(metrics?.series?.success_rate_over_time).map((d) => ({
      time: formatSeriesTick(d.timestamp || d.time),
      rate: Number(d.success_rate_pct ?? d.value) || 0,
    })).filter((d) => d.time);
  }, [overviewCharts, charts, overviewLabels, metrics]);

  const incidentTrend = useMemo(() => {
    const src = overviewCharts.incidents_over_time
      || charts?.series?.incidents_over_time
      || incidents?.series?.incidents_over_time
      || {};
    const labels = asList(src.labels?.length ? src.labels : overviewLabels);
    return zipLabeled(labels, {
      Open: src.open,
      Resolved: src.resolved,
      Failed: src.failed_runs,
      Success: src.success_runs,
    });
  }, [overviewCharts, charts, incidents, overviewLabels]);

  const volumeTrend = useMemo(() => (
    asList(volume?.series?.volume_over_time).map((d) => ({
      time: formatSeriesTick(d.timestamp || d.date || d.time),
      records: Number(d.records) || 0,
      bytes: Number(d.bytes) || 0,
    })).filter((d) => d.time)
  ), [volume]);

  const qualityTrend = useMemo(() => (
    asList(quality?.series?.quality_score_over_time).map((d) => ({
      time: formatSeriesTick(d.date || d.timestamp || d.time),
      score: Number(d.quality_score ?? d.score ?? d.value) || 0,
      passed: Number(d.passed) || 0,
      warn: Number(d.warn) || 0,
      failed: Number(d.failed) || 0,
    })).filter((d) => d.time)
  ), [quality]);

  const freshnessBars = useMemo(() => (
    asList(freshness?.items).map((r) => ({
      name: r.pipeline_name || '—',
      lag: Number(r.current_lag_hours) || 0,
      status: r.status || r.status_key,
      display: r.current_lag_display || (r.current_lag_hours != null ? `${r.current_lag_hours}h` : '—'),
    }))
  ), [freshness]);

  const volumeByPipeline = useMemo(() => (
    asList(volume?.charts?.by_pipeline).map((r) => ({
      name: r.pipeline_name || '—',
      records: Number(r.records) || 0,
      share: Number(r.share_pct) || 0,
    }))
  ), [volume]);

  const qualityDims = useMemo(() => {
    const dims = quality?.charts?.by_dimension || {};
    return Object.keys(dims).map((key) => {
      const d = dims[key] || {};
      return {
        name: key,
        passed: Number(d.passed) || 0,
        warn: Number(d.warn) || 0,
        failed: Number(d.failed) || 0,
      };
    });
  }, [quality]);

  const runStatus = useMemo(() => {
    const raw = metrics?.charts?.runs_by_status || {};
    const rows = [
      { key: 'success', name: 'Success', value: Number(raw.success ?? summary.success_runs) || 0 },
      { key: 'failed', name: 'Failed', value: Number(raw.failed ?? summary.failed_runs) || 0 },
      { key: 'running', name: 'Running', value: Number(raw.running) || 0 },
      { key: 'cancelled', name: 'Cancelled', value: Number(raw.cancelled) || 0 },
    ].map((r) => ({ ...r, color: STATUS_COLORS[r.key] }));
    return { rows, total: rows.reduce((a, r) => a + r.value, 0) };
  }, [metrics, summary]);

  const topList = useMemo(() => {
    const rows = asList(metrics?.charts?.top_by_duration);
    const mapped = (rows.length ? rows : filteredPipelines).map((p) => ({
      name: p.pipeline_name || '—',
      seconds: Number(p.avg_duration_seconds) || 0,
      display: p.duration || (p.avg_duration_seconds != null ? `${p.avg_duration_seconds}s` : '—'),
      rate: p.success_rate_pct,
      status: p.status || p.status_key,
    }));
    const max = Math.max(...mapped.map((r) => r.seconds), 1);
    return mapped
      .sort((a, b) => b.seconds - a.seconds)
      .map((r) => ({ ...r, pct: Math.round((r.seconds / max) * 100) }));
  }, [metrics, filteredPipelines]);

  const durationBars = useMemo(() => {
    const fromSeries = asList(metrics?.series?.duration).map((d) => ({
      name: d.pipeline_name || formatSeriesTick(d.timestamp),
      seconds: Number(d.duration_seconds) || 0,
    }));
    if (fromSeries.length) return fromSeries;
    return topList.map((r) => ({ name: r.name, seconds: r.seconds }));
  }, [metrics, topList]);

  const freshnessKpis = useMemo(() => kpiMapFrom(freshness?.kpis), [freshness]);
  const qualityKpis = useMemo(() => kpiMapFrom(quality?.kpis), [quality]);
  const volumeKpis = useMemo(() => kpiMapFrom(volume?.kpis), [volume]);
  const schemaKpis = useMemo(() => kpiMapFrom(schema?.kpis), [schema]);

  const rail = useMemo(() => ([
    { label: 'Success', value: displayKpi(kpiMap.success_rate, summary.success_rate_pct != null ? `${summary.success_rate_pct}%` : null), tone: Number(kpiMap.success_rate?.value ?? summary.success_rate_pct) >= 99 ? 'is-ok' : 'is-warn' },
    { label: 'Failed', value: displayKpi(kpiMap.failed_runs, summary.failed_runs != null ? String(summary.failed_runs) : null), tone: Number(kpiMap.failed_runs?.value ?? summary.failed_runs) > 0 ? 'is-bad' : 'is-ok' },
    { label: 'Runs', value: displayKpi(kpiMap.runs, summary.total_runs != null ? String(summary.total_runs) : null), tone: '' },
    { label: 'Duration', value: displayKpi(kpiMap.avg_duration), tone: '' },
    { label: 'Lag', value: displayKpi(freshnessKpis.avg_lag, displayKpi(kpiMap.avg_freshness)), tone: Number(freshnessKpis.avg_lag?.value ?? kpiMap.avg_freshness?.value) > 24 ? 'is-bad' : 'is-ok' },
    { label: 'Stale', value: displayKpi(freshnessKpis.stale), tone: Number(freshnessKpis.stale?.value) > 0 ? 'is-bad' : 'is-ok' },
    { label: 'Quality', value: displayKpi(qualityKpis.quality_status, healthItems.find((h) => h.id === 'data_quality')?.display), tone: Number(qualityKpis.quality_status?.value) >= 90 ? 'is-ok' : 'is-warn' },
    { label: 'Volume', value: displayKpi(volumeKpis.records_received, displayKpi(volumeKpis.data_received)), tone: '' },
    { label: 'Schema', value: displayKpi(schemaKpis.compatibility, healthItems.find((h) => h.id === 'schema')?.display), tone: Number(schemaKpis.compatibility?.value) >= 100 ? 'is-ok' : '' },
  ]), [kpiMap, summary, freshnessKpis, qualityKpis, volumeKpis, schemaKpis, healthItems]);

  const failedRuns = Number(kpiMap.failed_runs?.value ?? summary.failed_runs ?? 0);
  const degradedCount = pipelineItems.filter((p) => String(p.status_key || '').toLowerCase() === 'degraded').length;
  const staleCount = Number(freshnessKpis.stale?.value) || freshnessBars.filter((r) => String(r.status).toLowerCase() === 'stale').length;
  const pagination = metrics?.pagination || { page: 1, page_size: 20, total: 0 };
  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / (pagination.page_size || 20)));
  const showPager = (pagination.total || 0) > (pagination.page_size || 20);
  const grain = overviewCharts.bucket_grain || 'day';

  const filtersActive =
    Boolean(search.trim()) ||
    pipelineFilter !== 'All' ||
    toolFilter !== 'All' ||
    statusFilter !== 'All';

  const clearFilters = () => {
    setSearch('');
    setPipelineFilter('All');
    setToolFilter('All');
    setStatusFilter('All');
    setPage(1);
  };

  const lastQuality = qualityTrend.length ? qualityTrend[qualityTrend.length - 1] : null;

  if (loading && !metrics && !charts) {
    return (
      <div className="fade-in">
        <PageHeader title="Metrics" subtitle="Cross-pipeline reliability wall." />
        <div className="page-body"><LoadingSpinner /></div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <PageHeader
        title="Metrics"
        subtitle="Live telemetry wall — runs, success, freshness, volume, quality, incidents."
        onRefresh={loadData}
        datePreset={headerDatePreset}
        onDateChange={(v) => {
          handleDateChange(setHeaderDatePreset, setCustomDateRange, v);
          setPage(1);
        }}
        latestTimestamp={metrics?.generated_at || charts?.generated_at}
      />

      <div className="page-body">
        {loadError ? (
          <div className="obs-alert is-bad">
            <AlertTriangle size={18} />
            <div><strong>Could not load metrics.</strong> {loadError}</div>
          </div>
        ) : failedRuns > 0 ? (
          <div className="obs-alert is-bad">
            <XCircle size={18} />
            <div><strong>{failedRuns} failed run{failedRuns === 1 ? '' : 's'}.</strong></div>
          </div>
        ) : degradedCount > 0 || staleCount > 0 ? (
          <div className="obs-alert is-warn">
            <AlertTriangle size={18} />
            <div>
              <strong>
                {degradedCount > 0 ? `${degradedCount} degraded pipeline${degradedCount === 1 ? '' : 's'}.` : ''}
                {degradedCount > 0 && staleCount > 0 ? ' ' : ''}
                {staleCount > 0 ? `${staleCount} stale dataset${staleCount === 1 ? '' : 's'}.` : ''}
              </strong>
              {' '}Avg lag {displayKpi(freshnessKpis.avg_lag, displayKpi(kpiMap.avg_freshness))}.
            </div>
          </div>
        ) : (
          <div className="obs-alert is-ok">
            <CheckCircle size={18} />
            <div><strong>All clear.</strong> Success {displayKpi(kpiMap.success_rate)}.</div>
          </div>
        )}

        <div className="filters-bar">
          <div className="search-box">
            <Search size={14} />
            <input placeholder="Search pipeline…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="filter-select">
            <label>Pipeline</label>
            <select className="select-control" value={pipelineFilter} onChange={(e) => { setPipelineFilter(e.target.value); setPage(1); }}>
              <option value="All">All</option>
              {pipelineOptions.map((p) => (
                <option key={p.pipeline_id} value={p.pipeline_id}>{p.pipeline_name || p.pipeline_id}</option>
              ))}
            </select>
          </div>
          <div className="filter-select">
            <label>Tool</label>
            <select className="select-control" value={toolFilter} onChange={(e) => { setToolFilter(e.target.value); setPage(1); }}>
              <option value="All">All</option>
              {toolOptions.map((t) => (
                <option key={t.id || t} value={t.id || t}>{t.label || t.id || t}</option>
              ))}
            </select>
          </div>
          <div className="filter-select">
            <label>Status</label>
            <select className="select-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {filtersActive && (
            <button type="button" className="met-clear-btn" onClick={clearFilters}>Clear filters</button>
          )}
        </div>

        <div className="met-rail">
          {rail.map((m) => (
            <div key={m.label} className={`met-rail-item ${m.tone}`}>
              <span>{m.label}</span>
              <strong>{m.value}</strong>
            </div>
          ))}
        </div>

        {healthItems.length > 0 && (
          <>
            <div className="met-row-label mt-4">Pillar health</div>
            <div className="met-pillar-row">
              {healthItems.map((h) => (
                <div key={h.id} className={`met-pillar ${healthTone(h.status)}`}>
                  <span>{h.name}</span>
                  <strong>{h.display ?? (h.score != null ? `${h.score}%` : '—')}</strong>
                  <em>{h.status || '—'}</em>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="met-row-label mt-4">Time series</div>
        <div className="met-wall-grid">
          <Widget title="Runs over time" subtitle={`Grain: ${grain} · overview/charts`}>
            {runsTrend.length === 0 ? (
              <ChartEmpty text="No run series in this window" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={runsTrend} syncId={SYNC} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="Success" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.55} strokeWidth={1.5} />
                  <Area type="monotone" dataKey="Failed" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.65} strokeWidth={1.5} />
                  <Area type="monotone" dataKey="Running" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.5} strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Widget>

          <Widget
            title="Success rate"
            subtitle="overview/charts"
            link={lastQuality ? null : undefined}
          >
            {successTrend.length === 0 ? (
              <ChartEmpty text="No success-rate series" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={successTrend} syncId={SYNC} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} unit="%" width={36} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="rate" name="Success %" stroke="#3B82F6" fill="url(#gRate)" strokeWidth={2} dot={{ r: 3, fill: '#3B82F6' }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Widget>

          <Widget
            title="Quality score"
            subtitle="observability/quality"
            link={lastQuality ? <span className="met-end-badge">{lastQuality.score.toFixed(1)}%</span> : null}
          >
            {qualityTrend.length === 0 ? (
              <ChartEmpty text="No quality series" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={qualityTrend} syncId={SYNC} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gQual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} unit="%" width={36} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="score" name="Quality %" stroke="#6366F1" fill="url(#gQual)" strokeWidth={2} dot={{ r: 3, fill: '#6366F1' }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Widget>

          <Widget title="Volume over time" subtitle="observability/volume">
            {volumeTrend.length === 0 ? (
              <ChartEmpty text="No volume series" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeTrend} syncId={SYNC} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gVol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="records" name="Records" stroke="#0EA5E9" fill="url(#gVol)" strokeWidth={2} dot={{ r: 3, fill: '#0EA5E9' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Widget>

          <Widget title="Incidents / runs" subtitle="overview + incidents">
            {incidentTrend.length === 0 ? (
              <ChartEmpty text="No incident series" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={incidentTrend} syncId={SYNC} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="Open" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Resolved" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Failed" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Widget>

          <Widget title="Latency by pipeline" subtitle="metrics duration">
            {durationBars.length === 0 ? (
              <ChartEmpty text="No duration observations" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={durationBars} margin={{ top: 8, right: 8, left: 0, bottom: 8 }} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} unit="s" width={36} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="seconds" name="Duration (s)" fill="#3B82F6" radius={[6, 6, 0, 0]} maxBarSize={64} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Widget>
        </div>

        <div className="met-row-label mt-4">Breakdowns</div>
        <div className="met-wall-grid met-wall-grid-3">
          <Widget title="Freshness lag" subtitle="observability/freshness" height={200}>
            {freshnessBars.length === 0 ? (
              <ChartEmpty text="No freshness rows" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={freshnessBars} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} unit="h" axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="lag" name="Lag (h)" radius={[0, 6, 6, 0]} maxBarSize={22}>
                    {freshnessBars.map((row) => (
                      <Cell key={row.name} fill={row.lag > 72 ? '#EF4444' : row.lag > 24 ? '#F59E0B' : '#10B981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Widget>

          <Widget title="Volume by pipeline" subtitle="observability/volume" height={200}>
            {volumeByPipeline.length === 0 ? (
              <ChartEmpty text="No volume breakdown" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeByPipeline} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="records" name="Records" fill="#0EA5E9" radius={[6, 6, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Widget>

          <Widget title="Quality by dimension" subtitle="observability/quality" height={200}>
            {qualityDims.length === 0 ? (
              <ChartEmpty text="No quality dimensions" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={qualityDims} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="passed" stackId="q" fill="#10B981" />
                  <Bar dataKey="warn" stackId="q" fill="#F59E0B" />
                  <Bar dataKey="failed" stackId="q" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Widget>

          <Widget title="Run outcomes" subtitle="metrics" height={180}>
            {runStatus.total === 0 ? (
              <ChartEmpty text="No run outcomes" />
            ) : (
              <div className="met-dist" style={{ paddingTop: 12 }}>
                <div className="met-dist-bar">
                  {runStatus.rows.filter((r) => r.value > 0).map((r) => (
                    <div key={r.key} style={{ width: `${(r.value / runStatus.total) * 100}%`, background: r.color }} title={`${r.name}: ${r.value}`} />
                  ))}
                </div>
                <div className="met-dist-legend">
                  {runStatus.rows.map((r) => (
                    <div key={r.key}>
                      <i style={{ background: r.color }} />
                      <span>{r.name}</span>
                      <strong>{r.value}{runStatus.total ? ` · ${Math.round((r.value / runStatus.total) * 100)}%` : ''}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Widget>

          <Widget title="Top by duration" subtitle="metrics" height={180}>
            {topList.length === 0 ? (
              <ChartEmpty text="No pipelines" />
            ) : (
              <div className="met-toplist">
                {topList.map((row, i) => (
                  <div key={`${row.name}-${i}`} className="met-toplist-row">
                    <span className="met-toplist-rank">{i + 1}</span>
                    <div className="met-toplist-main">
                      <div className="met-toplist-name">
                        <strong>{row.name}</strong>
                        <span>{row.status || '—'}</span>
                      </div>
                      <div className="met-toplist-track"><div style={{ width: `${row.pct}%` }} /></div>
                    </div>
                    <div className="met-toplist-val">
                      <strong>{row.display}</strong>
                      <span>{Number.isFinite(Number(row.rate)) ? `${row.rate}%` : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Widget>
        </div>

        <div className="met-row-label mt-4">Pipelines</div>
        <div className="card">
          <div className="card-header">
            <div>
              <span className="card-title">Pipeline metrics</span>
              <span className="card-subtitle">
                {filteredPipelines.length} shown · {pagination.total ?? pipelineItems.length} total
                {loading ? ' · refreshing…' : ''}
              </span>
            </div>
            <div className="met-table-actions">
              <Link className="met-related-link" to="/pipelines">View pipelines <ArrowUpRight size={13} /></Link>
              <Link className="met-related-link" to="/observability/freshness">View freshness <ArrowUpRight size={13} /></Link>
              {showPager && (
                <div className="met-pager">
                  <button type="button" className="met-pager-btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft size={14} />
                  </button>
                  <span>{page}/{totalPages}</span>
                  <button type="button" className="met-pager-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {filteredPipelines.length === 0 ? (
            <div className="obs-simple-empty" style={{ padding: 40 }}>
              No pipeline metrics for this window.
              {filtersActive && (
                <button type="button" className="export-btn" style={{ marginTop: 12 }} onClick={clearFilters}>Clear filters</button>
              )}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="vithi-table">
                <thead>
                  <tr>
                    <th>Pipeline</th>
                    <th>Status</th>
                    <th>Success</th>
                    <th>Duration</th>
                    <th>Runs</th>
                    <th>Last run</th>
                    <th>Freshness</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPipelines.map((p, idx) => {
                    const rate = Number(p.success_rate_pct);
                    return (
                      <tr key={p.pipeline_id || idx}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <GitBranch size={14} color="#059669" />
                            <div>
                              <div style={{ fontWeight: 600 }}>{dash(p.pipeline_name)}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dash(p.tool)}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill ${statusPillClass(p.status_key, p.status)}`}>
                            {p.status || p.status_key || '—'}
                          </span>
                        </td>
                        <td>
                          <strong style={{
                            color: !Number.isFinite(rate) ? 'var(--text-muted)'
                              : rate >= 99 ? '#10B981' : rate >= 90 ? '#F59E0B' : '#EF4444',
                          }}>
                            {Number.isFinite(rate) ? `${rate}%` : '—'}
                          </strong>
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {p.duration || (p.avg_duration_seconds != null ? `${p.avg_duration_seconds}s` : '—')}
                        </td>
                        <td>{p.runs ?? '—'}</td>
                        <td style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          <div>{p.last_run_age || '—'}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{p.last_run_at || ''}</div>
                        </td>
                        <td style={{ fontWeight: 600, color: Number(p.avg_freshness_hours) > 24 ? '#F59E0B' : undefined }}>
                          {p.avg_freshness_display || (p.avg_freshness_hours != null ? `${p.avg_freshness_hours}h` : '—')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
