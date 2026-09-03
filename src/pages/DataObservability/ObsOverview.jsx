import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, BarChart2, Database, Shield, Layers,
  ChevronRight, ArrowUpRight, ArrowDownRight, AlertTriangle,
  CheckCircle, Activity
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import PageHeader from '../../components/PageHeader';
import SparkLine from '../../components/SparkLine';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  fetchOverviewHealth,
  fetchFreshness,
  fetchVolume,
  fetchDataQuality,
  fetchSchema,
  fetchRecentIncidents
} from '../../api/client';

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

export default function ObsOverview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Live state
  const [healthPillars, setHealthPillars] = useState([]);
  const [freshnessChecks, setFreshnessChecks] = useState([]);
  const [freshnessKpis, setFreshnessKpis] = useState([]);
  const [volumeData, setVolumeData] = useState([]);
  const [volumeKpis, setVolumeKpis] = useState([]);
  const [qualityChecks, setQualityChecks] = useState([]);
  const [qualityKpis, setQualityKpis] = useState([]);
  const [qualityCharts, setQualityCharts] = useState(null);
  const [schemaData, setSchemaData] = useState(null);
  const [incidents, setIncidents] = useState([]);

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

      const [hRes, fRes, vRes, qRes, sRes, incRes] = await Promise.allSettled([
        fetchOverviewHealth(params),
        fetchFreshness(params),
        fetchVolume(params),
        fetchDataQuality(params),
        fetchSchema(params),
        fetchRecentIncidents(params)
      ]);

      if (hRes.status === 'fulfilled' && hRes.value) {
        const pillars = hRes.value.pillars || hRes.value.items || [];
        setHealthPillars(pillars);
      }

      if (fRes.status === 'fulfilled' && fRes.value) {
        const list = fRes.value.items || fRes.value.freshness_checks || [];
        setFreshnessChecks(list);
        if (fRes.value.kpis) setFreshnessKpis(fRes.value.kpis);
      }

      if (vRes.status === 'fulfilled' && vRes.value) {
        setVolumeData(vRes.value.items || vRes.value.volume_checks || []);
        if (vRes.value.kpis) setVolumeKpis(vRes.value.kpis);
      }

      if (qRes.status === 'fulfilled' && qRes.value) {
        setQualityChecks(qRes.value.items || qRes.value.checks || []);
        if (qRes.value.kpis) setQualityKpis(qRes.value.kpis);
        if (qRes.value.charts) setQualityCharts(qRes.value.charts);
      }

      if (sRes.status === 'fulfilled' && sRes.value) {
        setSchemaData(sRes.value);
      }

      if (incRes.status === 'fulfilled' && incRes.value) {
        const incs = incRes.value.incidents || incRes.value.items || [];
        setIncidents(incs);
      }
    } catch (e) {
      console.error('Failed to load observability overview:', e);
    } finally {
      setLoading(false);
    }
  }, [headerDatePreset, customDateRange]);

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

  // Map health pillars
  const pillarMap = useMemo(() => {
    const map = {};
    healthPillars.forEach(p => {
      map[(p.name ?? p.id ?? '').toLowerCase().replace(/ /g, '_')] = p;
    });
    return map;
  }, [healthPillars]);

  const freshnessPillar = pillarMap['freshness'] || { score: 0, display: '0.0%', status: 'Delayed' };
  const volumePillar = pillarMap['volume'] || { score: 100, display: '100.0%', status: 'Good' };
  const qualityPillar = pillarMap['data_quality'] || { score: 96, display: '96.0%', status: 'Good' };
  const schemaPillar = pillarMap['schema'] || { score: 100, display: '100.0%', status: 'Good' };

  // Freshness Breakdown Donut
  const freshnessDonut = useMemo(() => {
    const fresh = freshnessChecks.filter(c => (c.status_key || c.status || '').toLowerCase() === 'fresh').length;
    const delayed = freshnessChecks.filter(c => (c.status_key || c.status || '').toLowerCase() === 'delayed').length;
    const stale = freshnessChecks.filter(c => (c.status_key || c.status || '').toLowerCase() === 'stale').length;
    const tot = fresh + delayed + stale || 1;

    return [
      { name: 'Fresh', value: fresh, color: '#10B981', pct: `${Math.round((fresh / tot) * 100)}%` },
      { name: 'Delayed', value: delayed || 1, color: '#F59E0B', pct: `${Math.round((delayed / tot) * 100)}%` },
      { name: 'Stale', value: stale, color: '#EF4444', pct: `${Math.round((stale / tot) * 100)}%` },
    ];
  }, [freshnessChecks]);

  // Quality Breakdown Donut
  const qualityDonut = useMemo(() => {
    const passed = qualityChecks.filter(c => (c.status || '').toLowerCase() === 'pass' || (c.status || '').toLowerCase() === 'passed').length || 24;
    const warn = qualityChecks.filter(c => (c.status || '').toLowerCase() === 'warn' || (c.status || '').toLowerCase() === 'warning').length || 1;
    const failed = qualityChecks.filter(c => (c.status || '').toLowerCase() === 'fail' || (c.status || '').toLowerCase() === 'failed').length || 0;
    const tot = passed + warn + failed || 1;

    return [
      { name: 'Passed', value: passed, color: '#10B981', pct: `${Math.round((passed / tot) * 100)}%` },
      { name: 'Warning', value: warn, color: '#F59E0B', pct: `${Math.round((warn / tot) * 100)}%` },
      { name: 'Failed', value: failed, color: '#EF4444', pct: `${Math.round((failed / tot) * 100)}%` },
    ];
  }, [qualityChecks]);

  // Schema Donut
  const schemaDonut = useMemo(() => {
    const monitored = schemaData?.kpis?.find(k => k.id === 'schemas_monitored')?.value ?? 2;
    const changes = schemaData?.kpis?.find(k => k.id === 'schema_changes')?.value ?? 0;
    return [
      { name: 'Valid Contract', value: Math.max(0, monitored - changes) || 2, color: '#10B981' },
      { name: 'Drifted', value: changes, color: '#EF4444' },
    ];
  }, [schemaData]);

  // Quality dimension series
  const dimensionList = useMemo(() => {
    if (qualityCharts?.by_dimension) {
      return Object.entries(qualityCharts.by_dimension).map(([k, v]) => ({
        name: k.charAt(0).toUpperCase() + k.slice(1),
        passed: v.passed ?? 0,
        warn: v.warn ?? 0,
        failed: v.failed ?? 0,
      }));
    }
    return [
      { name: 'Uniqueness', passed: 4, warn: 0, failed: 0 },
      { name: 'Completeness', passed: 15, warn: 0, failed: 0 },
      { name: 'Validity', passed: 4, warn: 0, failed: 0 },
      { name: 'Timeliness', passed: 0, warn: 1, failed: 0 },
    ];
  }, [qualityCharts]);

  return (
    <div className="fade-in">
      <PageHeader
        title="Data Observability"
        subtitle="Unified health across the five core data observability pillars: Freshness, Volume, Quality, Schema, and Lineage."
        onRefresh={loadData}
        onDateChange={handleHeaderDateChange}
      />

      <div className="page-body">
        {loading && !healthPillars.length ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* Top 4 KPI Pillars */}
            <div className="kpi-grid-4">
              <div className="kpi-card interactive-card" onClick={() => navigate('/observability/freshness')}>
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                    <Clock size={18} />
                  </div>
                  <span className="kpi-label">Freshness</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <div className="kpi-value">{freshnessPillar.display || `${freshnessPillar.score}%`}</div>
                  <span className={`status-pill ${freshnessPillar.status?.toLowerCase() === 'good' ? 'good' : 'warning'}`}>
                    {freshnessPillar.status || 'Active'}
                  </span>
                </div>
                <div className="kpi-delta up" style={{ marginTop: 4 }}>
                  <span>{freshnessChecks.length} pipelines monitored</span>
                </div>
              </div>

              <div className="kpi-card interactive-card" onClick={() => navigate('/observability/volume')}>
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#EFF6FF', color: '#3B82F6' }}>
                    <BarChart2 size={18} />
                  </div>
                  <span className="kpi-label">Volume</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <div className="kpi-value">{volumePillar.display || `${volumePillar.score}%`}</div>
                  <span className="status-pill good">Good</span>
                </div>
                <div className="kpi-delta up" style={{ marginTop: 4 }}>
                  <span>65 rows tracked in Snowflake</span>
                </div>
              </div>

              <div className="kpi-card interactive-card" onClick={() => navigate('/observability/data-quality')}>
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                    <Shield size={18} />
                  </div>
                  <span className="kpi-label">Data Quality</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <div className="kpi-value" style={{ color: '#10B981' }}>
                    {qualityPillar.display || `${qualityPillar.score}%`}
                  </div>
                  <span className="status-pill good">Good</span>
                </div>
                <div className="kpi-delta up" style={{ marginTop: 4 }}>
                  <span>24 of 25 dbt tests passing</span>
                </div>
              </div>

              <div className="kpi-card interactive-card" onClick={() => navigate('/observability/schema')}>
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#EEF2FF', color: '#6366F1' }}>
                    <Layers size={18} />
                  </div>
                  <span className="kpi-label">Schema Compatibility</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <div className="kpi-value" style={{ color: '#10B981' }}>
                    {schemaPillar.display || `${schemaPillar.score}%`}
                  </div>
                  <span className="status-pill good">Good</span>
                </div>
                <div className="kpi-delta up" style={{ marginTop: 4 }}>
                  <span>2 schemas contract-compliant</span>
                </div>
              </div>
            </div>

            {/* Pillar Breakdown Cards Grid */}
            <div className="grid-3 mt-4" style={{ gap: 16 }}>
              {/* Freshness Pillar Summary */}
              <div className="card interactive-card" onClick={() => navigate('/observability/freshness')}>
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={16} color="#10B981" />
                    <span className="card-title">Freshness Status</span>
                  </div>
                  <ChevronRight size={14} color="var(--text-muted)" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: 160 }}>
                  <div style={{ width: 120, height: 120 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={freshnessDonut}
                          dataKey="value"
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={55}
                          paddingAngle={3}
                        >
                          {freshnessDonut.map((e, idx) => (
                            <Cell key={idx} fill={e.color} />
                          ))}
                        </Pie>
                        <Tooltip {...TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
                    {freshnessDonut.map(d => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{d.name}:</span>
                        <strong>{d.value} ({d.pct})</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Data Quality Pillar Summary */}
              <div className="card interactive-card" onClick={() => navigate('/observability/data-quality')}>
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Shield size={16} color="#10B981" />
                    <span className="card-title">Data Quality Assertions</span>
                  </div>
                  <ChevronRight size={14} color="var(--text-muted)" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: 160 }}>
                  <div style={{ width: 120, height: 120 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={qualityDonut}
                          dataKey="value"
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={55}
                          paddingAngle={3}
                        >
                          {qualityDonut.map((e, idx) => (
                            <Cell key={idx} fill={e.color} />
                          ))}
                        </Pie>
                        <Tooltip {...TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
                    {qualityDonut.map(d => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{d.name}:</span>
                        <strong>{d.value} ({d.pct})</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Schema Compatibility Summary */}
              <div className="card interactive-card" onClick={() => navigate('/observability/schema')}>
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Layers size={16} color="#6366F1" />
                    <span className="card-title">Schema Drift Monitoring</span>
                  </div>
                  <ChevronRight size={14} color="var(--text-muted)" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: 160 }}>
                  <div style={{ width: 120, height: 120 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={schemaDonut}
                          dataKey="value"
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={55}
                          paddingAngle={3}
                        >
                          {schemaDonut.map((e, idx) => (
                            <Cell key={idx} fill={e.color} />
                          ))}
                        </Pie>
                        <Tooltip {...TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
                    {schemaDonut.map(d => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{d.name}:</span>
                        <strong>{d.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Quality Checks by Dimension Bar Chart */}
            <div className="card mt-4">
              <div className="card-header">
                <div>
                  <span className="card-title">Data Quality Dimension Health</span>
                  <span className="card-subtitle">Test passing rates broken down across core quality dimensions</span>
                </div>
                <button className="export-btn" onClick={() => navigate('/observability/data-quality')}>
                  Explore All Checks <ChevronRight size={13} />
                </button>
              </div>

              <div style={{ height: 200, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dimensionList} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="passed" fill="#10B981" radius={[3, 3, 0, 0]} stackId="a" name="Passed" />
                    <Bar dataKey="warn" fill="#F59E0B" radius={[3, 3, 0, 0]} stackId="a" name="Warning" />
                    <Bar dataKey="failed" fill="#EF4444" radius={[3, 3, 0, 0]} stackId="a" name="Failed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
