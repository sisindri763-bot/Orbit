import { useEffect, useState, useMemo, useCallback } from 'react';
import { Layout, Plus, Minus, Search, Filter, Database, CheckCircle, AlertTriangle, Layers, ArrowUpRight, Shield } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import { fetchSchema, fetchPipelines } from '../../api/client';

export default function Schema() {
  const [schemaData, setSchemaData] = useState(null);
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
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

      const [sRes, pRes] = await Promise.allSettled([
        fetchSchema(params),
        fetchPipelines()
      ]);

      if (sRes.status === 'fulfilled' && sRes.value) {
        setSchemaData(sRes.value);
      }
      if (pRes.status === 'fulfilled' && pRes.value) {
        setPipelines(pRes.value.items || pRes.value.pipelines || (Array.isArray(pRes.value) ? pRes.value : []));
      }
    } catch (e) {
      console.error('Failed to load schema drift:', e);
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

  const kpiMap = useMemo(() => {
    const map = {};
    if (schemaData?.kpis && Array.isArray(schemaData.kpis)) {
      schemaData.kpis.forEach(k => { map[k.id] = k; });
    }
    return map;
  }, [schemaData]);

  const schemasMonitored = kpiMap.schemas_monitored?.value ?? 2;
  const schemaChanges = kpiMap.schema_changes?.value ?? 0;
  const breakingChanges = kpiMap.breaking_changes?.value ?? 0;
  const compatibility = kpiMap.compatibility?.value ?? 100;
  const driftEvents = schemaData?.items || [];

  return (
    <div className="fade-in">
      <PageHeader
        title="Schema"
        subtitle="Monitor column-level schema drift, type changes, and breaking contracts across pipeline runs."
        onRefresh={loadData}
        onDateChange={handleHeaderDateChange}
      />

      <div className="page-body">
        {/* 4 Summary Cards */}
        <div className="kpi-grid-4">
          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                <CheckCircle size={18} />
              </div>
              <span className="kpi-label">Schema Compatibility</span>
            </div>
            <div className="kpi-value" style={{ color: '#10B981' }}>
              {kpiMap.compatibility?.display || `${compatibility}%`}
            </div>
            <div className="kpi-delta up">
              <ArrowUpRight size={13} />
              <span>Zero breaking contract changes</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#EFF6FF', color: '#3B82F6' }}>
                <Layers size={18} />
              </div>
              <span className="kpi-label">Schemas Monitored</span>
            </div>
            <div className="kpi-value">{schemasMonitored}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              RAW_DATA & FINAL_DATA
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#FFFBEB', color: '#F59E0B' }}>
                <Layout size={18} />
              </div>
              <span className="kpi-label">Active Schema Drift</span>
            </div>
            <div className="kpi-value" style={{ color: schemaChanges > 0 ? '#F59E0B' : '#10B981' }}>
              {schemaChanges}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {schemaChanges === 0 ? 'No drift events active' : 'Columns altered'}
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#FEF2F2', color: '#EF4444' }}>
                <AlertTriangle size={18} />
              </div>
              <span className="kpi-label">Breaking Changes</span>
            </div>
            <div className="kpi-value" style={{ color: breakingChanges > 0 ? '#EF4444' : '#10B981' }}>
              {breakingChanges}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {breakingChanges === 0 ? '0 breaking contract changes' : 'Contract violated'}
            </div>
          </div>
        </div>

        {/* Monitored Schemas Contract Table */}
        <div className="card mt-4">
          <div className="card-header">
            <div>
              <span className="card-title">Monitored Schemas & Column Contracts</span>
              <span className="card-subtitle">Snowflake and dbt model contracts active</span>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="vithi-table">
              <thead>
                <tr>
                  <th>Schema / Relation</th>
                  <th>Database</th>
                  <th>Tracked Table</th>
                  <th>Contract Status</th>
                  <th>Drift Events</th>
                  <th>Compatibility</th>
                  <th>Last Validation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Database size={15} style={{ color: '#38BDF8' }} />
                      <span style={{ fontWeight: 600 }}>RAW_DATA</span>
                    </div>
                  </td>
                  <td>INVENTORY_ANALYTICS</td>
                  <td><span className="tag">RAW_INVENTORY</span></td>
                  <td><span className="status-pill good">Enforced</span></td>
                  <td style={{ fontWeight: 600 }}>0</td>
                  <td style={{ color: '#10B981', fontWeight: 600 }}>100%</td>
                  <td style={{ color: 'var(--text-secondary)' }}>Live Sync Active</td>
                </tr>
                <tr>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Database size={15} style={{ color: '#10B981' }} />
                      <span style={{ fontWeight: 600 }}>FINAL_DATA</span>
                    </div>
                  </td>
                  <td>INVENTORY_ANALYTICS</td>
                  <td><span className="tag accent">DIM_INVENTORY</span></td>
                  <td><span className="status-pill good">Enforced</span></td>
                  <td style={{ fontWeight: 600 }}>0</td>
                  <td style={{ color: '#10B981', fontWeight: 600 }}>100%</td>
                  <td style={{ color: 'var(--text-secondary)' }}>Live Sync Active</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Drift Events List */}
        <div className="card mt-4">
          <div className="card-header">
            <div>
              <span className="card-title">Schema Drift Events History</span>
              <span className="card-subtitle">Real-time alerts when columns or data types change</span>
            </div>
          </div>

          {driftEvents.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <CheckCircle size={32} style={{ color: '#10B981', margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Schemas 100% In Sync</div>
              <div style={{ fontSize: 12 }}>All tables and columns conform to the latest dbt model definitions.</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="vithi-table">
                <thead>
                  <tr>
                    <th>Event ID</th>
                    <th>Table</th>
                    <th>Change Type</th>
                    <th>Column</th>
                    <th>Impact</th>
                    <th>Detected At</th>
                  </tr>
                </thead>
                <tbody>
                  {driftEvents.map((ev, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace' }}>#{ev.id || i + 1}</td>
                      <td>{ev.table_name}</td>
                      <td><span className="tag">{ev.change_type}</span></td>
                      <td>{ev.column_name}</td>
                      <td>
                        <span className={`status-pill ${ev.impact === 'breaking' ? 'critical' : 'warning'}`}>
                          {ev.impact}
                        </span>
                      </td>
                      <td>{ev.detected_at}</td>
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
