import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Network, Database, GitBranch, ArrowRight, Layers, CheckCircle,
  AlertTriangle, XCircle, Search, Filter, Plus, MoreVertical,
  Download, ArrowUpRight, Check, ExternalLink, RefreshCw, Server,
  Sliders, Shield, Play, Table, Key, Maximize2, ZoomIn, ZoomOut,
  Info, Eye, X, Code, Sparkles, ChevronRight, Activity, CircleDot, FileText
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';

// Node Data representing the real Customers & Inventory Enterprise Pipeline
const LINEAGE_NODES = [
  {
    id: 'node_raw',
    name: 'RAW.CUSTOMERS',
    subtitle: 'Source Table',
    tool: 'Snowflake Table',
    type: 'source',
    icon: '❄️',
    status: 'Healthy',
    badgeColor: '#059669',
    badgeBg: '#ECFDF5',
    themeColor: '#3B82F6',
    headerBg: '#EFF6FF',
    borderColor: '#93C5FD',
    x: 20,
    y: 40,
    columns: [
      { id: 'col_id', name: 'customer_id (PK)', pk: true, type: 'BIGINT', desc: 'Unique identifier of customer' },
      { id: 'col_name', name: 'name', pk: false, type: 'VARCHAR', desc: 'Customer full legal name' },
      { id: 'col_email', name: 'email', pk: false, type: 'VARCHAR', desc: 'Primary contact email address' },
      { id: 'col_phone', name: 'phone', pk: false, type: 'VARCHAR', desc: 'Contact phone number' },
      { id: 'col_created', name: 'created_at', pk: false, type: 'TIMESTAMP', desc: 'Account creation timestamp' },
      { id: 'col_updated', name: 'updated_at', pk: false, type: 'TIMESTAMP', desc: 'Last record update timestamp' },
      { id: 'col_country', name: 'country', pk: false, type: 'VARCHAR', desc: 'ISO country code' },
      { id: 'col_status', name: 'status', pk: false, type: 'VARCHAR', desc: 'Account activation status' },
    ]
  },
  {
    id: 'node_stg',
    name: 'STG_CUSTOMERS',
    subtitle: 'dbt Model',
    tool: 'dbt Model',
    type: 'transform',
    icon: '🟧',
    status: 'Success',
    badgeColor: '#059669',
    badgeBg: '#ECFDF5',
    themeColor: '#8B5CF6',
    headerBg: '#F5F3FF',
    borderColor: '#C4B5FD',
    x: 300,
    y: 40,
    columns: [
      { id: 'col_id', name: 'customer_id', pk: true, type: 'BIGINT', desc: 'Standardized customer key' },
      { id: 'col_name', name: 'customer_name', pk: false, type: 'VARCHAR', desc: 'Sanitized customer name' },
      { id: 'col_email', name: 'email', pk: false, type: 'VARCHAR', desc: 'Validated email format' },
      { id: 'col_created', name: 'created_at', pk: false, type: 'TIMESTAMP', desc: 'Created UTC timestamp' },
      { id: 'col_updated', name: 'updated_at', pk: false, type: 'TIMESTAMP', desc: 'Updated UTC timestamp' },
      { id: 'col_country', name: 'country', pk: false, type: 'VARCHAR', desc: 'Standardized country name' },
      { id: 'col_status', name: 'is_active', pk: false, type: 'BOOLEAN', desc: 'Active customer flag' },
    ]
  },
  {
    id: 'node_int',
    name: 'INT_CUSTOMER_ACTIVITY',
    subtitle: 'dbt Model',
    tool: 'dbt Model',
    type: 'transform',
    icon: '🟧',
    status: 'Success',
    badgeColor: '#059669',
    badgeBg: '#ECFDF5',
    themeColor: '#8B5CF6',
    headerBg: '#F5F3FF',
    borderColor: '#C4B5FD',
    x: 300,
    y: 410,
    columns: [
      { id: 'col_id', name: 'customer_id', pk: true, type: 'BIGINT', desc: 'Customer key' },
      { id: 'col_act_date', name: 'activity_date', pk: false, type: 'DATE', desc: 'Event date' },
      { id: 'col_act_type', name: 'activity_type', pk: false, type: 'VARCHAR', desc: 'Interaction type' },
      { id: 'col_act_cnt', name: 'activity_count', pk: false, type: 'INTEGER', desc: 'Total event interactions' },
      { id: 'col_created', name: 'created_at', pk: false, type: 'TIMESTAMP', desc: 'Log creation time' },
      { id: 'col_updated', name: 'updated_at', pk: false, type: 'TIMESTAMP', desc: 'Last activity time' },
    ]
  },
  {
    id: 'node_dim',
    name: 'DIM_CUSTOMERS',
    subtitle: 'dbt Model',
    tool: 'dbt Model',
    type: 'transform',
    icon: '🟧',
    status: 'Success',
    badgeColor: '#059669',
    badgeBg: '#ECFDF5',
    themeColor: '#8B5CF6',
    headerBg: '#F5F3FF',
    borderColor: '#C4B5FD',
    x: 580,
    y: 40,
    columns: [
      { id: 'col_id', name: 'customer_id (PK)', pk: true, type: 'BIGINT', desc: 'Primary Key dimension identifier' },
      { id: 'col_name', name: 'full_name', pk: false, type: 'VARCHAR', desc: 'Formatted full name' },
      { id: 'col_email', name: 'email', pk: false, type: 'VARCHAR', desc: 'Verified customer email' },
      { id: 'col_country', name: 'country', pk: false, type: 'VARCHAR', desc: 'Billing country code' },
      { id: 'col_signup', name: 'signup_date', pk: false, type: 'DATE', desc: 'Account registration date' },
      { id: 'col_updated', name: 'last_updated', pk: false, type: 'TIMESTAMP', desc: 'Dimension refresh timestamp' },
      { id: 'col_tier', name: 'customer_tier', pk: false, type: 'VARCHAR', desc: 'Calculated tier (Gold/Silver)' },
      { id: 'col_status', name: 'is_active', pk: false, type: 'BOOLEAN', desc: 'Current active flag' },
      { id: 'col_source', name: 'record_source', pk: false, type: 'VARCHAR', desc: 'Origin system tag' },
    ]
  },
  {
    id: 'node_mart',
    name: 'MART.DIM_CUSTOMERS',
    subtitle: 'Snowflake Table',
    tool: 'Snowflake Table',
    type: 'target',
    icon: '❄️',
    status: 'Healthy',
    badgeColor: '#059669',
    badgeBg: '#ECFDF5',
    themeColor: '#10B981',
    headerBg: '#ECFDF5',
    borderColor: '#A7F3D0',
    x: 860,
    y: 40,
    columns: [
      { id: 'col_id', name: 'customer_id (PK)', pk: true, type: 'BIGINT', desc: 'Published Primary Key' },
      { id: 'col_name', name: 'full_name', pk: false, type: 'VARCHAR', desc: 'Published customer name' },
      { id: 'col_email', name: 'email', pk: false, type: 'VARCHAR', desc: 'Published customer email' },
      { id: 'col_country', name: 'country', pk: false, type: 'VARCHAR', desc: 'Customer billing country' },
      { id: 'col_signup', name: 'signup_date', pk: false, type: 'DATE', desc: 'Registration date' },
      { id: 'col_updated', name: 'last_updated', pk: false, type: 'TIMESTAMP', desc: 'Warehouse sync timestamp' },
      { id: 'col_tier', name: 'customer_tier', pk: false, type: 'VARCHAR', desc: 'Loyalty status tier' },
      { id: 'col_status', name: 'is_active', pk: false, type: 'BOOLEAN', desc: 'Published active status' },
      { id: 'col_source', name: 'record_source', pk: false, type: 'VARCHAR', desc: 'Data provenance marker' },
    ]
  }
];

