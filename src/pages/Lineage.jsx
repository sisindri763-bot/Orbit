import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Network, Database, GitBranch, ArrowRight, Layers, CheckCircle,
  AlertTriangle, XCircle, Search, Filter, Plus, MoreVertical,
  Download, ArrowUpRight, Check, ExternalLink, RefreshCw, Server,
  Sliders, Shield, Play, Table, Key, Maximize2, Minimize2, ZoomIn, ZoomOut,
  Info, Eye, X, Code, Sparkles, ChevronRight, Activity, CircleDot
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchLineage, fetchPipelines, fetchTools } from '../api/client';

// Real Pipeline Inventory Lineage Nodes Data Model (Source -> Staging -> Intermediate -> Dim Mart -> Target)
const LINEAGE_NODES = [
  {
    id: 'source_raw',
    name: 'RAW_DATA.RAW_INVENTORY',
    type: 'source',
    tool: 'Snowflake Table',
    icon: '❄️',
    status: 'Healthy',
    columnsCount: 8,
    color: '#3B82F6',
    bg: '#EFF6FF',
    border: '#BFDBFE',
    columns: [
      { id: 'id', name: 'ID', pk: true, type: 'NUMBER(38,0)', nulls: 0, quality: 100, desc: 'Primary key record identifier' },
      { id: 'item_name', name: 'ITEM_NAME', pk: false, type: 'VARCHAR(16777216)', nulls: 0, quality: 100, desc: 'Raw product item name' },
      { id: 'category', name: 'CATEGORY', pk: false, type: 'VARCHAR(16777216)', nulls: 0, quality: 100, desc: 'Inventory category code' },
      { id: 'quantity', name: 'QUANTITY', pk: false, type: 'NUMBER(38,0)', nulls: 0, quality: 100, desc: 'Raw quantity count in stock' },
      { id: 'unit_price', name: 'UNIT_PRICE', pk: false, type: 'NUMBER(38,2)', nulls: 0, quality: 100, desc: 'Catalog unit price' },
      { id: 'location', name: 'LOCATION', pk: false, type: 'VARCHAR(16777216)', nulls: 0, quality: 100, desc: 'Warehouse facility location code' },
      { id: 'supplier', name: 'SUPPLIER', pk: false, type: 'VARCHAR(16777216)', nulls: 0, quality: 100, desc: 'Vendor / supplier identifier' },
      { id: 'last_updated', name: 'LAST_UPDATED', pk: false, type: 'TIMESTAMP_NTZ', nulls: 0, quality: 96, desc: 'Source extract timestamp' },
    ]
  },
  {
    id: 'stg_inventory',
    name: 'stg_inventory',
    type: 'transform',
    tool: 'dbt Model',
    icon: '🟧',
    status: 'Success',
    columnsCount: 9,
    color: '#8B5CF6',
    bg: '#F5F3FF',
    border: '#DDD6FE',
    columns: [
      { id: 'id', name: 'id', pk: true, type: 'NUMBER(38,0)', nulls: 0, quality: 100, desc: 'Cleaned product identifier' },
      { id: 'item_name', name: 'product_name', pk: false, type: 'VARCHAR', nulls: 0, quality: 100, desc: 'Trimmed product name' },
      { id: 'category', name: 'category', pk: false, type: 'VARCHAR', nulls: 0, quality: 100, desc: 'Standardized category code' },
      { id: 'quantity', name: 'quantity_in_stock', pk: false, type: 'NUMBER', nulls: 0, quality: 100, desc: 'Cleaned quantity balance' },
      { id: 'unit_price', name: 'unit_price', pk: false, type: 'NUMBER(38,2)', nulls: 0, quality: 100, desc: 'Price per item unit' },
      { id: 'location', name: 'warehouse_location', pk: false, type: 'VARCHAR', nulls: 0, quality: 100, desc: 'Uppercase warehouse code' },
      { id: 'supplier', name: 'supplier', pk: false, type: 'VARCHAR', nulls: 0, quality: 100, desc: 'Verified supplier name' },
      { id: 'last_updated', name: 'last_restocked_date', pk: false, type: 'TIMESTAMP', nulls: 0, quality: 96, desc: 'Cleaned restock datetime' },
      { id: 'status', name: 'is_active', pk: false, type: 'BOOLEAN', nulls: 0, quality: 100, desc: 'Active availability flag' },
    ]
  },
  {
    id: 'int_inventory_metrics',
    name: 'int_inventory_metrics',
    type: 'transform',
    tool: 'dbt Model',
    icon: '🟧',
    status: 'Success',
    columnsCount: 6,
    color: '#8B5CF6',
    bg: '#F5F3FF',
    border: '#DDD6FE',
    isSubModel: true,
    columns: [
      { id: 'id', name: 'product_id', pk: true, type: 'NUMBER(38,0)', nulls: 0, quality: 100, desc: 'Product key' },
      { id: 'quantity', name: 'inventory_turnover', pk: false, type: 'FLOAT', nulls: 0, quality: 100, desc: 'Computed monthly velocity' },
      { id: 'unit_price', name: 'total_valuation', pk: false, type: 'NUMBER(38,2)', nulls: 0, quality: 100, desc: 'quantity * unit_price' },
      { id: 'location', name: 'safety_stock_level', pk: false, type: 'NUMBER', nulls: 0, quality: 100, desc: 'Buffer stock threshold' },
      { id: 'last_updated', name: 'days_since_restock', pk: false, type: 'NUMBER', nulls: 0, quality: 96, desc: 'Freshness SLA delta' },
      { id: 'status', name: 'reorder_required', pk: false, type: 'BOOLEAN', nulls: 0, quality: 100, desc: 'Low inventory alert flag' },
    ]
  },
  {
    id: 'dim_inventory',
    name: 'dim_inventory',
    type: 'transform',
    tool: 'dbt Model',
    icon: '🟧',
    status: 'Success',
    columnsCount: 9,
    color: '#8B5CF6',
    bg: '#F5F3FF',
    border: '#DDD6FE',
    columns: [
      { id: 'id', name: 'product_id', pk: true, type: 'NUMBER(38,0)', nulls: 0, quality: 100, desc: 'Unique product dimension key' },
      { id: 'item_name', name: 'sku', pk: false, type: 'VARCHAR', nulls: 0, quality: 100, desc: 'Stock Keeping Unit identifier' },
      { id: 'item_name', name: 'product_name', pk: false, type: 'VARCHAR', nulls: 0, quality: 100, desc: 'Final dimension product label' },
      { id: 'category', name: 'category', pk: false, type: 'VARCHAR', nulls: 0, quality: 100, desc: 'Merchandise category' },
      { id: 'quantity', name: 'quantity_in_stock', pk: false, type: 'NUMBER', nulls: 0, quality: 100, desc: 'Verified on-hand quantity' },
      { id: 'unit_price', name: 'unit_price', pk: false, type: 'NUMBER(38,2)', nulls: 0, quality: 100, desc: 'Wholesale unit price' },
      { id: 'location', name: 'warehouse_location', pk: false, type: 'VARCHAR', nulls: 0, quality: 100, desc: 'Validated warehouse location' },
      { id: 'last_updated', name: 'last_restocked_date', pk: false, type: 'TIMESTAMP', nulls: 0, quality: 96, desc: 'Last inventory check timestamp' },
      { id: 'status', name: 'status', pk: false, type: 'VARCHAR', nulls: 0, quality: 100, desc: 'In Stock / Out of Stock' },
    ]
  },
  {
    id: 'target_mart',
    name: 'FINAL_DATA.DIM_INVENTORY',
    type: 'target',
    tool: 'Snowflake Table',
    icon: '❄️',
    status: 'Healthy',
    columnsCount: 9,
    color: '#10B981',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    columns: [
      { id: 'id', name: 'ID', pk: true, type: 'NUMBER(38,0)', nulls: 0, quality: 100, desc: 'Published Primary Key' },
      { id: 'item_name', name: 'SKU', pk: false, type: 'VARCHAR(16777216)', nulls: 0, quality: 100, desc: 'SKU code in data mart' },
      { id: 'item_name', name: 'PRODUCT_NAME', pk: false, type: 'VARCHAR(16777216)', nulls: 0, quality: 100, desc: 'Product display name' },
      { id: 'category', name: 'CATEGORY', pk: false, type: 'VARCHAR(16777216)', nulls: 0, quality: 100, desc: 'Analytics category partition' },
      { id: 'quantity', name: 'QUANTITY_IN_STOCK', pk: false, type: 'NUMBER(38,0)', nulls: 0, quality: 100, desc: 'Audited stock quantity' },
      { id: 'unit_price', name: 'UNIT_PRICE', pk: false, type: 'NUMBER(38,2)', nulls: 0, quality: 100, desc: 'Mart unit price' },
      { id: 'location', name: 'WAREHOUSE_LOCATION', pk: false, type: 'VARCHAR(16777216)', nulls: 0, quality: 100, desc: 'Warehouse identifier' },
      { id: 'last_updated', name: 'LAST_RESTOCKED_DATE', pk: false, type: 'TIMESTAMP_NTZ', nulls: 0, quality: 96, desc: 'Audited refresh timestamp' },
      { id: 'status', name: 'STATUS', pk: false, type: 'VARCHAR(16777216)', nulls: 0, quality: 100, desc: 'Inventory status enum' },
    ]
  }
];

