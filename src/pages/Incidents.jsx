import { useEffect, useState, useMemo, useCallback } from 'react';
import { AlertTriangle, AlertCircle, Info, Search, Filter, MoreVertical, ArrowUpRight, CheckCircle, Shield } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchIncidents } from '../api/client';

function fmtTime(ts) {
  if (!ts) return 'recently';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [sevFilter, setSevFilter] = useState('All');
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
      if (sevFilter !== 'All') params.severity = sevFilter.toLowerCase();

      const res = await fetchIncidents(params);
      if (res) {
        const incList = res.items || res.incidents || (Array.isArray(res) ? res : []);
        setIncidents(incList);
        if (res.kpis) setKpis(res.kpis);
        if (res.charts) setCharts(res.charts);
      }
    } catch (e) {
      console.error('Failed to load incidents:', e);
    } finally {
      setLoading(false);
    }
  }, [headerDatePreset, customDateRange, sevFilter]);

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

  const kpiMap = useMemo(() => {
    const map = {};
    kpis.forEach(k => { map[k.id] = k; });
    return map;
  }, [kpis]);

  const openCount = kpiMap.open?.value ?? incidents.filter(i => (i.status || i.state || '').toLowerCase() === 'open').length;
  const triageCount = kpiMap.triage?.value ?? incidents.filter(i => (i.status || i.state || '').toLowerCase() === 'triage').length;
  const criticalCount = kpiMap.critical?.value ?? incidents.filter(i => (i.severity || '').toLowerCase() === 'critical').length;
  const resolvedCount = kpiMap.resolved?.value ?? incidents.filter(i => (i.status || i.state || '').toLowerCase() === 'resolved').length;

  const filtered = useMemo(() => {
    return incidents.filter(inc => {
      const title = inc.title ?? inc.pipeline_name ?? '';
      const desc = inc.description ?? inc.error_message ?? '';
      const pName = inc.pipeline_name ?? '';
      const sev = inc.severity ?? 'Critical';

      const matchSearch = !search ||
        title.toLowerCase().includes(search.toLowerCase()) ||
        desc.toLowerCase().includes(search.toLowerCase()) ||
        pName.toLowerCase().includes(search.toLowerCase());

      const matchSev = sevFilter === 'All' || sev.toLowerCase() === sevFilter.toLowerCase();
      return matchSearch && matchSev;
    });
  }, [incidents, search, sevFilter]);

  return (
    <div className="fade-in">
      <PageHeader
        title="Incidents"
        subtitle="Track, triage and resolve active pipeline incidents, SLA breaches and run failures."
        onRefresh={loadData}
        onDateChange={handleHeaderDateChange}
      />

      <div className="page-body">
        {/* 4 KPI Cards */}
        <div className="kpi-grid-4">
          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#FEF2F2', color: '#EF4444' }}>
                <AlertTriangle size={18} />
              </div>
              <span className="kpi-label">Active Open Incidents</span>
            </div>
            <div className="kpi-value" style={{ color: openCount > 0 ? '#EF4444' : '#10B981', marginTop: 4 }}>
              {kpiMap.open?.display || openCount}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {openCount === 0 ? 'No active incidents' : 'Requiring immediate attention'}
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#FFFBEB', color: '#F59E0B' }}>
                <AlertCircle size={18} />
              </div>
              <span className="kpi-label">In Triage</span>
            </div>
            <div className="kpi-value" style={{ color: triageCount > 0 ? '#F59E0B' : '#10B981', marginTop: 4 }}>
              {kpiMap.triage?.display || triageCount}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Investigating root cause
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#FEF2F2', color: '#EF4444' }}>
                <Shield size={18} />
              </div>
              <span className="kpi-label">Critical Severity</span>
            </div>
            <div className="kpi-value" style={{ color: criticalCount > 0 ? '#EF4444' : '#10B981', marginTop: 4 }}>
              {kpiMap.critical?.display || criticalCount}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              High-priority alerts
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                <CheckCircle size={18} />
              </div>
              <span className="kpi-label">Resolved Incidents</span>
            </div>
            <div className="kpi-value" style={{ color: '#10B981', marginTop: 4 }}>
              {kpiMap.resolved?.display || resolvedCount}
            </div>
            <div style={{ fontSize: 11, color: '#10B981', fontWeight: 600, marginTop: 2 }}>
              Auto-mitigated or resolved
            </div>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="filters-bar mt-4">
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search incidents by title, description or pipeline..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-select">
            <label>Severity</label>
            <select
              className="select-control"
              value={sevFilter}
              onChange={e => setSevFilter(e.target.value)}
            >
              <option value="All">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        {/* Incidents Table / List */}
        <div className="card mt-4">
          <div className="card-header">
            <div>
              <span className="card-title">Active Incident Log</span>
              <span className="card-subtitle">Real-time alerts, blast radius analysis, and RCA states</span>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center' }}>
              <CheckCircle size={36} style={{ color: '#10B981', margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>
                All Data Systems Operating Normally
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                There are currently 0 active or critical incidents detected across all monitored pipelines.
              </div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="vithi-table">
                <thead>
                  <tr>
                    <th>Incident</th>
                    <th>Pipeline</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Detected At</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inc, i) => (
                    <tr key={inc.id || i}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{inc.title || 'Pipeline Run Failure'}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{inc.description || inc.error_message}</div>
                      </td>
                      <td><span className="tag">{inc.pipeline_name || 'Pipeline'}</span></td>
                      <td>
                        <span className={`status-pill ${inc.severity === 'Critical' ? 'critical' : 'warning'}`}>
                          {inc.severity || 'Medium'}
                        </span>
                      </td>
                      <td>
                        <span className="status-pill warning">{inc.status || inc.state || 'OPEN'}</span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>
                        {fmtTime(inc.opened_at || inc.start_time)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
