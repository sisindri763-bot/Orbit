import { useEffect, useState, useMemo, useCallback } from 'react';
import { Bell, Plus, CheckCircle, AlertTriangle, Shield, Trash2, Tag, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchAlerts } from '../api/client';

const DEFAULT_ALERTS = [
  { id: 1, name: 'SLA Breach Alert', channel: '#data-eng-alerts (Slack)', condition: 'Pipeline freshness lag > 60 min', active: true },
  { id: 2, name: 'Critical Volume Drop', channel: 'PagerDuty', condition: 'Row count drops > 50% vs 7-day average', active: true },
  { id: 3, name: 'Schema Breaking Change', channel: '#data-governance (Slack)', condition: 'Columns dropped or data types altered', active: true },
  { id: 4, name: 'Data Quality Failure', channel: 'email: datateam@vithi.dev', condition: 'Quality check failure rate > 5%', active: false },
];

export default function Alerts() {
  const [alerts, setAlerts] = useState(DEFAULT_ALERTS);
  const [liveKpis, setLiveKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAlertName, setNewAlertName] = useState('');
  const [newAlertChannel, setNewAlertChannel] = useState('#data-alerts (Slack)');
  const [newAlertCondition, setNewAlertCondition] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAlerts();
      if (res && res.kpis) setLiveKpis(res.kpis);
      if (res && res.items && res.items.length > 0) {
        setAlerts(res.items);
      }
    } catch (e) {
      console.error('Failed to load alerts:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleAlert = (id) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  const handleAddAlert = (e) => {
    e.preventDefault();
    if (!newAlertName.trim() || !newAlertCondition.trim()) return;
    const newA = {
      id: Date.now(),
      name: newAlertName.trim(),
      channel: newAlertChannel,
      condition: newAlertCondition.trim(),
      active: true
    };
    setAlerts(prev => [newA, ...prev]);
    setNewAlertName('');
    setNewAlertCondition('');
    setShowAddModal(false);
  };

  const activeCount = alerts.filter(a => a.active).length;

  return (
    <div className="fade-in">
      <PageHeader
        title="Alerts"
        subtitle="Configure and manage pipeline health alerts, incident paging, and notification channels."
        onRefresh={loadData}
      />

      <div className="page-body">
        <div className="kpi-grid-4">
          <div className="kpi-card">
            <div className="kpi-label">Configured Rules</div>
            <div className="kpi-value" style={{ color: '#6366F1', marginTop: 4 }}>{alerts.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Active across platform</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Active Monitors</div>
            <div className="kpi-value" style={{ color: '#10B981', marginTop: 4 }}>{activeCount}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Live triggering enabled</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Alerts Fired (24h)</div>
            <div className="kpi-value" style={{ color: '#10B981', marginTop: 4 }}>0</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Sent to Slack & PagerDuty</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Connected Channels</div>
            <div className="kpi-value" style={{ color: '#3B82F6', marginTop: 4 }}>3</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Slack, PagerDuty, Email</div>
          </div>
        </div>

        <div className="card mt-4">
          <div className="card-header">
            <div>
              <span className="card-title">Alert Notification Rules</span>
              <span className="card-subtitle">Automated webhook & alert dispatch rules</span>
            </div>
            <button className="export-btn" onClick={() => setShowAddModal(true)} style={{ padding: '6px 12px', fontSize: 12 }}>
              <Plus size={13} /> Add Alert Rule
            </button>
          </div>

          <div className="table-wrapper">
            <table className="vithi-table">
              <thead>
                <tr>
                  <th>Alert Name</th>
                  <th>Condition</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Toggle Active</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{a.condition}</td>
                    <td style={{ fontWeight: 500, color: '#6366F1' }}>{a.channel}</td>
                    <td>
                      <span className={`status-pill ${a.active ? 'good' : 'warning'}`}>
                        {a.active ? 'Active' : 'Muted'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div
                        className={`toggle-switch ${a.active ? 'on' : ''}`}
                        onClick={() => toggleAlert(a.id)}
                        style={{ display: 'inline-block', cursor: 'pointer' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Alert Modal */}
        {showAddModal && (
          <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
              <div className="modal-header">
                <span style={{ fontWeight: 600, fontSize: 15 }}>Create Alert Rule</span>
                <button className="icon-btn" onClick={() => setShowAddModal(false)}><X size={16} /></button>
              </div>
              <form onSubmit={handleAddAlert} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="filter-select">
                  <label>Alert Rule Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Critical Freshness SLA Breach"
                    value={newAlertName}
                    onChange={e => setNewAlertName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="filter-select">
                  <label>Trigger Condition</label>
                  <input
                    type="text"
                    placeholder="e.g., Freshness lag > 2 hours or DQ failure > 0"
                    value={newAlertCondition}
                    onChange={e => setNewAlertCondition(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="filter-select">
                  <label>Notification Channel</label>
                  <select
                    value={newAlertChannel}
                    onChange={e => setNewAlertChannel(e.target.value)}
                    className="select-control"
                    style={{ width: '100%' }}
                  >
                    <option value="#data-alerts (Slack)">#data-alerts (Slack)</option>
                    <option value="#data-governance (Slack)">#data-governance (Slack)</option>
                    <option value="PagerDuty">PagerDuty (On-Call High Priority)</option>
                    <option value="email: datateam@vithi.dev">Email Digest</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                  <button type="button" className="export-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="export-btn" style={{ background: 'var(--accent)', color: '#FFFFFF', border: 'none' }}>Create Alert</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
