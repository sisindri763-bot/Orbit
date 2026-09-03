import React, { useState, useMemo } from 'react';
import {
  Search, Layers, CheckCircle2, AlertTriangle, Shield,
  Database, GitBranch, ArrowRight, Table, Key, Maximize2,
  ZoomIn, ZoomOut, Eye, X, Activity, ChevronRight, Sliders,
  Clock, TrendingDown, TrendingUp, Info, ExternalLink, RefreshCw
} from 'lucide-react';
import PageHeader from '../components/PageHeader';

// 14 Real Schema Columns for the Inventory Pipeline
const SOURCE_COLUMNS = [
  'RAW_INVENTORY (PK)',
  'ITEM_NAME',
  'CATEGORY',
  'QUANTITY',
  'UNIT_PRICE',
  'LOCATION',
  'SUPPLIER',
  'LAST_UPDATED',
  'CURRENCY',
  'IS_DISCONTINUED',
  'REORDER_POINT',
  'SAFETY_STOCK',
  'INVENTORY_TURNOVER',
  'TOTAL_VALUATION'
];

const TARGET_COLUMNS = [
  'DIM_INVENTORY (PK)',
  'SKU',
  'PRODUCT_NAME',
  'CATEGORY',
  'QUANTITY_IN_STOCK',
  'UNIT_PRICE',
  'WAREHOUSE_LOCATION',
  'LAST_RESTOCKED_DATE',
  'STATUS',
  'CURRENCY',
  'IS_ACTIVE',
  'REORDER_REQUIRED',
  'SAFETY_STOCK_LEVEL',
  'TOTAL_ASSET_VALUE'
];

const DBT_STAGES = [
  { name: 'stg_inventory.sql', dur: '1.2s', desc: 'Type casting & null cleaning' },
  { name: 'int_inventory_metrics.sql', dur: '2.8s', desc: 'Turnover & safety stock aggregations' },
  { name: 'dim_inventory.sql', dur: '4.1s', desc: 'Dimension modeling & surrogate keys' },
  { name: '20 dbt Data Tests', dur: '4.6s', desc: '20/20 assertion checks pass' },
  { name: 'Snowflake Mart Load', dur: '1.0s', desc: 'Merge into FINAL_DATA' },
];

