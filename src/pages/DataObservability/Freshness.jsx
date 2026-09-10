import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  CheckCircle, Clock, AlertTriangle, Search, RefreshCw, GitBranch, Info,
} from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import { fetchFreshness, evaluateMonitors } from '../../api/client';
import {
  dash, kpiMapFrom, statusTone, buildDateParams, handleDateChange, lagPct,
} from './obsUtils';

export default function Freshness() {
  const [data, setData] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [headerDatePreset, setHeaderDatePreset] = useState('all');
  const [customDateRange, setCustomDateRange] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildDateParams(headerDatePreset, customDateRange);
      const res = await fetchFreshness(params);
      setData(res?.items || res?.freshness_checks || []);
      setKpis(res?.kpis || []);
      setSummary(res?.summary || null);
      setMeta(res?.meta || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [headerDatePreset, customDateRange]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      await evaluateMonitors();
      await loadData();
    } finally {
      setEvaluating(false);
    }
  };

  const kpi = useMemo(() => kpiMapFrom(kpis), [kpis]);
  const stale = Number(kpi.stale?.value ?? summary?.stale ?? 0);
  const freshPct = summary?.fresh_pct;
  const defaultSla = meta?.sla_hours ?? 24;

  const filtered = useMemo(() => data.filter((d) => {
    const st = String(d.status_key || d.status || '').toLowerCase();
    const hay = [d.pipeline_name, d.source_tool, d.etl_tool, d.target_tool, d.pipeline_id].join(' ').toLowerCase();
    return (!search || hay.includes(search.toLowerCase()))
      && (statusFilter === 'All' || st === statusFilter.toLowerCase());
  }), [data, search, statusFilter]);

  const reasonFor = (item) => {
    if (item.current_lag_hours == null && !item.last_updated_at && !item.run_id) {
      return 'No successful TARGET update timestamp yet';
    }
    if (item.current_lag_hours != null && item.sla_hours) {
      const mult = item.current_lag_hours / item.sla_hours;
      if (mult > 2) return `${mult.toFixed(1)}× over SLA (Stale)`;
      if (mult > 1) return `${mult.toFixed(1)}× over SLA`;
      return 'Within SLA';
    }
    return dash(item.status);
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Freshness"
        subtitle="Did each pipeline update within its allowed time (SLA)?"
        onRefresh={loadData}
        onDateChange={(v) => handleDateChange(setHeaderDatePreset, setCustomDateRange, v)}
      />

      <div className="page-body">
        {loading ? <LoadingSpinner /> : (
          <>
            {stale > 0 ? (
              <div className="obs-alert is-bad">
                <AlertTriangle size={18} />
                <div>
                  <strong>{stale} pipeline{stale === 1 ? '' : 's'} late.</strong>
                  {' '}Average lag is {dash(kpi.avg_lag?.display ?? (summary?.avg_lag_hours != null ? `${Number(summary.avg_lag_hours).toFixed(1)}h` : null))}.
                  {freshPct != null ? ` Only ${freshPct}% are on time.` : ''}
                </div>
              </div>
            ) : (
              <div className="obs-alert is-ok">
                <CheckCircle size={18} />
                <div><strong>On time.</strong> All monitored pipelines are within SLA.</div>
              </div>
            )}

            <div className="obs-insight">
              <Info size={15} />
              <div>
                <strong>How freshness is calculated</strong>
                <span>
                  Lag = now − last successful TARGET update.
                  Fresh ≤ {defaultSla}h SLA · Delayed ≤ {defaultSla * 2}h · otherwise Stale.
                  Default SLA from monitors: {defaultSla}h.
                </span>
              </div>
            </div>

            <div className="filters-bar">
              <div className="search-box">
                <Search size={14} />
                <input
                  placeholder="Search pipeline, tool, or id…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="filter-select">
                <label>Status</label>
                <select className="select-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="All">All</option>
                  <option value="fresh">Fresh (on time)</option>
                  <option value="delayed">Delayed</option>
                  <option value="stale">Stale (late)</option>
                </select>
              </div>
              <button
                type="button"
                className="export-btn"
                style={{ marginLeft: 'auto' }}
                onClick={handleEvaluate}
                disabled={evaluating}
              >
                <RefreshCw size={13} className={evaluating ? 'spin' : ''} />
                {evaluating ? 'Checking…' : 'Re-check now'}
              </button>
            </div>

            <div className="kpi-grid-4 mt-4">
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#ECFDF5', color: '#10B981' }}><CheckCircle size={18} /></div>
                  <span className="kpi-label">On time (Fresh)</span>
                </div>
                <div className="kpi-value" style={{ color: '#10B981' }}>{dash(kpi.fresh?.display ?? kpi.fresh?.value)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {freshPct != null ? `${freshPct}% of monitored` : `${summary?.monitored ?? data.length} monitored`}
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#FFFBEB', color: '#F59E0B' }}><Clock size={18} /></div>
                  <span className="kpi-label">Delayed</span>
                </div>
                <div className="kpi-value">{dash(kpi.delayed?.display ?? kpi.delayed?.value)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#FEF2F2', color: '#EF4444' }}><AlertTriangle size={18} /></div>
                  <span className="kpi-label">Late (Stale)</span>
                </div>
                <div className="kpi-value" style={{ color: stale ? '#EF4444' : '#10B981' }}>
                  {dash(kpi.stale?.display ?? kpi.stale?.value)}
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <div className="kpi-icon" style={{ background: '#EFF6FF', color: '#3B82F6' }}><Clock size={18} /></div>
                  <span className="kpi-label">Average lag</span>
                </div>
                <div className="kpi-value">{dash(kpi.avg_lag?.display)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>vs {defaultSla}h SLA</div>
              </div>
            </div>

            <div className="card mt-4">
              <div className="card-header">
                <div>
                  <span className="card-title">Pipeline update status</span>
                  <span className="card-subtitle">
                    Lag vs SLA. Same pipeline name can appear twice if multiple pipeline IDs exist.
                  </span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{filtered.length} rows</span>
              </div>

              <div className="table-wrapper">
                <table className="vithi-table">
                  <thead>
                    <tr>
                      <th>Pipeline</th>
                      <th>Flow</th>
                      <th>Status</th>
                      <th>SLA</th>
                      <th>Current lag</th>
                      <th>Lag vs SLA</th>
                      <th>Why</th>
                      <th>Last updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                          No freshness data for this filter.
                        </td>
                      </tr>
                    ) : filtered.map((item) => {
                      const tone = statusTone(item.status_key || item.status);
                      const pct = lagPct(item.current_lag_hours, item.sla_hours);
                      const pill = tone === 'good' ? 'good' : tone === 'warn' ? 'warning' : 'critical';
                      const color = tone === 'good' ? '#10B981' : tone === 'warn' ? '#F59E0B' : '#EF4444';
                      return (
                        <tr key={item.pipeline_id || `${item.pipeline_name}-${item.run_id}`}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <GitBranch size={15} style={{ color: 'var(--accent)' }} />
                              <div>
                                <strong>{dash(item.pipeline_name)}</strong>
                                {item.pipeline_id && (
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    ID {String(item.pipeline_id).slice(0, 8)}…
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {dash(item.source_tool)} → {dash(item.etl_tool)} → {dash(item.target_tool)}
                          </td>
                          <td><span className={`status-pill ${pill}`}>{dash(item.status)}</span></td>
                          <td>{item.sla_hours != null ? `${item.sla_hours}h` : '—'}</td>
                          <td style={{ fontWeight: 700, color }}>{dash(item.current_lag_display)}</td>
                          <td style={{ minWidth: 120 }}>
                            {pct == null ? '—' : (
                              <div className="obs-simple-meter">
                                <div className="obs-simple-meter-track">
                                  <div style={{ width: `${Math.min(100, pct)}%`, background: color }} />
                                </div>
                                <span>{pct}%</span>
                              </div>
                            )}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 200 }}>
                            {reasonFor(item)}
                          </td>
                          <td>{dash(item.last_updated_age || item.last_updated_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
