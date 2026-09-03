import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Shield, CheckCircle, AlertTriangle, XCircle, Search, Filter,
  MoreVertical, ArrowUpRight, Database, Play, RefreshCw, ChevronLeft, ChevronRight,
  Clock, Tag, Check, Layers
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import PageHeader from '../../components/PageHeader';
import SparkLine from '../../components/SparkLine';
import LoadingSpinner from '../../components/LoadingSpinner';
import { fetchDataQuality, evaluateDqRules } from '../../api/client';

const TOOLTIP_STYLE = {
  contentStyle: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
  itemStyle: { color: '#0F172A' },
  labelStyle: { color: '#64748B', fontWeight: 600 },
};

function fmtTime(ts) {
  if (!ts) return 'recently';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function DataQuality() {
  const [data, setData] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [charts, setCharts] = useState(null);
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);

  // Filters
  const [pipelineFilter, setPipelineFilter] = useState('All');
  const [dimensionFilter, setDimensionFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
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
      if (dimensionFilter !== 'All') params.dimension = dimensionFilter.toLowerCase();

      const res = await fetchDataQuality(params);
      if (res) {
        const list = res.items || res.checks || (Array.isArray(res) ? res : []);
        setData(list);
        if (res.kpis) setKpis(res.kpis);
        if (res.charts) setCharts(res.charts);
        if (res.series) setSeries(res.series);
      }
    } catch (e) {
      console.error('Failed to load quality checks:', e);
    } finally {
      setLoading(false);
    }
  }, [headerDatePreset, customDateRange, pipelineFilter, dimensionFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEvaluateRules = async () => {
    setEvaluating(true);
    try {
      await evaluateDqRules();
      await loadData();
    } catch (e) {
      console.error('Evaluate DQ rules error:', e);
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

  // Distinct dimensions & pipelines
  const distinctDimensions = useMemo(() => {
    return Array.from(new Set(data.map(d => d.dimension).filter(Boolean)));
  }, [data]);

  const distinctPipelines = useMemo(() => {
    return Array.from(new Set(data.map(d => d.pipeline_name).filter(Boolean)));
  }, [data]);

  // KPIs
  const kpiMap = useMemo(() => {
    const map = {};
    kpis.forEach(k => { map[k.id] = k; });
    return map;
  }, [kpis]);

  const totalChecks = kpiMap.checks_run?.value ?? data.length;
  const passedChecks = kpiMap.passed_checks?.value ?? data.filter(c => (c.status || '').toLowerCase() === 'pass' || (c.status || '').toLowerCase() === 'passed').length;
  const failedChecks = kpiMap.failed_checks?.value ?? data.filter(c => (c.status || '').toLowerCase() === 'fail' || (c.status || '').toLowerCase() === 'failed').length;
  const warnChecks = data.filter(c => (c.status || '').toLowerCase() === 'warn' || (c.status || '').toLowerCase() === 'warning').length;
  const qualityScore = kpiMap.quality_status?.value ?? (totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100);

  // Status breakdown Donut Chart
  const donutData = useMemo(() => {
    const chartStatus = charts?.checks_by_status;
    const p = chartStatus?.passed ?? passedChecks;
    const w = chartStatus?.warning ?? warnChecks;
    const f = chartStatus?.failed ?? failedChecks;
    const tot = p + w + f || 1;

    return [
      { name: 'Passed', value: p, color: '#10B981', pct: `${Math.round((p / tot) * 100)}%` },
      { name: 'Warning', value: w, color: '#F59E0B', pct: `${Math.round((w / tot) * 100)}%` },
      { name: 'Failed', value: f, color: '#EF4444', pct: `${Math.round((f / tot) * 100)}%` },
    ];
  }, [charts, passedChecks, warnChecks, failedChecks]);

  // Dimension Breakdown Bar Chart
  const dimensionData = useMemo(() => {
    if (charts?.by_dimension) {
      return Object.entries(charts.by_dimension).map(([dim, val]) => ({
        dimension: dim.charAt(0).toUpperCase() + dim.slice(1),
        passed: val.passed ?? 0,
        warn: val.warn ?? 0,
        failed: val.failed ?? 0,
        total: (val.passed ?? 0) + (val.warn ?? 0) + (val.failed ?? 0)
      }));
    }
    const map = {};
    data.forEach(d => {
      const dim = d.dimension || 'other';
      if (!map[dim]) map[dim] = { dimension: dim.charAt(0).toUpperCase() + dim.slice(1), passed: 0, warn: 0, failed: 0 };
      const st = (d.status || '').toLowerCase();
      if (st === 'pass' || st === 'passed') map[dim].passed++;
      else if (st === 'warn' || st === 'warning') map[dim].warn++;
      else map[dim].failed++;
    });
    return Object.values(map);
  }, [charts, data]);

  // Filtered checks list
  const filtered = useMemo(() => {
    return data.filter(d => {
      const pName = (d.pipeline_name || '').toLowerCase();
      const testId = (d.test_id || d.check_id || '').toLowerCase();
      const colName = (d.column_name || '').toLowerCase();
      const msg = (d.message || '').toLowerCase();
      const dim = (d.dimension || '').toLowerCase();
      const st = (d.status || '').toLowerCase();

      const matchSearch = !search ||
        pName.includes(search.toLowerCase()) ||
        testId.includes(search.toLowerCase()) ||
        colName.includes(search.toLowerCase()) ||
        msg.includes(search.toLowerCase());

      const matchPipeline = pipelineFilter === 'All' || d.pipeline_name === pipelineFilter;
      const matchDim = dimensionFilter === 'All' || dim === dimensionFilter.toLowerCase();
      const matchStatus = statusFilter === 'All' ||
        (statusFilter === 'Passed' && (st === 'pass' || st === 'passed')) ||
        (statusFilter === 'Warning' && (st === 'warn' || st === 'warning')) ||
        (statusFilter === 'Failed' && (st === 'fail' || st === 'failed'));

      return matchSearch && matchPipeline && matchDim && matchStatus;
    });
  }, [data, search, pipelineFilter, dimensionFilter, statusFilter]);

  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

  return (
    <div className="fade-in">
      <PageHeader
        title="Data Quality"
        subtitle="Validate data integrity across all models with dbt tests and automated checks."
        onRefresh={loadData}
        onDateChange={handleHeaderDateChange}
      />

      <div className="page-body">
        {/* Filters Toolbar */}
        <div className="filters-bar">
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search check ID, column, test name..."
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
            <label>Dimension</label>
            <select
              className="select-control"
              value={dimensionFilter}
              onChange={e => { setDimensionFilter(e.target.value); setPage(1); }}
            >
              <option value="All">All Dimensions</option>
              {distinctDimensions.map(d => (
                <option key={d} value={d}>{d.toUpperCase()}</option>
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
              <option value="Passed">Passed</option>
              <option value="Warning">Warning</option>
              <option value="Failed">Failed</option>
            </select>
          </div>

          <button
            className="export-btn"
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={handleEvaluateRules}
            disabled={evaluating}
          >
            <Play size={13} className={evaluating ? 'spin' : ''} />
            {evaluating ? 'Evaluating...' : 'Run DQ Checks'}
          </button>
        </div>

        {/* 4 KPI Summary Cards */}
        <div className="kpi-grid-4 mt-4">
          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                <Shield size={18} />
              </div>
              <span className="kpi-label">Overall Quality Score</span>
            </div>
            <div className="kpi-value" style={{ color: qualityScore >= 90 ? '#10B981' : qualityScore >= 75 ? '#F59E0B' : '#EF4444' }}>
              {kpiMap.quality_status?.display || `${qualityScore.toFixed(1)}%`}
            </div>
            <div className="kpi-delta up">
              <ArrowUpRight size={13} />
              <span>{passedChecks} of {totalChecks} checks passing</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#EFF6FF', color: '#3B82F6' }}>
                <CheckCircle size={18} />
              </div>
              <span className="kpi-label">Checks Evaluated</span>
            </div>
            <div className="kpi-value">{totalChecks}</div>
            <div className="kpi-delta up">
              <ArrowUpRight size={13} />
              <span>dbt assertions & monitors</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#FFFBEB', color: '#F59E0B' }}>
                <AlertTriangle size={18} />
              </div>
              <span className="kpi-label">Warnings</span>
            </div>
            <div className="kpi-value" style={{ color: warnChecks > 0 ? '#F59E0B' : '#10B981' }}>{warnChecks}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Non-breaking threshold warnings</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#FEF2F2', color: '#EF4444' }}>
                <XCircle size={18} />
              </div>
              <span className="kpi-label">Failed Assertions</span>
            </div>
            <div className="kpi-value" style={{ color: failedChecks > 0 ? '#EF4444' : '#10B981' }}>{failedChecks}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {failedChecks === 0 ? '0 blocking failures' : 'Critical failure'}
            </div>
          </div>
        </div>

        {/* Visual Charts: Donut + Dimension Breakdown */}
        <div className="grid-2 mt-4" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <div>
                <span className="card-title">Checks Status Breakdown</span>
                <span className="card-subtitle">Pass vs Warning vs Failure distribution</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: 180 }}>
              <div style={{ width: 140, height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={65}
                      paddingAngle={3}
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {donutData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{d.name}:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{d.value} ({d.pct})</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <span className="card-title">Quality by Dimension</span>
                <span className="card-subtitle">Uniqueness, Completeness, Validity, Timeliness</span>
              </div>
            </div>
            <div style={{ height: 180, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dimensionData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="dimension" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="passed" fill="#10B981" radius={[3, 3, 0, 0]} stackId="a" name="Passed" />
                  <Bar dataKey="warn" fill="#F59E0B" radius={[3, 3, 0, 0]} stackId="a" name="Warning" />
                  <Bar dataKey="failed" fill="#EF4444" radius={[3, 3, 0, 0]} stackId="a" name="Failed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Data Quality Checks Table */}
        <div className="card mt-4">
          <div className="card-header">
            <div>
              <span className="card-title">Evaluated Quality Checks</span>
              <span className="card-subtitle">Live assertion results from dbt run manifests and monitors</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Showing {filtered.length === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length} checks
            </span>
          </div>

          <div className="table-wrapper">
            <table className="vithi-table">
              <thead>
                <tr>
                  <th>Test ID / Check</th>
                  <th>Pipeline</th>
                  <th>Dimension</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Diagnostic Message</th>
                  <th>Source</th>
                  <th>Checked At</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                      No quality checks match the active filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginated.map((item, idx) => {
                    const st = (item.status || '').toLowerCase();
                    const isPass = st === 'pass' || st === 'passed';
                    const isWarn = st === 'warn' || st === 'warning';
                    const statusClass = isPass ? 'good' : isWarn ? 'warning' : 'critical';

                    return (
                      <tr key={item.check_id || item.test_id || idx}>
                        <td style={{ fontFamily: 'monospace', fontSize: 11.5, color: '#3B82F6', fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.test_id || item.check_id}>
                          {item.test_id ? item.test_id.split('.').slice(-2).join('.') : item.check_id}
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{item.pipeline_name || 'inventory_etl'}</span>
                        </td>
                        <td>
                          <span className="tag">{item.dimension ? item.dimension.toUpperCase() : 'QUALITY'}</span>
                        </td>
                        <td>
                          <span className={`status-pill ${statusClass}`}>
                            {item.status_display || (isPass ? 'Pass' : isWarn ? 'Warning' : 'Fail')}
                          </span>
                        </td>
                        <td>
                          <span className="tag" style={{ textTransform: 'capitalize' }}>
                            {item.severity || 'low'}
                          </span>
                        </td>
                        <td style={{ color: isPass ? 'var(--text-secondary)' : isWarn ? '#F59E0B' : '#EF4444', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.message}>
                          {item.message || (isPass ? 'Passed all assertions' : 'Check alert')}
                        </td>
                        <td>
                          <span className="tool-badge">{item.source || 'dbt'}</span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>
                          {fmtTime(item.checked_at)}
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