export default function Lineage() {
  const [level, setLevel] = useState('column'); // 'table' | 'column'
  const [selectedColumnId, setSelectedColumnId] = useState('id');
  const [selectedNodeId, setSelectedNodeId] = useState('source_raw');
  const [showOnlyAffected, setShowOnlyAffected] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [search, setSearch] = useState('');
  const [expandedNodes, setExpandedNodes] = useState({});
  const [drawerOpen, setDrawerOpen] = useState(true);

  // Default selected column details
  const selectedColumnInfo = useMemo(() => {
    for (const node of LINEAGE_NODES) {
      const col = node.columns.find(c => c.id === selectedColumnId);
      if (col) {
        return {
          column: col,
          node: node,
          sqlExpression: selectedColumnId === 'id'
            ? 'CAST(ID AS NUMBER(38,0)) AS product_id'
            : selectedColumnId === 'location'
            ? 'UPPER(LOCATION) AS warehouse_location'
            : selectedColumnId === 'quantity'
            ? 'COALESCE(QUANTITY, 0) AS quantity_in_stock'
            : `TRIM(${col.name}) AS ${col.name.toLowerCase()}`
        };
      }
    }
    return null;
  }, [selectedColumnId]);

  const handleSelectColumn = (colId, nodeId) => {
    setSelectedColumnId(colId);
    setSelectedNodeId(nodeId);
    setDrawerOpen(true);
  };

  const handleSelectNode = (nodeId) => {
    setSelectedNodeId(nodeId);
    setDrawerOpen(true);
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Lineage"
        subtitle="Track data flow, column-level transformations, and dependency lineage across your data estate."
      />

      <div className="page-body">
        {/* ── TOP CONTROL & LEVEL TOGGLE BAR (MATCHING REFERENCE IMAGE) ────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap', padding: '10px 16px', background: 'var(--bg-card)',
          border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          {/* Level Switcher (Table Level vs Column Level) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card-subtle)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
            <button
              onClick={() => setLevel('table')}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                background: level === 'table' ? '#FFFFFF' : 'transparent',
                color: level === 'table' ? 'var(--brand-dark)' : 'var(--text-secondary)',
                boxShadow: level === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Table Level
            </button>
            <button
              onClick={() => setLevel('column')}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                background: level === 'column' ? '#FFFFFF' : 'transparent',
                color: level === 'column' ? '#6366F1' : 'var(--text-secondary)',
                boxShadow: level === 'column' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Column Level
            </button>
          </div>

          {/* Lineage Type Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Lineage Type:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6' }} />
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Source</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6' }} />
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Transformation</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Target</span>
            </div>
          </div>

          {/* Search Box */}
          <div className="search-box" style={{ width: 240 }}>
            <Search size={13} />
            <input
              type="text"
              placeholder="Search dataset, table or column..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ height: 32, fontSize: 12, paddingLeft: 30 }}
            />
          </div>

          {/* Right Controls: Show Affected, Zoom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <span>Show Only Affected</span>
              <input
                type="checkbox"
                checked={showOnlyAffected}
                onChange={e => setShowOnlyAffected(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
            </label>

            {/* Zoom Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-card-subtle)', borderRadius: 6, border: '1px solid var(--border)', padding: 2 }}>
              <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => setZoomLevel(z => Math.max(50, z - 10))} title="Zoom Out">
                <ZoomOut size={12} />
              </button>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '0 4px', minWidth: 36, textAlign: 'center' }}>{zoomLevel}%</span>
              <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => setZoomLevel(z => Math.min(150, z + 10))} title="Zoom In">
                <ZoomIn size={12} />
              </button>
              <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => setZoomLevel(100)} title="Reset Zoom">
                <Maximize2 size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* ── MAIN WORKSPACE: LINEAGE CANVAS + RIGHT DRAWER ─────────────────────── */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', position: 'relative' }}>
          {/* ── LINEAGE CANVAS ─────────────────────────────────────────────────── */}
          <div style={{
            flex: 1, minWidth: 0, background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 24, overflowX: 'auto', minHeight: 620, position: 'relative',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}>
            {/* Top Node Flow Architecture */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 48,
              transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left',
              transition: 'transform 0.15s ease', minWidth: 1000, paddingBottom: 60
            }}>
              {/* 1. SOURCE NODE */}
              <LineageNodeCard
                node={LINEAGE_NODES[0]}
                level={level}
                selectedColumnId={selectedColumnId}
                onSelectColumn={handleSelectColumn}
                onSelectNode={handleSelectNode}
                isSelectedNode={selectedNodeId === LINEAGE_NODES[0].id}
              />

              <ConnectingArrow color="#8B5CF6" />

              {/* 2. STAGING MODEL */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <LineageNodeCard
                  node={LINEAGE_NODES[1]}
                  level={level}
                  selectedColumnId={selectedColumnId}
                  onSelectColumn={handleSelectColumn}
                  onSelectNode={handleSelectNode}
                  isSelectedNode={selectedNodeId === LINEAGE_NODES[1].id}
                />

                {/* Sub Intermediate Model */}
                <LineageNodeCard
                  node={LINEAGE_NODES[2]}
                  level={level}
                  selectedColumnId={selectedColumnId}
                  onSelectColumn={handleSelectColumn}
                  onSelectNode={handleSelectNode}
                  isSelectedNode={selectedNodeId === LINEAGE_NODES[2].id}
                />
              </div>

              <ConnectingArrow color="#8B5CF6" />

              {/* 3. DIMENSION MART MODEL */}
              <LineageNodeCard
                node={LINEAGE_NODES[3]}
                level={level}
                selectedColumnId={selectedColumnId}
                onSelectColumn={handleSelectColumn}
                onSelectNode={handleSelectNode}
                isSelectedNode={selectedNodeId === LINEAGE_NODES[3].id}
              />

              <ConnectingArrow color="#10B981" />

              {/* 4. TARGET DESTINATION */}
              <LineageNodeCard
                node={LINEAGE_NODES[4]}
                level={level}
                selectedColumnId={selectedColumnId}
                onSelectColumn={handleSelectColumn}
                onSelectNode={handleSelectNode}
                isSelectedNode={selectedNodeId === LINEAGE_NODES[4].id}
              />
            </div>

            {/* Bottom Left Floating Mini-Map (Reference Image match) */}
            <div style={{
              position: 'absolute', bottom: 16, left: 16, width: 140, height: 75,
              background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: 8, display: 'flex',
              alignItems: 'center', justifyContent: 'space-between', gap: 6
            }}>
              <div style={{ width: 22, height: 40, background: '#BFDBFE', borderRadius: 4 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ width: 22, height: 18, background: '#DDD6FE', borderRadius: 4 }} />
                <div style={{ width: 22, height: 18, background: '#DDD6FE', borderRadius: 4 }} />
              </div>
              <div style={{ width: 22, height: 40, background: '#DDD6FE', borderRadius: 4 }} />
              <div style={{ width: 22, height: 40, background: '#A7F3D0', borderRadius: 4 }} />
              <div style={{
                position: 'absolute', inset: 6, border: '1.5px dashed #6366F1',
                borderRadius: 6, pointerEvents: 'none'
              }} />
            </div>
          </div>

          {/* ── RIGHT DRAWER: INTERACTIVE COLUMN & TABLE LINEAGE DETAILS ─────────── */}
          {drawerOpen && selectedColumnInfo && (
            <div style={{
              width: 320, background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 18, boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              display: 'flex', flexDirection: 'column', gap: 14
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>
                  Column Lineage Details
                </span>
                <button className="icon-btn" onClick={() => setDrawerOpen(false)} style={{ width: 24, height: 24 }}>
                  <X size={14} />
                </button>
              </div>

              {/* Selected Column Summary */}
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Selected Column</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366F1' }}>
                    <Table size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                      {selectedColumnInfo.column.name}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#6366F1' }}>
                      {selectedColumnInfo.column.type}
                    </div>
                  </div>
                </div>
              </div>

              {/* End-to-End Lineage Path */}
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lineage Path</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, paddingLeft: 6, borderLeft: '2px solid #DDD6FE' }}>
                  <div style={{ fontSize: 11 }}>
                    <strong style={{ color: '#2563EB' }}>1. RAW_DATA.RAW_INVENTORY</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Source Table &bull; <code>{selectedColumnInfo.column.id}</code></div>
                  </div>
                  <div style={{ fontSize: 11 }}>
                    <strong style={{ color: '#7C3AED' }}>2. stg_inventory</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>dbt Staging Model</div>
                  </div>
                  <div style={{ fontSize: 11 }}>
                    <strong style={{ color: '#7C3AED' }}>3. dim_inventory</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>dbt Mart Transformation</div>
                  </div>
                  <div style={{ fontSize: 11 }}>
                    <strong style={{ color: '#059669' }}>4. FINAL_DATA.DIM_INVENTORY</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Snowflake Target Mart &bull; <code>{selectedColumnInfo.column.name}</code></div>
                  </div>
                </div>
              </div>

              {/* Column Metrics & Details */}
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Column Details</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, fontSize: 11.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Data Type:</span>
                    <strong style={{ fontFamily: 'monospace' }}>{selectedColumnInfo.column.type}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Description:</span>
                    <span style={{ fontSize: 11, color: 'var(--text-primary)', textAlign: 'right', maxWidth: 180 }}>{selectedColumnInfo.column.desc}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Last Updated:</span>
                    <span>2 mins ago</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Data Quality:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong style={{ color: '#10B981' }}>{selectedColumnInfo.column.quality}%</strong>
                      <div style={{ width: 45, height: 5, background: 'var(--border)', borderRadius: 99 }}>
                        <div style={{ width: `${selectedColumnInfo.column.quality}%`, height: '100%', background: '#10B981', borderRadius: 99 }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Nulls:</span>
                    <strong style={{ color: '#10B981' }}>0 (0%)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Distinct Values:</span>
                    <strong>65 (100%)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                    <span style={{ color: '#10B981', fontWeight: 600 }}>● Healthy</span>
                  </div>
                </div>
              </div>

              {/* Transformation Code Block */}
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Transformation</span>
                <div style={{
                  marginTop: 6, padding: '8px 10px', background: '#0F172A',
                  color: '#38BDF8', borderRadius: 6, fontFamily: 'monospace',
                  fontSize: 11, lineHeight: 1.4, overflowX: 'auto'
                }}>
                  {selectedColumnInfo.sqlExpression}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>
                  Computed By: <code>dim_inventory.sql</code>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-component: Individual Lineage Node Card (Table Level & Column Level View)
function LineageNodeCard({ node, level, selectedColumnId, onSelectColumn, onSelectNode, isSelectedNode }) {
  return (
    <div
      onClick={() => onSelectNode(node.id)}
      style={{
        width: 225, borderRadius: 10, background: '#FFFFFF',
        border: `1.5px solid ${isSelectedNode ? node.color : node.border}`,
        boxShadow: isSelectedNode ? `0 0 0 3px ${node.color}25, 0 4px 12px rgba(0,0,0,0.06)` : '0 2px 8px rgba(0,0,0,0.04)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer',
        transition: 'all 0.15s ease'
      }}
    >
      {/* Card Header */}
      <div style={{ padding: '10px 12px', background: node.bg, borderBottom: `1px solid ${node.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>{node.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: node.color }}>{node.tool}</span>
          </div>
          <span style={{
            fontSize: 9.5, fontWeight: 700, color: node.status === 'Healthy' || node.status === 'Success' ? '#047857' : '#B45309',
            background: '#FFFFFF', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border)'
          }}>
            ● {node.status}
          </span>
        </div>
        <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
          {node.name}
        </div>
      </div>

      {/* Column Level View (Lists all columns with interactive active highlights) */}
      {level === 'column' && (
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>
            Columns ({node.columns.length})
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {node.columns.map(col => {
              const isSelectedCol = selectedColumnId === col.id;

              return (
                <div
                  key={col.name}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectColumn(col.id, node.id);
                  }}
                  style={{
                    padding: '4px 8px', borderRadius: 4, fontSize: 11,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: isSelectedCol ? '#EEF2FF' : 'transparent',
                    border: isSelectedCol ? '1px solid #C7D2FE' : '1px solid transparent',
                    color: isSelectedCol ? '#4F46E5' : 'var(--text-primary)',
                    fontWeight: isSelectedCol ? 700 : 500, cursor: 'pointer',
                    transition: 'all 0.1s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: isSelectedCol ? '#6366F1' : '#94A3B8' }} />
                    <span style={{ fontFamily: 'monospace', fontSize: 10.5 }}>{col.name}</span>
                    {col.pk && <span style={{ fontSize: 9, color: '#F59E0B', fontWeight: 700 }}>PK</span>}
                  </div>
                  {isSelectedCol && <ChevronRight size={12} color="#6366F1" />}
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 10, color: '#6366F1', fontWeight: 600, marginTop: 4, textAlign: 'center' }}>
            + View All Columns
          </div>
        </div>
      )}

      {/* Table Level View */}
      {level === 'table' && (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span>Type:</span>
            <strong>{node.type.toUpperCase()}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span>Columns:</span>
            <strong>{node.columnsCount} attributes</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span>Verified Rows:</span>
            <strong style={{ color: '#10B981' }}>65 rows</strong>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component: Spline Connecting Arrow
function ConnectingArrow({ color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: color, paddingTop: 35 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <div style={{ width: 24, height: 2, background: color }} />
        <ArrowRight size={18} />
      </div>
    </div>
  );
}