export default function Lineage() {
  const [level, setLevel] = useState('column'); // 'table' | 'column'
  const [selectedColumnId, setSelectedColumnId] = useState('col_id');
  const [showOnlyAffected, setShowOnlyAffected] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(true);

  // Lineage Breadcrumb Information for Right Drawer
  const selectedDetails = useMemo(() => {
    return {
      name: selectedColumnId === 'col_id' ? 'customer_id' : selectedColumnId === 'col_name' ? 'customer_name' : 'email',
      type: selectedColumnId === 'col_id' ? 'BIGINT' : 'VARCHAR',
      desc: selectedColumnId === 'col_id' ? 'Unique identifier of customer' : 'Customer profile attribute',
      lastUpdated: '2 mins ago',
      quality: 99.8,
      nulls: '0 (0%)',
      distinct: '1,265,543',
      status: 'Healthy',
      sql: selectedColumnId === 'col_id'
        ? 'CAST(customer_id AS BIGINT)'
        : selectedColumnId === 'col_name'
        ? 'TRIM(name) AS full_name'
        : 'LOWER(TRIM(email)) AS email',
      transformationType: 'CAST',
      computedBy: 'dbt Model: stg_customers.sql'
    };
  }, [selectedColumnId]);

  return (
    <div className="fade-in">
      <PageHeader
        title="Lineage"
        subtitle="Track data flow and transformations across your data estate"
      />

      <div className="page-body">
        {/* ── TOP CONTROL BAR (MATCHING REFERENCE SCREENSHOT) ─────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap', padding: '10px 16px', background: 'var(--bg-card)',
          border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          {/* Level Switcher (Table Level vs Column Level) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F1F5F9', padding: 3, borderRadius: 8 }}>
            <button
              onClick={() => setLevel('table')}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                background: level === 'table' ? '#FFFFFF' : 'transparent',
                color: level === 'table' ? '#0F172A' : '#64748B',
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
                color: level === 'column' ? '#4F46E5' : '#64748B',
                boxShadow: level === 'column' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Column Level
            </button>
          </div>

          {/* Lineage Type Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
            <span style={{ fontWeight: 600, color: '#64748B' }}>Lineage Type:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6' }} />
              <span style={{ color: '#0F172A', fontWeight: 500 }}>Source</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6' }} />
              <span style={{ color: '#0F172A', fontWeight: 500 }}>Transformation</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
              <span style={{ color: '#0F172A', fontWeight: 500 }}>Target</span>
            </div>
          </div>

          {/* Search Box */}
          <div className="search-box" style={{ width: 220 }}>
            <Search size={13} />
            <input
              type="text"
              placeholder="Search dataset, table or column..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ height: 32, fontSize: 12, paddingLeft: 30 }}
            />
          </div>

          {/* Controls: Show Affected Toggle, Expand All, Zoom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748B', cursor: 'pointer' }}>
              <span>Show Only Affected</span>
              <input
                type="checkbox"
                checked={showOnlyAffected}
                onChange={e => setShowOnlyAffected(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
            </label>

            <button
              className="export-btn"
              style={{ fontSize: 11.5, padding: '4px 10px', height: 28 }}
            >
              Expand All
            </button>

            {/* Zoom Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#F1F5F9', borderRadius: 6, padding: 2 }}>
              <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => setZoomLevel(z => Math.max(60, z - 10))} title="Zoom Out">
                <ZoomOut size={12} />
              </button>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '0 4px', minWidth: 36, textAlign: 'center' }}>{zoomLevel}%</span>
              <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => setZoomLevel(z => Math.min(140, z + 10))} title="Zoom In">
                <ZoomIn size={12} />
              </button>
              <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => setZoomLevel(100)} title="Reset Zoom">
                <Maximize2 size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* ── CANVAS & DETAILS DRAWER ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', position: 'relative' }}>
          {/* ── INTERACTIVE CANVAS WITH SVG SPLINES ───────────────────────────── */}
          <div style={{
            flex: 1, minWidth: 0, background: '#FFFFFF', border: '1px solid #E2E8F0',
            borderRadius: 12, padding: 28, overflowX: 'auto', minHeight: 680, position: 'relative',
            backgroundImage: 'radial-gradient(#E2E8F0 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}>
            {/* SVG Interactive Column-to-Column Connecting Bezier Splines */}
            <svg
              style={{
                position: 'absolute', top: 0, left: 0, width: 1200, height: 700,
                pointerEvents: 'none', zIndex: 1,
                transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left'
              }}
            >
              <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#6366F1" floodOpacity="0.4" />
                </filter>
              </defs>

              {/* Inactive Splines (Faint Grey Bezier Curves) */}
              {level === 'column' && (
                <>
                  <path d="M 235 140 C 265 140, 275 140, 305 140" fill="none" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3 3" />
                  <path d="M 235 162 C 265 162, 275 162, 305 162" fill="none" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3 3" />
                  <path d="M 235 184 C 265 184, 275 184, 305 184" fill="none" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3 3" />
                  <path d="M 235 206 C 265 206, 275 206, 305 206" fill="none" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3 3" />

                  <path d="M 515 140 C 545 140, 555 140, 585 140" fill="none" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3 3" />
                  <path d="M 515 162 C 545 162, 555 162, 585 162" fill="none" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3 3" />
                  <path d="M 515 184 C 545 184, 555 184, 585 184" fill="none" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3 3" />

                  <path d="M 795 140 C 825 140, 835 140, 865 140" fill="none" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3 3" />
                  <path d="M 795 162 C 825 162, 835 162, 865 162" fill="none" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3 3" />

                  {/* Sub-model branch spline */}
                  <path d="M 515 480 C 555 480, 555 220, 585 220" fill="none" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3 3" />
                </>
              )}

              {/* Active Highlighted Spline for selectedColumnId (Vibrant Purple Glowing Bezier Curve matching screenshot) */}
              {level === 'column' && selectedColumnId === 'col_id' && (
                <>
                  <path
                    d="M 235 118 C 270 118, 270 118, 305 118"
                    fill="none"
                    stroke="#6366F1"
                    strokeWidth="2.5"
                    filter="url(#glow)"
                  />
                  <circle cx="235" cy="118" r="3.5" fill="#6366F1" />
                  <circle cx="305" cy="118" r="3.5" fill="#6366F1" />

                  <path
                    d="M 515 118 C 550 118, 550 118, 585 118"
                    fill="none"
                    stroke="#6366F1"
                    strokeWidth="2.5"
                    filter="url(#glow)"
                  />
                  <circle cx="515" cy="118" r="3.5" fill="#6366F1" />
                  <circle cx="585" cy="118" r="3.5" fill="#6366F1" />

                  <path
                    d="M 795 118 C 830 118, 830 118, 865 118"
                    fill="none"
                    stroke="#6366F1"
                    strokeWidth="2.5"
                    filter="url(#glow)"
                  />
                  <circle cx="795" cy="118" r="3.5" fill="#6366F1" />
                  <circle cx="865" cy="118" r="3.5" fill="#6366F1" />
                </>
              )}
            </svg>

            {/* Nodes Container Layout */}
            <div style={{
              position: 'relative', minWidth: 1100, minHeight: 620, zIndex: 2,
              transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left',
              transition: 'transform 0.15s ease'
            }}>
              {LINEAGE_NODES.map(node => (
                <div
                  key={node.id}
                  style={{
                    position: 'absolute', left: node.x, top: node.y, width: 215,
                    background: '#FFFFFF', borderRadius: 10, border: `1.5px solid ${node.borderColor}`,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.04)', overflow: 'hidden',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Node Header */}
                  <div style={{ padding: '10px 12px', background: node.headerBg, borderBottom: `1px solid ${node.borderColor}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{node.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: node.themeColor }}>{node.subtitle}</span>
                      </div>
                      <span style={{
                        fontSize: 9.5, fontWeight: 700, color: node.badgeColor,
                        background: '#FFFFFF', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border)'
                      }}>
                        ● {node.status}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0F172A' }}>
                      {node.name}
                    </div>
                  </div>

                  {/* Node Columns (Column Level View) */}
                  {level === 'column' && (
                    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#64748B' }}>
                        Columns ({node.columns.length})
                      </span>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {node.columns.map(col => {
                          const isSelected = selectedColumnId === col.id;

                          return (
                            <div
                              key={col.name}
                              onClick={() => {
                                setSelectedColumnId(col.id);
                                setDrawerOpen(true);
                              }}
                              style={{
                                padding: '3px 8px', borderRadius: 4, fontSize: 11,
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: isSelected ? '#EDE9FE' : 'transparent',
                                border: isSelected ? '1px solid #C4B5FD' : '1px solid transparent',
                                color: isSelected ? '#5B21B6' : '#1E293B',
                                fontWeight: isSelected ? 700 : 500, cursor: 'pointer',
                                transition: 'all 0.1s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? '#7C3AED' : '#94A3B8' }} />
                                <span style={{ fontFamily: 'monospace', fontSize: 10.5 }}>{col.name}</span>
                              </div>
                              {isSelected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7C3AED' }} />}
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ fontSize: 10, color: '#6366F1', fontWeight: 600, marginTop: 4, textAlign: 'left', cursor: 'pointer' }}>
                        + View All Columns
                      </div>
                    </div>
                  )}

                  {/* Table Level View */}
                  {level === 'table' && (
                    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                        <span>Role:</span>
                        <strong style={{ color: '#0F172A' }}>{node.type.toUpperCase()}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                        <span>Columns:</span>
                        <strong style={{ color: '#0F172A' }}>{node.columns.length} attributes</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                        <span>Verified Status:</span>
                        <strong style={{ color: '#10B981' }}>Healthy</strong>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Floating Mini-Map Box (Matching Reference Image bottom left) */}
            <div style={{
              position: 'absolute', bottom: 16, left: 16, width: 140, height: 75,
              background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)', padding: 8, display: 'flex',
              alignItems: 'center', justifyContent: 'space-between', gap: 6, zIndex: 10
            }}>
              <div style={{ width: 22, height: 42, background: '#BFDBFE', borderRadius: 3 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ width: 22, height: 20, background: '#DDD6FE', borderRadius: 3 }} />
                <div style={{ width: 22, height: 18, background: '#DDD6FE', borderRadius: 3 }} />
              </div>
              <div style={{ width: 22, height: 42, background: '#DDD6FE', borderRadius: 3 }} />
              <div style={{ width: 22, height: 42, background: '#A7F3D0', borderRadius: 3 }} />
              <div style={{
                position: 'absolute', inset: 6, border: '1.5px dashed #6366F1',
                borderRadius: 6, pointerEvents: 'none'
              }} />
            </div>
          </div>

          {/* ── RIGHT DRAWER: COLUMN LINEAGE DETAILS (MATCHING SCREENSHOT) ────── */}
          {drawerOpen && (
            <div style={{
              width: 320, background: '#FFFFFF', border: '1px solid #E2E8F0',
              borderRadius: 12, padding: 18, boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              display: 'flex', flexDirection: 'column', gap: 14
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A' }}>
                  Column Lineage Details
                </span>
                <button className="icon-btn" onClick={() => setDrawerOpen(false)} style={{ width: 24, height: 24 }}>
                  <X size={14} />
                </button>
              </div>

              {/* Selected Column */}
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Selected Column</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                    <FileText size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>
                      {selectedDetails.name}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748B' }}>
                      {selectedDetails.type}
                    </div>
                  </div>
                </div>
              </div>

              {/* Lineage Path */}
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Lineage Path</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6, paddingLeft: 8, borderLeft: '2px solid #E2E8F0' }}>
                  <div style={{ fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: '#2563EB' }}>RAW.CUSTOMERS</div>
                    <div style={{ color: '#64748B', fontSize: 10.5 }}>{selectedDetails.name} &bull; Source Table</div>
                  </div>
                  <div style={{ fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: '#7C3AED' }}>STG_CUSTOMERS</div>
                    <div style={{ color: '#64748B', fontSize: 10.5 }}>{selectedDetails.name} &bull; dbt Model</div>
                  </div>
                  <div style={{ fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: '#7C3AED' }}>DIM_CUSTOMERS</div>
                    <div style={{ color: '#64748B', fontSize: 10.5 }}>{selectedDetails.name} &bull; dbt Model</div>
                  </div>
                  <div style={{ fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: '#059669' }}>MART.DIM_CUSTOMERS</div>
                    <div style={{ color: '#64748B', fontSize: 10.5 }}>{selectedDetails.name} &bull; Snowflake Table</div>
                  </div>
                </div>
              </div>

              {/* Column Details */}
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Column Details</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, fontSize: 11.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Data Type:</span>
                    <strong style={{ fontFamily: 'monospace' }}>{selectedDetails.type}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Description:</span>
                    <span style={{ fontSize: 11, color: '#0F172A', textAlign: 'right', maxWidth: 170 }}>{selectedDetails.desc}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Last Updated:</span>
                    <span>{selectedDetails.lastUpdated}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748B' }}>Data Quality:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong style={{ color: '#10B981' }}>{selectedDetails.quality}%</strong>
                      <div style={{ width: 50, height: 5, background: '#E2E8F0', borderRadius: 99 }}>
                        <div style={{ width: `${selectedDetails.quality}%`, height: '100%', background: '#10B981', borderRadius: 99 }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Nulls:</span>
                    <strong style={{ color: '#10B981' }}>{selectedDetails.nulls}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Distinct Values:</span>
                    <strong>{selectedDetails.distinct}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Status:</span>
                    <span style={{ color: '#10B981', fontWeight: 600 }}>● {selectedDetails.status}</span>
                  </div>
                </div>
              </div>

              {/* Transformation Code Block */}
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Transformation</span>
                <div style={{
                  marginTop: 6, padding: '8px 10px', background: '#F8FAFC',
                  color: '#2563EB', borderRadius: 6, fontFamily: 'monospace',
                  fontSize: 11, lineHeight: 1.4, border: '1px solid #E2E8F0'
                }}>
                  {selectedDetails.sql}
                </div>
                <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 4 }}>
                  Transformation Type: <strong>{selectedDetails.transformationType}</strong>
                </div>
                <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>
                  Computed By: <code>{selectedDetails.computedBy}</code>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
