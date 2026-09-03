import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Layers, CheckCircle2, AlertTriangle, Shield,
  Database, GitBranch, ArrowRight, Table, Key, Maximize2,
  ZoomIn, ZoomOut, Eye, X, Activity, ChevronRight, Sliders,
  Clock, TrendingDown, TrendingUp, Info, ExternalLink, RefreshCw,
  FileText, Sparkles
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchLineage, fetchPipelines, fetchPipelineRuns, fetchRunDetail } from '../api/client';

export default function Lineage() {
  const [loading, setLoading] = useState(true);
  const [lineageApiData, setLineageApiData] = useState(null);
  const [pipelinesList, setPipelinesList] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('3794bea7-75b1-4eba-b0cc-bd253419aafa');
  const [selectedPipelineName, setSelectedPipelineName] = useState('inventory_etl');

  // Dynamic Assets extracted from live API
  const [sourceColumns, setSourceColumns] = useState([]);
  const [targetColumns, setTargetColumns] = useState([]);
  const [sourceTableName, setSourceTableName] = useState('INVENTORY_ANALYTICS.RAW_DATA.RAW_INVENTORY');
  const [targetTableName, setTargetTableName] = useState('INVENTORY_ANALYTICS.FINAL_DATA.DIM_INVENTORY');
  const [sourceRowCount, setSourceRowCount] = useState(208);
  const [targetRowCount, setTargetRowCount] = useState(65);
  const [runDuration, setRunDuration] = useState('15s');

  // UI state
  const [level, setLevel] = useState('column'); // 'table' | 'column'
  const [selectedNode, setSelectedNode] = useState('target'); // 'source' | 'dbt' | 'target'
  const [selectedColumnIndex, setSelectedColumnIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(true);

  // 1. Fetch live API data dynamically
  const loadDynamicLineage = useCallback(async () => {
    setLoading(true);
    try {
      const [linRes, pipeRes] = await Promise.allSettled([
        fetchLineage({ preset: 'all' }),
        fetchPipelines({ preset: 'all' })
      ]);

      if (linRes.status === 'fulfilled' && linRes.value) {
        setLineageApiData(linRes.value);
      }

      let activePipeId = selectedPipelineId;
      if (pipeRes.status === 'fulfilled' && pipeRes.value) {
        const pList = pipeRes.value.items || pipeRes.value.pipelines || (Array.isArray(pipeRes.value) ? pipeRes.value : []);
        setPipelinesList(pList);
        if (pList.length > 0) {
          activePipeId = pList[0].pipeline_id || activePipeId;
          setSelectedPipelineId(activePipeId);
          setSelectedPipelineName(pList[0].pipeline_name || 'inventory_etl');
        }
      }

      // Fetch dynamic runs and schema assets for the active pipeline
      if (activePipeId) {
        const runsRes = await fetchPipelineRuns(activePipeId, { preset: 'all' }).catch(() => null);
        const runs = runsRes?.items || [];
        if (runs.length > 0) {
          const latestRun = runs[0];
          setSourceRowCount(latestRun.rows_read || 208);
          setTargetRowCount(latestRun.rows_written || 65);
          setRunDuration(latestRun.duration_display || `${latestRun.duration || 15}s`);

          // Fetch full run detail to extract live schema columns
          const runDetail = await fetchRunDetail(latestRun.id).catch(() => null);
          const assets = runDetail?.assets || [];

          if (assets.length > 0) {
            const srcCols = assets
              .filter(a => a.asset_role === 'SOURCE')
              .map(a => ({
                id: a.id,
                name: a.column_name,
                type: a.data_type,
                pk: a.column_name === 'PRODUCT_ID' || a.column_name === 'ID',
                table: `${a.database_name}.${a.schema_name}.${a.object_name}`
              }));

            const tgtCols = assets
              .filter(a => a.asset_role === 'TARGET')
              .map(a => ({
                id: a.id,
                name: a.column_name,
                type: a.data_type,
                pk: a.column_name === 'PRODUCT_ID' || a.column_name === 'ID',
                table: `${a.database_name}.${a.schema_name}.${a.object_name}`
              }));

            if (srcCols.length > 0) {
              setSourceColumns(srcCols);
              setSourceTableName(srcCols[0].table || 'INVENTORY_ANALYTICS.RAW_DATA.RAW_INVENTORY');
            }
            if (tgtCols.length > 0) {
              setTargetColumns(tgtCols);
              setTargetTableName(tgtCols[0].table || 'INVENTORY_ANALYTICS.FINAL_DATA.DIM_INVENTORY');
            }
          }
        }
      }
    } catch (e) {
      console.error('Error loading dynamic lineage from API:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedPipelineId]);

  useEffect(() => {
    loadDynamicLineage();
  }, [loadDynamicLineage]);

  // Fallback columns if API is still loading
  const effectiveSourceCols = useMemo(() => {
    if (sourceColumns.length > 0) return sourceColumns;
    return [
      { name: 'PRODUCT_ID', type: 'NUMBER', pk: true },
      { name: 'PRODUCT_NAME', type: 'TEXT', pk: false },
      { name: 'SKU', type: 'TEXT', pk: false },
      { name: 'CATEGORY', type: 'TEXT', pk: false },
      { name: 'SUPPLIER', type: 'TEXT', pk: false },
      { name: 'WAREHOUSE_LOCATION', type: 'TEXT', pk: false },
      { name: 'UNIT_PRICE', type: 'NUMBER', pk: false },
      { name: 'CURRENCY', type: 'TEXT', pk: false },
      { name: 'QUANTITY_IN_STOCK', type: 'NUMBER', pk: false },
      { name: 'REORDER_LEVEL', type: 'NUMBER', pk: false },
      { name: 'LAST_RESTOCKED_DATE', type: 'TEXT', pk: false },
      { name: 'IS_DISCONTINUED', type: 'TEXT', pk: false },
      { name: 'STATUS', type: 'TEXT', pk: false },
      { name: 'RATING', type: 'TEXT', pk: false }
    ];
  }, [sourceColumns]);

  const effectiveTargetCols = useMemo(() => {
    if (targetColumns.length > 0) return targetColumns;
    return [
      { name: 'PRODUCT_ID', type: 'NUMBER', pk: true },
      { name: 'PRODUCT_NAME', type: 'TEXT', pk: false },
      { name: 'SKU', type: 'TEXT', pk: false },
      { name: 'CATEGORY', type: 'TEXT', pk: false },
      { name: 'SUPPLIER', type: 'TEXT', pk: false },
      { name: 'WAREHOUSE_LOCATION', type: 'TEXT', pk: false },
      { name: 'UNIT_PRICE', type: 'NUMBER', pk: false },
      { name: 'CURRENCY', type: 'TEXT', pk: false },
      { name: 'QUANTITY_IN_STOCK', type: 'NUMBER', pk: false },
      { name: 'REORDER_LEVEL', type: 'NUMBER', pk: false },
      { name: 'LAST_RESTOCKED_DATE', type: 'DATE', pk: false },
      { name: 'IS_DISCONTINUED', type: 'BOOLEAN', pk: false },
      { name: 'STATUS', type: 'TEXT', pk: false },
      { name: 'RATING', type: 'NUMBER', pk: false }
    ];
  }, [targetColumns]);

  // Search filtered lists
  const filteredSourceCols = useMemo(() => {
    if (!search) return effectiveSourceCols;
    return effectiveSourceCols.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  }, [effectiveSourceCols, search]);

  const filteredTargetCols = useMemo(() => {
    if (!search) return effectiveTargetCols;
    return effectiveTargetCols.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  }, [effectiveTargetCols, search]);

  return (
    <div className="fade-in">
      <PageHeader
        title="Lineage Explorer"
        subtitle="Track data flow, column-level transformations, and downstream impact across your data estate."
        onRefresh={loadDynamicLineage}
      />

      <div className="page-body">
        {/* ── TOP CONTROL BAR ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap', padding: '10px 16px', background: 'var(--bg-card)',
          border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {/* Search Box */}
            <div className="search-box" style={{ width: 230 }}>
              <Search size={13} />
              <input
                type="text"
                placeholder="Search tables, models, or columns..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ height: 32, fontSize: 12, paddingLeft: 30 }}
              />
            </div>

            {/* Pipeline Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Pipeline:</span>
              <select
                className="select-control"
                value={selectedPipelineId}
                onChange={e => {
                  setSelectedPipelineId(e.target.value);
                  const found = pipelinesList.find(p => p.pipeline_id === e.target.value);
                  if (found) setSelectedPipelineName(found.pipeline_name);
                }}
                style={{ height: 32, fontWeight: 600, padding: '0 10px' }}
              >
                {pipelinesList.length > 0 ? (
                  pipelinesList.map(p => (
                    <option key={p.pipeline_id} value={p.pipeline_id}>
                      {p.pipeline_name}
                    </option>
                  ))
                ) : (
                  <option value="3794bea7-75b1-4eba-b0cc-bd253419aafa">inventory_etl</option>
                )}
              </select>
            </div>

            {/* Level Toggle ([Table Level] | [Column Level (Active)]) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-card-subtle)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
              <button
                onClick={() => setLevel('table')}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: level === 'table' ? '#10B981' : 'transparent',
                  color: level === 'table' ? '#FFFFFF' : 'var(--text-secondary)'
                }}
              >
                Table Level
              </button>
              <button
                onClick={() => setLevel('column')}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: level === 'column' ? '#10B981' : 'transparent',
                  color: level === 'column' ? '#FFFFFF' : 'var(--text-secondary)'
                }}
              >
                Column Level (Active)
              </button>
            </div>

            {/* Depth Tag */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Depth</span>
              <span style={{
                background: 'var(--bg-card-subtle)', border: '1px solid var(--border)',
                padding: '3px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11
              }}>
                +2 / -2
              </span>
            </div>
          </div>

          {/* Bottom Toolbar Row: Zoom Controls (Left) + Inspector Button (Far Right Corner) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', marginTop: 2 }}>
            <button
              className="export-btn"
              onClick={() => setZoomLevel(z => Math.min(130, z + 10))}
              style={{ fontSize: 11.5, padding: '4px 10px', height: 28, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <ZoomIn size={12} />
              <span>Zoom in</span>
            </button>

            <button
              className="export-btn"
              onClick={() => setZoomLevel(z => Math.max(70, z - 10))}
              style={{ fontSize: 11.5, padding: '4px 10px', height: 28, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <ZoomOut size={12} />
              <span>Zoom out</span>
            </button>

            <button
              className="export-btn"
              onClick={() => setZoomLevel(100)}
              style={{ fontSize: 11.5, padding: '4px 10px', height: 28, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Maximize2 size={12} />
              <span>Fit View</span>
            </button>

            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{zoomLevel}%</span>

            {/* Inspector Toggle Button - Pushed to Far Right Corner */}
            <button
              onClick={() => setDrawerOpen(o => !o)}
              style={{
                marginLeft: 'auto',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                background: drawerOpen ? '#ECFDF5' : 'var(--bg-card-subtle)',
                color: drawerOpen ? '#059669' : 'var(--text-secondary)',
                border: `1.5px solid ${drawerOpen ? '#A7F3D0' : 'var(--border)'}`,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
            >
              <Table size={13} color="#059669" />
              <span>{drawerOpen ? 'Hide Inspector' : 'Show Inspector'}</span>
            </button>
          </div>
        </div>

        {/* ── MAIN WORKSPACE: CANVAS + RIGHT IMPACT INSPECTOR DRAWER ──────────── */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', position: 'relative' }}>
          {/* ── LINEAGE CANVAS ───────────────────────────────────────────────── */}
          <div style={{
            flex: 1, minWidth: 0, background: '#FFFFFF', border: '1px solid var(--border)',
            borderRadius: 12, padding: '32px 24px', overflowX: 'auto', minHeight: 720, position: 'relative',
            backgroundImage: 'radial-gradient(#E2E8F0 1.2px, transparent 1.2px)',
            backgroundSize: '22px 22px'
          }}>
            {/* ── VIEW 1: COLUMN-LEVEL LINEAGE (PERFECT TOUCHING SPLINES) ──────── */}
            {level === 'column' && (
              <div style={{
                position: 'relative', display: 'flex', alignItems: 'flex-start',
                gap: 80, width: 960,
                transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left',
                transition: 'transform 0.15s ease'
              }}>
                {/* SVG Connecting Bezier Splines - Exact Bounding Coordinates */}
                <svg
                  style={{
                    position: 'absolute', top: 0, left: 0, width: 960, height: 600,
                    pointerEvents: 'none', zIndex: 1
                  }}
                >
                  {/* Left-to-Center Connectors: from x=280 to x=360 */}
                  {filteredSourceCols.map((_, i) => {
                    const ySrc = 150 + i * 27;
                    const total = Math.max(filteredSourceCols.length, 1);
                    const yTrans = 150 + i * (220 / Math.max(total - 1, 1));
                    const isSelected = selectedColumnIndex === i;

                    return (
                      <g key={`l-${i}`}>
                        <path
                          d={`M 280 ${ySrc} C 320 ${ySrc}, 320 ${yTrans}, 360 ${yTrans}`}
                          fill="none"
                          stroke="#10B981"
                          strokeWidth={isSelected ? 2.5 : 1.5}
                          opacity={isSelected ? 1 : 0.4}
                        />
                        <circle cx={280} cy={ySrc} r={isSelected ? 4 : 3} fill="#10B981" />
                        <circle cx={360} cy={yTrans} r={3} fill="#10B981" />
                      </g>
                    );
                  })}

                  {/* Center-to-Right Connectors: from x=600 to x=680 */}
                  {filteredTargetCols.map((_, i) => {
                    const total = Math.max(filteredTargetCols.length, 1);
                    const yTrans = 150 + i * (220 / Math.max(total - 1, 1));
                    const yTgt = 150 + i * 27;
                    const isSelected = selectedColumnIndex === i;

                    return (
                      <g key={`r-${i}`}>
                        <path
                          d={`M 600 ${yTrans} C 640 ${yTrans}, 640 ${yTgt}, 680 ${yTgt}`}
                          fill="none"
                          stroke="#10B981"
                          strokeWidth={isSelected ? 2.5 : 1.5}
                          opacity={isSelected ? 1 : 0.4}
                        />
                        <circle cx={600} cy={yTrans} r={3} fill="#10B981" />
                        <circle cx={680} cy={yTgt} r={isSelected ? 4 : 3} fill="#10B981" />
                      </g>
                    );
                  })}
                </svg>

                {/* 1. SOURCE TABLE CARD (RICH BLUE SHADING) */}
                <div
                  onClick={() => { setSelectedNode('source'); setDrawerOpen(true); }}
                  style={{
                    width: 280, background: '#FFFFFF', borderRadius: 10,
                    border: '2px solid #3B82F6',
                    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.15), 0 4px 14px rgba(59, 130, 246, 0.08)',
                    overflow: 'hidden', zIndex: 2, cursor: 'pointer'
                  }}
                >
                  <div style={{ padding: '12px 14px', background: '#EFF6FF', borderBottom: '1px solid #BFDBFE' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#1D4ED8', background: '#DBEAFE', padding: '2px 8px', borderRadius: 4, border: '1px solid #BFDBFE' }}>
                        Source table
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>⋮</span>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: 11.5, color: '#0F172A', wordBreak: 'break-all', lineHeight: 1.3 }}>
                      {sourceTableName}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: '#2563EB' }}>
                      <span>❄️ Snowflake</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: '#2563EB' }}>
                      <span>👥 {sourceRowCount} rows</span>
                      <span>{effectiveSourceCols.length} columns</span>
                    </div>
                  </div>

                  {/* Dynamic Column List */}
                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {filteredSourceCols.map((col, idx) => (
                      <div
                        key={col.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedColumnIndex(idx);
                          setSelectedNode('source');
                          setDrawerOpen(true);
                        }}
                        style={{
                          height: 24, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          color: selectedColumnIndex === idx ? '#1D4ED8' : '#1E293B',
                          fontWeight: selectedColumnIndex === idx ? 700 : 500,
                          background: selectedColumnIndex === idx ? '#EFF6FF' : 'transparent',
                          padding: '0 6px', borderRadius: 4
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 10.5 }}>{col.name}</span>
                          {col.pk && <span style={{ fontSize: 8.5, color: '#F59E0B', fontWeight: 700 }}>(PK)</span>}
                        </div>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: selectedColumnIndex === idx ? '#3B82F6' : '#94A3B8' }} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. TRANSFORMATION NODE (RICH ORANGE SHADING - EXPANDED HEIGHT) */}
                <div
                  onClick={() => { setSelectedNode('dbt'); setDrawerOpen(true); }}
                  style={{
                    width: 240, background: '#FFFFFF', borderRadius: 10,
                    border: '2px solid #F97316', minHeight: 390,
                    boxShadow: '0 0 0 3px rgba(249, 115, 22, 0.15), 0 4px 14px rgba(249, 115, 22, 0.08)',
                    overflow: 'hidden', zIndex: 2, cursor: 'pointer'
                  }}
                >
                  <div style={{ padding: '12px 14px', background: '#FFF7ED', borderBottom: '1px solid #FED7AA' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#C2410C', background: '#FFEDD5', padding: '2px 8px', borderRadius: 4, border: '1px solid #FED7AA' }}>
                        Transformation
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>⋮</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: '#0F172A' }}>
                      <span>🟧</span>
                      <span>dbt-inventory-job</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#047857', background: '#ECFDF5', padding: '2px 6px', borderRadius: 4 }}>
                        ● 20/20 Tests Passed
                      </span>
                      <span style={{ fontSize: 10.5, color: '#64748B', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Clock size={11} /> {runDuration}
                      </span>
                    </div>

                    <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 6 }}>
                      📁 inventory_analytics
                    </div>
                  </div>

                  {/* Transformation Stages */}
                  <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { name: 'stg_inventory.sql', dur: '1.2s' },
                      { name: 'int_inventory_metrics.sql', dur: '2.8s' },
                      { name: 'dim_inventory.sql', dur: '4.1s' },
                      { name: '20 dbt Data Tests', dur: '4.6s' },
                      { name: 'Snowflake Mart Load', dur: '1.0s' },
                      { name: 'Catalog Schema Sync', dur: '0.8s' },
                    ].map((stg) => (
                      <div
                        key={stg.name}
                        style={{
                          height: 26, fontSize: 10.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          color: '#334155', fontWeight: 500
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981' }} />
                          <span style={{ fontFamily: 'monospace' }}>{stg.name}</span>
                        </div>
                        <span style={{ color: '#059669', fontWeight: 600 }}>{stg.dur}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. TARGET TABLE CARD (RICH GREEN SHADING) */}
                <div
                  onClick={() => { setSelectedNode('target'); setDrawerOpen(true); }}
                  style={{
                    width: 280, background: '#FFFFFF', borderRadius: 10,
                    border: '2px solid #10B981',
                    boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.15), 0 4px 14px rgba(16, 185, 129, 0.08)',
                    overflow: 'hidden', zIndex: 2, cursor: 'pointer'
                  }}
                >
                  <div style={{ padding: '12px 14px', background: '#ECFDF5', borderBottom: '1px solid #A7F3D0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#047857', background: '#D1FAE5', padding: '2px 8px', borderRadius: 4, border: '1px solid #A7F3D0' }}>
                        Target table
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>⋮</span>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: 11.5, color: '#0F172A', wordBreak: 'break-all', lineHeight: 1.3 }}>
                      {targetTableName}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: '#047857' }}>
                      <span>❄️ Snowflake</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: '#047857' }}>
                      <span>👥 {targetRowCount} rows</span>
                      <span>{effectiveTargetCols.length} columns</span>
                    </div>
                  </div>

                  {/* Dynamic Target Columns */}
                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {filteredTargetCols.map((col, idx) => (
                      <div
                        key={col.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedColumnIndex(idx);
                          setSelectedNode('target');
                          setDrawerOpen(true);
                        }}
                        style={{
                          height: 24, fontSize: 11, display: 'flex', alignItems: 'center', gap: 8,
                          color: selectedColumnIndex === idx ? '#047857' : '#1E293B',
                          fontWeight: selectedColumnIndex === idx ? 700 : 500,
                          background: selectedColumnIndex === idx ? '#ECFDF5' : 'transparent',
                          padding: '0 6px', borderRadius: 4
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: selectedColumnIndex === idx ? '#10B981' : '#94A3B8' }} />
                        <span style={{ fontFamily: 'monospace', fontSize: 10.5 }}>{col.name}</span>
                        {col.pk && <span style={{ fontSize: 8.5, color: '#F59E0B', fontWeight: 700 }}>(PK)</span>}
                        <span style={{ marginLeft: 'auto', fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{col.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── VIEW 2: TABLE-LEVEL LINEAGE (CLEAN 3-CARD LAYOUT) ──────────── */}
            {level === 'table' && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 48, minHeight: 450, padding: '40px 0',
                transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center'
              }}>
                <div
                  onClick={() => { setSelectedNode('source'); setDrawerOpen(true); }}
                  style={{
                    width: 230, padding: 16, background: '#FFFFFF', borderRadius: 10,
                    border: '2px solid #3B82F6',
                    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.15), 0 4px 14px rgba(59, 130, 246, 0.08)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>RAW_INVENTORY</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: '#2563EB' }}>
                    <span>❄️ Snowflake</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>RAW_DATA</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#0F172A', marginTop: 2 }}>{sourceRowCount} rows</div>
                </div>

                <div style={{ color: '#94A3B8' }}><ArrowRight size={24} /></div>

                <div
                  onClick={() => { setSelectedNode('dbt'); setDrawerOpen(true); }}
                  style={{
                    width: 210, padding: 16, background: '#FFFFFF', borderRadius: 10,
                    border: '2px solid #F97316',
                    boxShadow: '0 0 0 3px rgba(249, 115, 22, 0.15), 0 4px 14px rgba(249, 115, 22, 0.08)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: '#0F172A' }}>
                    <span>🟧</span>
                    <span>dbt-inventory-job</span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#047857', background: '#ECFDF5', padding: '2px 6px', borderRadius: 4 }}>
                      20/20 Tests Passed
                    </span>
                  </div>
                </div>

                <div style={{ color: '#10B981' }}><ArrowRight size={24} /></div>

                <div
                  onClick={() => { setSelectedNode('target'); setDrawerOpen(true); }}
                  style={{
                    width: 230, padding: 16, background: '#FFFFFF', borderRadius: 10,
                    border: '2px solid #10B981',
                    boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.15), 0 4px 14px rgba(16, 185, 129, 0.08)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>DIM_INVENTORY</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: '#047857' }}>
                    <span>❄️ Snowflake</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>FINAL_DATA</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#0F172A', marginTop: 2 }}>{targetRowCount} rows</div>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT IMPACT & NODE INSPECTOR DRAWER ─────────────────────────── */}
          {drawerOpen && (
            <div style={{
              width: 320, background: '#FFFFFF', border: '1px solid #E2E8F0',
              borderRadius: 12, padding: 18, boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              display: 'flex', flexDirection: 'column', gap: 14
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A' }}>
                  Impact & Node Inspector
                </span>
                <button className="icon-btn" onClick={() => setDrawerOpen(false)} style={{ width: 24, height: 24 }}>
                  <X size={14} />
                </button>
              </div>

              {/* Selected Asset Header Pill */}
              <div style={{
                padding: '8px 12px', background: '#ECFDF5', borderRadius: 8,
                border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: 8
              }}>
                <Table size={15} color="#047857" />
                <span style={{ fontWeight: 700, fontSize: 13, color: '#047857' }}>
                  {selectedNode === 'source' ? 'RAW_INVENTORY' : selectedNode === 'dbt' ? 'dbt-inventory-job' : 'DIM_INVENTORY'}
                </span>
              </div>

              {/* Asset Overview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, color: '#475569' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>❄️</span>
                  <strong>Snowflake Table ({selectedNode === 'source' ? 'RAW_DATA' : 'FINAL_DATA'})</strong>
                </div>
                <div style={{ fontSize: 10.5, color: '#64748B', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {selectedNode === 'source' ? sourceTableName : targetTableName}
                </div>
                <div style={{ fontSize: 11, color: '#0F172A', fontWeight: 600 }}>
                  🔢 {effectiveTargetCols.length} Columns Monitored
                </div>
              </div>

              {/* Observability Health Cards */}
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Observability Health</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 6 }}>
                  <div style={{ padding: 8, borderRadius: 6, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                    <div style={{ fontSize: 10, color: '#991B1B', fontWeight: 600 }}>Freshness</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', marginTop: 2 }}>Delayed (36h)</div>
                  </div>

                  <div style={{ padding: 8, borderRadius: 6, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                    <div style={{ fontSize: 10, color: '#991B1B', fontWeight: 600 }}>Volume Trend</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', marginTop: 2 }}>{targetRowCount} rows / -68%</div>
                  </div>

                  <div style={{ padding: 8, borderRadius: 6, background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                    <div style={{ fontSize: 10, color: '#065F46', fontWeight: 600 }}>Data Quality</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginTop: 2 }}>96% (24/25)</div>
                  </div>

                  <div style={{ padding: 8, borderRadius: 6, background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                    <div style={{ fontSize: 10, color: '#065F46', fontWeight: 600 }}>Schema Health</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginTop: 2 }}>100% Valid</div>
                  </div>
                </div>
              </div>

              {/* Progress Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: '#64748B' }}>Data Quality Score</span>
                    <strong style={{ color: '#059669' }}>96%</strong>
                  </div>
                  <div style={{ width: '100%', height: 6, background: '#E2E8F0', borderRadius: 99, marginTop: 4 }}>
                    <div style={{ width: '96%', height: '100%', background: '#10B981', borderRadius: 99 }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: '#64748B' }}>Schema Stability</span>
                    <strong style={{ color: '#059669' }}>100%</strong>
                  </div>
                  <div style={{ width: '100%', height: 6, background: '#E2E8F0', borderRadius: 99, marginTop: 4 }}>
                    <div style={{ width: '100%', height: '100%', background: '#10B981', borderRadius: 99 }} />
                  </div>
                </div>
              </div>

              {/* Downstream Impact */}
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Downstream Impact</span>
                <div style={{ padding: '8px 10px', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0', marginTop: 6, fontSize: 11 }}>
                  <div style={{ fontWeight: 600, color: '#0F172A' }}>1 downstream dashboard</div>
                  <div style={{ color: '#64748B', marginTop: 2 }}>Executive Inventory Report (Looker/PowerBI)</div>
                  <div style={{ color: '#059669', fontWeight: 600, marginTop: 4 }}>● {effectiveTargetCols.length} columns affected</div>
                </div>
              </div>

              {/* Inspect Button */}
              <button
                className="export-btn"
                onClick={() => setLevel('column')}
                style={{
                  background: '#10B981', color: '#FFFFFF', border: 'none', fontWeight: 600,
                  padding: '8px 12px', borderRadius: 6, cursor: 'pointer', textAlign: 'center', width: '100%'
                }}
              >
                Inspect {effectiveTargetCols.length} Columns →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
