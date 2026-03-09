import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { sellerAPI } from '../../services/api.service'

const STATUS_META = {
  pending: { label: 'Pending Review', color: '#D97706', bg: '#FEF3C7', icon: '⏳', step: 1 },
  approved: { label: 'Approved', color: '#059669', bg: '#D1FAE5', icon: '✅', step: 2 },
  return_shipped: { label: 'Buyer Shipped Return', color: '#2563EB', bg: '#DBEAFE', icon: '📦', step: 3 },
  return_received: { label: 'Return Received', color: '#7C3AED', bg: '#EDE9FE', icon: '🏭', step: 4 },
  replacement_shipped: { label: 'Replacement Shipped', color: '#EA580C', bg: '#FFEDD5', icon: '🚚', step: 5 },
  completed: { label: 'Completed', color: '#047857', bg: '#D1FAE5', icon: '✔️', step: 6 },
  rejected: { label: 'Rejected', color: '#DC2626', bg: '#FEE2E2', icon: '❌', step: 0 },
  cancelled: { label: 'Cancelled', color: '#6B7280', bg: '#F3F4F6', icon: '🚫', step: 0 },
}

const STEPS = [
  { key: 'pending', label: 'Requested' },
  { key: 'approved', label: 'Approved' },
  { key: 'return_shipped', label: 'Return In Transit' },
  { key: 'return_received', label: 'Return Received' },
  { key: 'replacement_shipped', label: 'Replacement Sent' },
  { key: 'completed', label: 'Completed' },
]

const fmtDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const SellerReplacementsPage = () => {
  const [replacements, setReplacements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  // Shipment modal
  const [shipmentModal, setShipmentModal] = useState(null)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [carrier, setCarrier] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await sellerAPI.getReplacements()
      const data = res?.replacements || res?.data?.replacements || res?.data || (Array.isArray(res) ? res : [])
      setReplacements(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err?.message || 'Failed to load replacements')
    } finally {
      setLoading(false)
    }
  }

  // ─── Confirm return received ───────────────────────────────────
  const handleConfirmReturn = async (id) => {
    setActionLoading(true)
    try {
      await sellerAPI.confirmReplacementReturn(id)
      toast.success('Return receipt confirmed')
      fetchAll()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to confirm return')
    } finally {
      setActionLoading(false)
    }
  }

  // ─── Ship replacement ─────────────────────────────────────────
  const handleShipReplacement = async () => {
    if (!trackingNumber.trim()) {
      toast.error('Please enter a tracking number')
      return
    }
    setActionLoading(true)
    try {
      await sellerAPI.updateReplacementShipment(shipmentModal, {
        tracking_number: trackingNumber.trim(),
        carrier: carrier.trim() || undefined
      })
      toast.success('Replacement shipment updated')
      setShipmentModal(null)
      setTrackingNumber('')
      setCarrier('')
      fetchAll()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update shipment')
    } finally {
      setActionLoading(false)
    }
  }

  // ─── Filters ──────────────────────────────────────────────────
  const filtered = replacements.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      const matchId = String(r.id).toLowerCase().includes(q)
      const matchOrder = String(r.order_id || '').toLowerCase().includes(q)
      const matchReason = String(r.reason || '').toLowerCase().includes(q)
      if (!matchId && !matchOrder && !matchReason) return false
    }
    return true
  })

  // ─── Stats ────────────────────────────────────────────────────
  const statCounts = replacements.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    acc.total++
    return acc
  }, { total: 0 })

  // ─── Progress bar ─────────────────────────────────────────────
  const ProgressBar = ({ status }) => {
    const meta = STATUS_META[status] || STATUS_META.pending
    if (meta.step === 0) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0' }}>
          <span style={{ fontSize: 16 }}>{meta.icon}</span>
          <span style={{ fontWeight: 700, color: meta.color, fontSize: 13 }}>{meta.label}</span>
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '8px 0', overflowX: 'auto' }}>
        {STEPS.map((step, i) => {
          const done = meta.step > i
          const active = meta.step === i + 1
          const stepMeta = STATUS_META[step.key]
          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
              <div style={{ textAlign: 'center', minWidth: 56 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', margin: '0 auto 4px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done || active ? stepMeta.color : '#E5E7EB',
                  color: done || active ? '#fff' : '#9CA3AF',
                  fontSize: 12, fontWeight: 700,
                  border: active ? `2px solid ${stepMeta.color}` : '2px solid transparent',
                  boxShadow: active ? `0 0 0 3px ${stepMeta.color}22` : 'none',
                }}>
                  {done ? '✓' : active ? stepMeta.icon : i + 1}
                </div>
                <div style={{ fontSize: 10, color: done || active ? stepMeta.color : '#9CA3AF', fontWeight: done || active ? 600 : 400 }}>
                  {step.label}
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: done ? stepMeta.color : '#E5E7EB', margin: '0 2px', borderRadius: 1, minWidth: 16, marginTop: -12 }} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ─── Replacement card ─────────────────────────────────────────
  const ReplacementCard = ({ r }) => {
    const meta = STATUS_META[r.status] || STATUS_META.pending
    const isExpanded = expandedId === r.id
    return (
      <div style={{ background: '#fff', border: '1px solid #D5D9D9', borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
        {/* Card header */}
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: '#F7FAFA', borderBottom: '1px solid #E8E8E8', cursor: 'pointer', flexWrap: 'wrap', gap: 8 }}
          onClick={() => setExpandedId(isExpanded ? null : r.id)}
        >
          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#565959', flexWrap: 'wrap', alignItems: 'center' }}>
            <span><strong>#{String(r.id).substring(0, 8).toUpperCase()}</strong></span>
            <span>Order: #{String(r.order_id || '').substring(0, 8).toUpperCase()}</span>
            <span>{fmtDate(r.created_at)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              background: meta.bg, color: meta.color, fontWeight: 700,
              fontSize: 12, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap'
            }}>
              {meta.icon} {meta.label}
            </span>
            <span style={{ fontSize: 18, color: '#888', transition: 'transform .2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>▾</span>
          </div>
        </div>

        {/* Expanded body */}
        {isExpanded && (
          <div style={{ padding: '16px 20px' }}>
            <ProgressBar status={r.status} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '14px 0', fontSize: 14 }}>
              <div><span style={{ color: '#565959' }}>Reason:</span> <strong>{r.reason || '—'}</strong></div>
              {r.additional_details && (
                <div><span style={{ color: '#565959' }}>Details:</span> {r.additional_details}</div>
              )}
              {r.return_tracking_number && (
                <div><span style={{ color: '#565959' }}>Return Tracking:</span> <strong>{r.return_tracking_number}</strong></div>
              )}
              {r.replacement_tracking_number && (
                <div><span style={{ color: '#565959' }}>Replacement Tracking:</span> <strong>{r.replacement_tracking_number}</strong></div>
              )}
              {r.carrier && <div><span style={{ color: '#565959' }}>Carrier:</span> {r.carrier}</div>}
            </div>

            {/* Timestamps */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: '#565959', borderTop: '1px solid #F3F4F6', paddingTop: 10 }}>
              <span>Created: {fmtDate(r.created_at)}</span>
              {r.approved_at && <span>Approved: {fmtDate(r.approved_at)}</span>}
              {r.shipped_at && <span>Shipped: {fmtDate(r.shipped_at)}</span>}
              {r.completed_at && <span>Completed: {fmtDate(r.completed_at)}</span>}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              {/* Confirm return received */}
              {r.status === 'return_shipped' && (
                <button
                  onClick={() => handleConfirmReturn(r.id)}
                  disabled={actionLoading}
                  style={{ background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: actionLoading ? 0.6 : 1 }}
                >
                  {actionLoading ? 'Processing...' : '🏭 Confirm Return Received'}
                </button>
              )}

              {/* Ship replacement */}
              {r.status === 'return_received' && (
                <button
                  onClick={() => setShipmentModal(r.id)}
                  style={{ background: '#EA580C', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  🚚 Ship Replacement
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📦</div>
        <div style={{ color: '#565959', fontSize: 16 }}>Loading replacements...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <div style={{ color: '#DC2626', fontSize: 16, marginBottom: 12 }}>{error}</div>
        <button onClick={fetchAll} style={{ background: '#FF9900', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 20px', fontWeight: 700, cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 6px' }}>Replacement Requests</h1>
      <p style={{ color: '#565959', margin: '0 0 24px', fontSize: 14 }}>Manage customer replacement requests for your products</p>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { label: 'Total', count: statCounts.total, color: '#111' },
          { label: 'Pending', count: statCounts.pending || 0, color: '#D97706' },
          { label: 'Approved', count: statCounts.approved || 0, color: '#059669' },
          { label: 'Return Shipped', count: statCounts.return_shipped || 0, color: '#2563EB' },
          { label: 'Return Received', count: statCounts.return_received || 0, color: '#7C3AED' },
          { label: 'Replacement Sent', count: statCounts.replacement_shipped || 0, color: '#EA580C' },
          { label: 'Completed', count: statCounts.completed || 0, color: '#047857' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 18px', minWidth: 100, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 12, color: '#565959' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ border: '1px solid #D5D9D9', borderRadius: 4, padding: '8px 12px', fontSize: 14, background: '#fff', minWidth: 160 }}
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_META).map(([key, val]) => (
            <option key={key} value={key}>{val.icon} {val.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search by ID, order, or reason..."
          style={{ border: '1px solid #D5D9D9', borderRadius: 4, padding: '8px 12px', fontSize: 14, flex: 1, minWidth: 200 }}
        />
        <button onClick={fetchAll} style={{ background: 'none', border: '1px solid #D5D9D9', borderRadius: 4, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>
          🔄 Refresh
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #D5D9D9', borderRadius: 8, padding: '50px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔄</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>No replacement requests</h3>
          <p style={{ color: '#565959' }}>{statusFilter !== 'all' ? 'Try changing the filter.' : 'No customers have requested replacements yet.'}</p>
        </div>
      ) : (
        filtered.map(r => <ReplacementCard key={r.id} r={r} />)
      )}

      {/* ── Ship Replacement Modal ── */}
      {shipmentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }} onClick={() => setShipmentModal(null)}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 8px 30px rgba(0,0,0,.2)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 700 }}>🚚 Ship Replacement</h3>
            <p style={{ fontSize: 14, color: '#565959', marginBottom: 16 }}>Enter the tracking details for the replacement shipment.</p>

            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 14 }}>Tracking Number *</label>
            <input
              type="text"
              value={trackingNumber}
              onChange={e => setTrackingNumber(e.target.value)}
              placeholder="e.g. 1Z999AA10123456784"
              style={{ width: '100%', border: '1px solid #D5D9D9', borderRadius: 4, padding: '9px 12px', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }}
            />

            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 14 }}>Carrier (optional)</label>
            <select
              value={carrier}
              onChange={e => setCarrier(e.target.value)}
              style={{ width: '100%', border: '1px solid #D5D9D9', borderRadius: 4, padding: '9px 12px', fontSize: 14, marginBottom: 20, background: '#fff' }}
            >
              <option value="">Select carrier...</option>
              <option value="UPS">UPS</option>
              <option value="FedEx">FedEx</option>
              <option value="USPS">USPS</option>
              <option value="DHL">DHL</option>
              <option value="Other">Other</option>
            </select>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShipmentModal(null); setTrackingNumber(''); setCarrier('') }}
                style={{ background: 'none', border: '1px solid #D5D9D9', borderRadius: 4, padding: '8px 18px', fontSize: 14, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleShipReplacement}
                disabled={actionLoading}
                style={{ background: '#EA580C', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 22px', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: actionLoading ? 0.6 : 1 }}
              >
                {actionLoading ? 'Saving...' : 'Confirm Shipment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SellerReplacementsPage
