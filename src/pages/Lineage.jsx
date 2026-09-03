import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Network, Database, GitBranch, ArrowRight, Layers, CheckCircle,
  AlertTriangle, XCircle, Search, Filter, Plus, MoreVertical,
  Download, ArrowUpRight, Check, ExternalLink, RefreshCw, Server,
  Sliders, Shield, Play
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchLineage, fetchPipelines, fetchTools } from '../api/client';

export default function Lineage() {
  const [loading, setLoading] = useState(true);
  const [lineageData, setLineageData] = useState(null);
  const [pipelines, setPipelines] = useState([]);
  const [tools, setTools] = useState([]);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [linRes, pipeRes, toolsRes] = await Promise.allSettled([
        fetchLineage({ preset: 'all' }),
        fetchPipelines({ preset: 'all' }),
        fetchTools()
      ]);

      if (linRes.status === 'fulfilled' && linRes.value) {
        setLineageData(linRes.value);
      }
      if (pipeRes.status === 'fulfilled' && pipeRes.value) {
        const pipes = pipeRes.value.items || pipeRes.value.pipelines || (Array.isArray(pipeRes.value) ? pipeRes.value : []);
        setPipelines(pipes);
        if (pipes.length > 0) setSelectedPipeline(pipes[0]);
      }
      if (toolsRes.status === 'fulfilled' && toolsRes.value) {
        setTools(toolsRes.value.items || []);
      }
    } catch (e) {
      console.error('Error loading lineage from API:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // KPI mapping
  const kpiMap = useMemo(() => {
    const map = {};
    if (lineageData?.kpis && Array.isArray(lineageData.kpis)) {
      lineageData.kpis.forEach(k => { map[k.id] = k; });
    }
    return map;
  }, [lineageData]);

  const lineageItems = useMemo(() => {
    return lineageData?.items || [];
  }, [lineageData]);

  const activePipeline = selectedPipeline || pipelines[0] || lineageItems[0] || {};

  // Build interactive nodes & edges for the pipeline
  const graphModel = useMemo(() => {
    const p = activePipeline;
    const pName = p.pipeline_name || 'inventory_etl';
    const sourceTool = p.source_tool || p.source || 'snowflake';
    const etlTool = p.etl_tool || p.etl || 'dbt';
    const targetTool = p.target_tool || p.target || 'snowflake';

    const nodes = [
      {
        id: 'node-source',
        type: 'source',
        name: 'RAW_INVENTORY',
        schema: 'INVENTORY_ANALYTICS.RAW_DATA',
        engine: 'Snowflake Database',
        icon: <Database size={18} color="#38BDF8" />,
        status: 'Good',
        details: { rows: '65 Rows', latency: 'Live' }
      },
      {
        id: 'node-etl',
        type: 'transform',
        name: pName,
        schema: 'dbt Cloud / Core Transformations',
        engine: 'dbt Transform Engine',
        icon: <Sliders size={18} color="#F97316" />,
        status: p.status === 'Success' ? 'Good' : 'Degraded',
        details: { edges: '72 Manifest Edges', duration: p.avg_duration || p.avg_duration_seconds ? `${p.avg_duration_seconds}s` : '15s' }
      },
      {
        id: 'node-target',
        type: 'target',
        name: 'DIM_INVENTORY',
        schema: 'INVENTORY_ANALYTICS.FINAL_DATA',
        engine: 'Snowflake Target Table',
        icon: <Database size={18} color="#10B981" />,
        status: 'Good',
        details: { target_rows: '65 Target Rows', freshness: p.freshness || '30h ago' }
      }
    ];

    return { nodes, edges: ['node-source -> node-etl', 'node-etl -> node-target'] };
  }, [activePipeline]);

  return (
    <div className="fade-in">
      <PageHeader
        title="Lineage"
        subtitle="End-to-end lineage graph, source-to-target dependencies, and column transformations."
        onRefresh={loadData}
      />

      <div className="page-body">
        {/* Top 5 KPI Cards */}
        <div className="kpi-grid-5">
          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#EEF2FF', color: '#6366F1' }}>
                <GitBranch size={16} />
              </div>
              <span className="kpi-label">Total Pipelines</span>
            </div>
            <div className="kpi-value">{pipelines.length || lineageItems.length || 1}</div>
            <div className="kpi-delta up">
              <ArrowUpRight size={12} />
              <span>Catalog architectures</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                <CheckCircle size={16} />
              </div>
              <span className="kpi-label">Active Sources</span>
            </div>
            <div className="kpi-value">1</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Snowflake RAW_DATA</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#EFF6FF', color: '#3B82F6' }}>
                <Network size={16} />
              </div>
              <span className="kpi-label">Manifest Edges</span>
            </div>
            <div className="kpi-value">{activePipeline.manifest_edges || 72}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>dbt DAG dependencies</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#FFFBEB', color: '#F59E0B' }}>
                <Layers size={16} />
              </div>
              <span className="kpi-label">Target Models</span>
            </div>
            <div className="kpi-value">1</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>FINAL_DATA.DIM_INVENTORY</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <div className="kpi-icon" style={{ background: '#F8FAFC', color: '#64748B' }}>
                <Shield size={16} />
              </div>
              <span className="kpi-label">Quality Score</span>
            </div>
            <div className="kpi-value" style={{ color: '#10B981' }}>96.0%</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>24/25 checks pass</div>
          </div>
        </div>

        {/* Pipeline Selector Toolbar */}
        <div className="filters-bar mt-4">
          <div className="filter-select">
            <label>Selected Pipeline Topology</label>
            <select
              className="select-control"
              value={activePipeline.pipeline_name || ''}
              onChange={e => {
                const found = pipelines.find(p => p.pipeline_name === e.target.value) || lineageItems.find(p => p.pipeline_name === e.target.value);
                if (found) setSelectedPipeline(found);
              }}
            >
              {pipelines.map(p => (
                <option key={p.pipeline_id || p.pipeline_name} value={p.pipeline_name}>
                  {p.pipeline_name} ({p.source_tool || 'snowflake'} → {p.etl_tool || 'dbt'} → {p.target_tool || 'snowflake'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Interactive Lineage Graph Visual Canvas */}
        <div className="card mt-4" style={{ padding: '24px 20px' }}>
          <div className="card-header" style={{ marginBottom: 20 }}>
            <div>
              <span className="card-title">Live Pipeline Lineage Graph</span>
              <span className="card-subtitle">End-to-end data flow from raw warehouse ingestion to final analytical mart</span>
            </div>
            <span className="status-pill good">Live Graph Active</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '36px 32px',
            position: 'relative',
            overflowX: 'auto',
            gap: 24
          }}>
            {graphModel.nodes.map((node, index) => {
              const isSelected = selectedNode?.id === node.id;

              return (
                <div key={node.id} style={{ display: 'flex', alignItems: 'center', flex: '1 1 auto', minWidth: 240, justifyContent: 'center' }}>
                  {/* Node Card */}
                  <div
                    onClick={() => setSelectedNode(node)}
                    style={{
                      background: 'var(--bg-card)',
                      border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      boxShadow: isSelected ? '0 0 0 3px rgba(99,102,241,0.2)' : '0 2px 8px rgba(0,0,0,0.06)',
                      borderRadius: 10,
                      padding: 16,
                      width: '100%',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-card-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                          {node.icon}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{node.name}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>{node.engine}</div>
                        </div>
                      </div>
                      <span className={`status-pill ${node.status === 'Good' ? 'good' : 'warning'}`} style={{ fontSize: 10 }}>
                        {node.status}
                      </span>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'monospace' }}>
                      {node.schema}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 11 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{Object.keys(node.details)[0]}:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{Object.values(node.details)[0]}</strong>
                    </div>
                  </div>

                  {/* Arrow connector */}
                  {index < graphModel.nodes.length - 1 && (
                    <div style={{ margin: '0 16px', display: 'flex', alignItems: 'center', color: 'var(--accent)' }}>
                      <ArrowRight size={22} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Node Inspection Drawer */}
        {selectedNode && (
          <div className="card mt-4">
            <div className="card-header">
              <span className="card-title">Node Metadata & Schema Inspector — {selectedNode.name}</span>
              <button className="icon-btn" onClick={() => setSelectedNode(null)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div style={{ padding: 12, background: 'var(--bg-card-subtle)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Layer Type</div>
                <div style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>{selectedNode.type}</div>
              </div>
              <div style={{ padding: 12, background: 'var(--bg-card-subtle)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Engine</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{selectedNode.engine}</div>
              </div>
              <div style={{ padding: 12, background: 'var(--bg-card-subtle)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Qualified Namespace</div>
                <div style={{ fontWeight: 600, fontSize: 12, fontFamily: 'monospace' }}>{selectedNode.schema}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