export default function Lineage() {
  const [level, setLevel] = useState('column'); // 'table' | 'column'
  const [selectedPipeline, setSelectedPipeline] = useState('inventory_etl');
  const [selectedNode, setSelectedNode] = useState('target'); // 'source' | 'dbt' | 'target'
  const [selectedColumnIndex, setSelectedColumnIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(true);

  // Filter columns based on search
  const filteredSourceCols = useMemo(() => {
    if (!search) return SOURCE_COLUMNS;
    return SOURCE_COLUMNS.filter(c => c.toLowerCase().includes(search.toLowerCase()));
  }, [search]);

  const filteredTargetCols = useMemo(() => {
    if (!search) return TARGET_COLUMNS;
    return TARGET_COLUMNS.filter(c => c.toLowerCase().includes(search.toLowerCase()));
  }, [search]);

  return (
    <div className="fade-in">
      <PageHeader
        title="Lineage Explorer"
        subtitle="Track data flow, column-level transformations, and downstream impact across your data estate."
      />

      <div className="page-body">
        {/* ── TOP CONTROL BAR (PIXEL-PERFECT MATCH TO REFERENCE IMAGE) ────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap', padding: '10px 16px', background: 'var(--bg-card)',
          border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div className="search-box" style={{ width: 240 }}>
              <Search size={13} />
              <input
                type="text"
                placeholder="Search tables, models, or columns..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ height: 32, fontSize: 12, paddingLeft: 30 }}
              />
            </div>

            {/* Pipeline Selector Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Pipeline:</span>
              <select
                className="select-control"
                value={selectedPipeline}
                onChange={e => setSelectedPipeline(e.target.value)}
                style={{ height: 32, fontWeight: 600, padding: '0 10px' }}
              >
                <option value="inventory_etl">inventory_etl</option>
              </select>
            </div>

            {/* Segment Level Toggle ([Table Level] | [Column Level (Active)]) */}
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

            {/* Depth Filter */}
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

          {/* Right Controls: Zoom and Minimap */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          </div>
        </div>

        {/* ── MAIN WORKSPACE: CANVAS + RIGHT IMPACT INSPECTOR DRAWER ──────────── */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', position: 'relative' }}>
          {/* ── LINEAGE CANVAS ───────────────────────────────────────────────── */}
          <div style={{
            flex: 1, minWidth: 0, background: '#FFFFFF', border: '1px solid var(--border)',
            borderRadius: 12, padding: '32px 24px', overflowX: 'auto', minHeight: 700, position: 'relative',
            backgroundImage: 'radial-gradient(#E2E8F0 1.2px, transparent 1.2px)',
            backgroundSize: '22px 22px'
          }}>
            {/* ── VIEW 1: COLUMN-LEVEL LINEAGE (MATCHING IMAGE 1) ────────────── */}
            {level === 'column' && (
              <div style={{
                position: 'relative', display: 'flex', alignItems: 'flex-start',
                justifyContent: 'space-between', gap: 20, minWidth: 840,
                transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left',
                transition: 'transform 0.15s ease'
              }}>
                {/* SVG Connecting Splines (Connecting left columns to middle dbt to right columns) */}
                <svg
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    pointerEvents: 'none', zIndex: 1
                  }}
                >
                  {/* Left-to-Center Connecting Green Bezier Splines */}
                  {filteredSourceCols.slice(0, 10).map((_, i) => {
                    const y1 = 182 + i * 28;
                    const y2 = 182 + Math.min(i, 4) * 32;

                    return (
                      <g key={`l-${i}`}>
                        <path
                          d={`M 252 ${y1} C 310 ${y1}, 320 ${y2}, 372 ${y2}`}
                          fill="none"
                          stroke="#10B981"
                          strokeWidth={selectedColumnIndex === i ? 2.5 : 1.5}
                          opacity={selectedColumnIndex === i ? 1 : 0.6}
                        />
                        <circle cx={252} cy={y1} r={3.5} fill="#10B981" />
                        <circle cx={372} cy={y2} r={3} fill="#10B981" />
                      </g>
                    );
                  })}

                  {/* Center-to-Right Connecting Green Bezier Splines */}
                  {filteredTargetCols.slice(0, 10).map((_, i) => {
                    const y1 = 182 + Math.min(i, 4) * 32;
                    const y2 = 182 + i * 28;

                    return (
                      <g key={`r-${i}`}>
                        <path
                          d={`M 515 ${y1} C 565 ${y1}, 575 ${y2}, 628 ${y2}`}
                          fill="none"
                          stroke="#10B981"
                          strokeWidth={selectedColumnIndex === i ? 2.5 : 1.5}
                          opacity={selectedColumnIndex === i ? 1 : 0.6}
                        />
                        <circle cx={515} cy={y1} r={3} fill="#10B981" />
                        <circle cx={628} cy={y2} r={3.5} fill="#10B981" />
                      </g>
                    );
                  })}
                </svg>

                {/* 1. SOURCE TABLE CARD */}
                <div
                  onClick={() => setSelectedNode('source')}
                  style={{
                    width: 250, background: '#FFFFFF', borderRadius: 10,
                    border: `1.5px solid ${selectedNode === 'source' ? '#3B82F6' : '#E2E8F0'}`,
                    boxShadow: selectedNode === 'source' ? '0 0 0 3px rgba(59, 130, 246, 0.15)' : '0 2px 8px rgba(0,0,0,0.04)',
                    overflow: 'hidden', zIndex: 2, cursor: 'pointer'
                  }}
                >
                  <div style={{ padding: '12px 14px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#3B82F6', background: '#EFF6FF', padding: '2px 8px', borderRadius: 4 }}>
                        Source table
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>⋮</span>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: 12, color: '#0F172A', lineHeight: 1.3 }}>
                      INVENTORY_ANALYTICS.RAW_DATA.RAW_INVENTORY
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: '#64748B' }}>
                      <span>❄️ Snowflake</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: '#64748B' }}>
                      <span>👥 208 rows</span>
                      <span>14 columns</span>
                    </div>
                  </div>

                  {/* Columns List with Right Dots */}
                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {filteredSourceCols.map((col, idx) => (
                      <div
                        key={col}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedColumnIndex(idx);
                          setSelectedNode('source');
                        }}
                        style={{
                          height: 24, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          color: selectedColumnIndex === idx ? '#047857' : '#1E293B',
                          fontWeight: selectedColumnIndex === idx ? 700 : 500,
                          background: selectedColumnIndex === idx ? '#ECFDF5' : 'transparent',
                          padding: '0 6px', borderRadius: 4
                        }}
                      >
                        <span style={{ fontFamily: 'monospace', fontSize: 10.5 }}>{col}</span>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: selectedColumnIndex === idx ? '#10B981' : '#94A3B8' }} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. TRANSFORMATION NODE (dbt-inventory-job) */}
                <div
                  onClick={() => setSelectedNode('dbt')}
                  style={{
                    width: 220, background: '#FFFFFF', borderRadius: 10,
                    border: `1.5px solid ${selectedNode === 'dbt' ? '#F97316' : '#E2E8F0'}`,
                    boxShadow: selectedNode === 'dbt' ? '0 0 0 3px rgba(249, 115, 22, 0.15)' : '0 2px 8px rgba(0,0,0,0.04)',
                    overflow: 'hidden', zIndex: 2, cursor: 'pointer'
                  }}
                >
                  <div style={{ padding: '12px 14px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#C2410C', background: '#FFF7ED', padding: '2px 8px', borderRadius: 4 }}>
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
                        <Clock size={11} /> 15s
                      </span>
                    </div>

                    <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 6 }}>
                      📁 inventory_analytics
                    </div>
                  </div>

                  {/* Stage Columns with Latencies */}
                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {DBT_STAGES.map((stg, idx) => (
                      <div
                        key={stg.name}
                        style={{
                          height: 28, fontSize: 10.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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

                {/* 3. TARGET TABLE CARD (HIGHLIGHTED GREEN BORDER MATCHING IMAGE 1) */}
                <div
                  onClick={() => setSelectedNode('target')}
                  style={{
                    width: 250, background: '#FFFFFF', borderRadius: 10,
                    border: '2px solid #10B981',
                    boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2), 0 4px 14px rgba(16, 185, 129, 0.1)',
                    overflow: 'hidden', zIndex: 2, cursor: 'pointer'
                  }}
                >
                  <div style={{ padding: '12px 14px', background: '#ECFDF5', borderBottom: '1px solid #A7F3D0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#047857', background: '#FFFFFF', padding: '2px 8px', borderRadius: 4, border: '1px solid #A7F3D0' }}>
                        Target table
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>⋮</span>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: 12, color: '#0F172A', lineHeight: 1.3 }}>
                      INVENTORY_ANALYTICS.FINAL_DATA.DIM_INVENTORY
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: '#047857' }}>
                      <span>❄️ Snowflake</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: '#047857' }}>
                      <span>👥 65 rows</span>
                      <span>14 columns</span>
                    </div>
                  </div>

                  {/* Columns List with Left Dots */}
                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {filteredTargetCols.map((col, idx) => (
                      <div
                        key={col}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedColumnIndex(idx);
                          setSelectedNode('target');
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
                        <span style={{ fontFamily: 'monospace', fontSize: 10.5 }}>{col}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── VIEW 2: TABLE-LEVEL LINEAGE (MATCHING IMAGE 2) ──────────────── */}
            {level === 'table' && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 48, minHeight: 450, padding: '40px 0',
                transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center'
              }}>
                {/* 1. SOURCE TABLE */}
                <div
                  onClick={() => setSelectedNode('source')}
                  style={{
                    width: 220, padding: 16, background: '#FFFFFF', borderRadius: 10,
                    border: `1.5px solid ${selectedNode === 'source' ? '#3B82F6' : '#E2E8F0'}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>RAW_INVENTORY</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: '#64748B' }}>
                    <span>❄️ Snowflake</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>RAW_DATA</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#0F172A', marginTop: 2 }}>208 rows</div>
                </div>

                <div style={{ color: '#94A3B8' }}><ArrowRight size={24} /></div>

                {/* 2. DBT MODEL */}
                <div
                  onClick={() => setSelectedNode('dbt')}
                  style={{
                    width: 200, padding: 16, background: '#FFFFFF', borderRadius: 10,
                    border: `1.5px solid ${selectedNode === 'dbt' ? '#F97316' : '#E2E8F0'}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer'
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

                {/* 3. TARGET TABLE (HIGHLIGHTED GREEN) */}
                <div
                  onClick={() => setSelectedNode('target')}
                  style={{
                    width: 220, padding: 16, background: '#FFFFFF', borderRadius: 10,
                    border: '2px solid #10B981',
                    boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2), 0 4px 12px rgba(16, 185, 129, 0.1)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>DIM_INVENTORY</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: '#047857' }}>
                    <span>❄️ Snowflake</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>FINAL_DATA</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#0F172A', marginTop: 2 }}>65 rows</div>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT IMPACT & NODE INSPECTOR DRAWER (MATCHING IMAGE 1 & 2) ───────── */}
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

              {/* Selected Asset Header Pill (DIM_INVENTORY) */}
              <div style={{
                padding: '8px 12px', background: '#ECFDF5', borderRadius: 8,
                border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: 8
              }}>
                <Table size={15} color="#047857" />
                <span style={{ fontWeight: 700, fontSize: 13, color: '#047857' }}>
                  DIM_INVENTORY
                </span>
              </div>

              {/* Asset Overview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, color: '#475569' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>❄️</span>
                  <strong>Snowflake Table</strong>
                </div>
                <div style={{ fontSize: 10.5, color: '#64748B', fontFamily: 'monospace' }}>
                  INVENTORY_ANALYTICS.FINAL_DATA.DIM_INVENTORY
                </div>
                <div style={{ fontSize: 11, color: '#0F172A', fontWeight: 600 }}>
                  🔢 14 Columns Monitored
                </div>
              </div>

              {/* 4 Observability Health Cards (Image 2 Match) */}
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Observability Health</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 6 }}>
                  {/* Freshness */}
                  <div style={{ padding: 8, borderRadius: 6, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                    <div style={{ fontSize: 10, color: '#991B1B', fontWeight: 600 }}>Freshness</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', marginTop: 2 }}>Delayed (37h)</div>
                  </div>

                  {/* Volume */}
                  <div style={{ padding: 8, borderRadius: 6, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                    <div style={{ fontSize: 10, color: '#991B1B', fontWeight: 600 }}>Volume Trend</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', marginTop: 2 }}>65 rows / -68%</div>
                  </div>

                  {/* Data Quality */}
                  <div style={{ padding: 8, borderRadius: 6, background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                    <div style={{ fontSize: 10, color: '#065F46', fontWeight: 600 }}>Data Quality</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginTop: 2 }}>96% (24/25)</div>
                  </div>

                  {/* Schema */}
                  <div style={{ padding: 8, borderRadius: 6, background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                    <div style={{ fontSize: 10, color: '#065F46', fontWeight: 600 }}>Schema Health</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginTop: 2 }}>100% Valid</div>
                  </div>
                </div>
              </div>

              {/* Data Quality & Schema Progress Bars */}
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

              {/* Impact Analysis */}
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Downstream Impact</span>
                <div style={{ padding: '8px 10px', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0', marginTop: 6, fontSize: 11 }}>
                  <div style={{ fontWeight: 600, color: '#0F172A' }}>1 downstream dashboard</div>
                  <div style={{ color: '#64748B', marginTop: 2 }}>Executive Inventory Report (Looker/PowerBI)</div>
                  <div style={{ color: '#059669', fontWeight: 600, marginTop: 4 }}>● 14 columns affected</div>
                </div>
              </div>

              {/* Inspect Button (Emerald Green) */}
              <button
                className="export-btn"
                onClick={() => setLevel('column')}
                style={{
                  background: '#10B981', color: '#FFFFFF', border: 'none', fontWeight: 600,
                  padding: '8px 12px', borderRadius: 6, cursor: 'pointer', textAlign: 'center', width: '100%'
                }}
              >
                Inspect 14 Columns →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
