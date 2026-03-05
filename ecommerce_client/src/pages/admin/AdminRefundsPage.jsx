import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { adminAPI } from '../../services/api.service'
import { toast } from 'react-hot-toast'

// ── Status metadata ──────────────────────────────────────────────────────────
const STATUS_META = {
  pending:         { label: 'Pending Review',   color: '#92400E', bg: '#FEF3C7', icon: '⏳' },
  approved:        { label: 'Approved',          color: '#065F46', bg: '#D1FAE5', icon: '✅' },
  return_shipped:  { label: 'Return Shipped',    color: '#1E40AF', bg: '#DBEAFE', icon: '📦' },
  return_received: { label: 'Item Received',     color: '#4C1D95', bg: '#EDE9FE', icon: '🏭' },
  inspecting:      { label: 'Under Inspection',  color: '#9A3412', bg: '#FFEDD5', icon: '🔍' },
  completed:       { label: 'Refund Issued',     color: '#065F46', bg: '#ECFDF5', icon: '💰' },
  rejected:        { label: 'Rejected',          color: '#991B1B', bg: '#FEE2E2', icon: '❌' },
  cancelled:       { label: 'Cancelled',         color: '#374151', bg: '#F3F4F6', icon: '🚫' },
}

const ALL_STATUSES = [
  { value: 'all',            label: 'All Statuses' },
  { value: 'pending',        label: 'Pending Review' },
  { value: 'approved',       label: 'Approved' },
  { value: 'return_shipped', label: 'Return Shipped' },
  { value: 'return_received',label: 'Item Received' },
  { value: 'inspecting',     label: 'Under Inspection' },
  { value: 'completed',      label: 'Refund Issued' },
  { value: 'rejected',       label: 'Rejected' },
  { value: 'cancelled',      label: 'Cancelled' },
]

const fmtDate = (ts) => ts
  ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—'

const fmtMoney = (n) => n != null ? `$${Number(n).toFixed(2)}` : '—'

// ── Modal component ──────────────────────────────────────────────────────────
const Modal = ({ title, children, onClose }) => (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16
  }}>
    <div style={{
      background: 'white', borderRadius: 10, padding: 28,
      width: 460, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9CA3AF', lineHeight: 1 }}>×</button>
      </div>
      {children}
    </div>
  </div>
)

// ── Main component ────────────────────────────────────────────────────────────
const AdminRefundsPage = () => {
  const [returns, setReturns]   = useState([])
  const [stats, setStats]       = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [loading, setLoading]   = useState(true)
  const [actionLoading, setActionLoading] = useState(null) // returnId being actioned

  // Modals
  const [approveModal, setApproveModal]   = useState(null) // { id, orderAmount }
  const [rejectModal, setRejectModal]     = useState(null) // { id }
  const [completeModal, setCompleteModal] = useState(null) // { id, refundAmount }
  const [expandedId, setExpandedId]       = useState(null)

  // Form fields
  const [refundAmount, setRefundAmount]         = useState('')
  const [rejectionReason, setRejectionReason]   = useState('')
  const [txId, setTxId]                         = useState('')

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const params = filterStatus !== 'all' ? { status: filterStatus } : {}
      const [returnsRes, statsRes] = await Promise.allSettled([
        adminAPI.getReturns(params),
        adminAPI.getReturnStats()
      ])

      if (returnsRes.status === 'fulfilled') {
        const r = returnsRes.value
        let data = []
        if (Array.isArray(r))              data = r
        else if (r?.returns)               data = r.returns
        else if (Array.isArray(r?.data))   data = r.data
        setReturns(data)
      } else {
        toast.error('Failed to load returns')
        setReturns([])
      }

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value)
      } else {
        // Derive stats from loaded returns as fallback
        setStats(null)
      }
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Derived stats fallback if API endpoint missing
  const derivedStats = stats || returns.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    if (r.status === 'completed' && r.refund_amount) acc.total_refund_amount = (acc.total_refund_amount || 0) + Number(r.refund_amount)
    return acc
  }, {})

  // ── Action handlers ────────────────────────────────────────────────────────
  const runAction = async (returnId, fn, successMsg) => {
    setActionLoading(returnId)
    try {
      await fn()
      toast.success(successMsg)
      await fetchAll()
    } catch (err) {
      toast.error(err.message || 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleApprove = async () => {
    const amount = parseFloat(refundAmount)
    if (!amount || amount <= 0) { toast.error('Enter a valid refund amount > 0'); return }
    await runAction(approveModal.id,
      () => adminAPI.approveReturn(approveModal.id, amount),
      'Return approved — customer will be notified'
    )
    setApproveModal(null); setRefundAmount('')
  }

  const handleReject = async () => {
    await runAction(rejectModal.id,
      () => adminAPI.rejectReturn(rejectModal.id, rejectionReason.trim() || null),
      'Return request rejected'
    )
    setRejectModal(null); setRejectionReason('')
  }

  const handleMarkReceived = (id) =>
    runAction(id, () => adminAPI.markReturnReceived(id), 'Marked as received at warehouse')

  const handleMarkInspecting = (id) =>
    runAction(id, () => adminAPI.markReturnInspecting(id), 'Inspection started')

  const handleComplete = async () => {
    await runAction(completeModal.id,
      () => adminAPI.completeReturn(completeModal.id, txId.trim() || null),
      'Refund issued — return completed!'
    )
    setCompleteModal(null); setTxId('')
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getCustomerName = (r) =>
    r.customer?.display_name || r.customer?.email ||
    (r.customer_id ? '#' + r.customer_id.substring(0, 8) : 'Unknown')

  const busy = (id) => actionLoading === id

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading && returns.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
        <div style={{ color: '#565959', fontSize: 16 }}>Loading return requests...</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>

      {/* ── Approve Modal ── */}
      {approveModal && (
        <Modal title="Approve Return Request" onClose={() => { setApproveModal(null); setRefundAmount('') }}>
          <p style={{ color: '#565959', fontSize: 14, marginBottom: 16 }}>
            Set the refund amount the customer will receive. After approval, the customer must ship the item back within 7 days.
          </p>
          {approveModal.orderAmount && (
            <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 13 }}>
              Order total: <strong>{fmtMoney(approveModal.orderAmount)}</strong>
            </div>
          )}
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
            Refund Amount ($) <span style={{ color: '#C7511F' }}>*</span>
          </label>
          <input
            type="number" min="0.01" step="0.01"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            placeholder="e.g. 29.99"
            autoFocus
            style={{ width: '100%', border: '1px solid #D5D9D9', borderRadius: 4, padding: '9px 12px', fontSize: 14, boxSizing: 'border-box', marginBottom: 20 }}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => { setApproveModal(null); setRefundAmount('') }}
              style={{ background: '#F3F4F6', border: '1px solid #D5D9D9', borderRadius: 4, padding: '9px 20px', cursor: 'pointer', fontWeight: 600 }}>
              Cancel
            </button>
            <button onClick={handleApprove} disabled={busy(approveModal.id)}
              style={{ background: '#10B981', color: 'white', border: 'none', borderRadius: 4, padding: '9px 22px', cursor: 'pointer', fontWeight: 700, opacity: busy(approveModal.id) ? 0.6 : 1 }}>
              {busy(approveModal.id) ? 'Approving…' : 'Confirm Approval'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Reject Modal ── */}
      {rejectModal && (
        <Modal title="Reject Return Request" onClose={() => { setRejectModal(null); setRejectionReason('') }}>
          <p style={{ color: '#565959', fontSize: 14, marginBottom: 16 }}>
            The customer will be notified. Provide a reason to help them understand the decision.
          </p>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
            Rejection Reason <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="e.g. Item not eligible for return (beyond 30 days)..."
            rows={3} autoFocus
            style={{ width: '100%', border: '1px solid #D5D9D9', borderRadius: 4, padding: '9px 12px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', marginBottom: 20 }}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => { setRejectModal(null); setRejectionReason('') }}
              style={{ background: '#F3F4F6', border: '1px solid #D5D9D9', borderRadius: 4, padding: '9px 20px', cursor: 'pointer', fontWeight: 600 }}>
              Cancel
            </button>
            <button onClick={handleReject} disabled={busy(rejectModal.id)}
              style={{ background: '#EF4444', color: 'white', border: 'none', borderRadius: 4, padding: '9px 22px', cursor: 'pointer', fontWeight: 700, opacity: busy(rejectModal.id) ? 0.6 : 1 }}>
              {busy(rejectModal.id) ? 'Rejecting…' : 'Confirm Rejection'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Complete / Issue Refund Modal ── */}
      {completeModal && (
        <Modal title="Issue Refund & Complete Return" onClose={() => { setCompleteModal(null); setTxId('') }}>
          <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 6, padding: '10px 14px', fontSize: 14, color: '#065F46', marginBottom: 16 }}>
            Refund amount approved: <strong>{fmtMoney(completeModal.refundAmount)}</strong>
          </div>
          <p style={{ color: '#565959', fontSize: 14, marginBottom: 16 }}>
            Confirm that the refund has been processed. Optionally enter a Stripe transaction ID for records.
          </p>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
            Stripe Transaction ID <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            type="text"
            value={txId}
            onChange={(e) => setTxId(e.target.value)}
            placeholder="e.g. ch_3OaBC..."
            autoFocus
            style={{ width: '100%', border: '1px solid #D5D9D9', borderRadius: 4, padding: '9px 12px', fontSize: 14, boxSizing: 'border-box', marginBottom: 20, fontFamily: 'monospace' }}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => { setCompleteModal(null); setTxId('') }}
              style={{ background: '#F3F4F6', border: '1px solid #D5D9D9', borderRadius: 4, padding: '9px 20px', cursor: 'pointer', fontWeight: 600 }}>
              Cancel
            </button>
            <button onClick={handleComplete} disabled={busy(completeModal.id)}
              style={{ background: '#059669', color: 'white', border: 'none', borderRadius: 4, padding: '9px 22px', cursor: 'pointer', fontWeight: 700, opacity: busy(completeModal.id) ? 0.6 : 1 }}>
              {busy(completeModal.id) ? 'Processing…' : 'Issue Refund'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 6px' }}>Returns &amp; Refunds</h1>
        <p style={{ color: '#565959', margin: 0 }}>Review and process customer return requests — Amazon-style workflow</p>
      </div>

      {/* ── Stats Bar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Returns',  value: derivedStats.total_returns ?? returns.length,         color: '#1D4ED8' },
          { label: 'Pending',        value: derivedStats.pending  ?? 0,                           color: '#D97706' },
          { label: 'Approved',       value: derivedStats.approved ?? 0,                           color: '#059669' },
          { label: 'Received',       value: derivedStats.return_received ?? 0,                    color: '#7C3AED' },
          { label: 'Inspecting',     value: derivedStats.inspecting ?? 0,                         color: '#EA580C' },
          { label: 'Completed',      value: derivedStats.completed ?? 0,                          color: '#16A34A' },
          { label: 'Rejected',       value: derivedStats.rejected ?? 0,                           color: '#DC2626' },
          { label: 'Refunded',       value: fmtMoney(derivedStats.total_refund_amount ?? 0),      color: '#059669', wide: true },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', border: '1px solid #D5D9D9', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#565959', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filter + Refresh ── */}
      <div style={{ background: 'white', border: '1px solid #D5D9D9', borderRadius: 8, padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 600, fontSize: 14 }}>Filter by status:</label>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ border: '1px solid #D5D9D9', borderRadius: 4, padding: '7px 12px', fontSize: 14 }}
        >
          {ALL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button
          onClick={fetchAll}
          disabled={loading}
          style={{ marginLeft: 'auto', background: '#FF9900', color: 'white', border: 'none', borderRadius: 4, padding: '8px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* ── Returns List ── */}
      {returns.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #D5D9D9', borderRadius: 8, padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No return requests found</div>
          <div style={{ color: '#565959', marginTop: 6 }}>
            {filterStatus !== 'all' ? `No returns with status "${filterStatus}"` : 'No returns have been submitted yet'}
          </div>
        </div>
      ) : (
        returns.map(r => {
          const meta = STATUS_META[r.status] || STATUS_META.pending
          const isExpanded = expandedId === r.id
          const isBusy = busy(r.id)

          return (
            <div key={r.id} style={{ background: 'white', border: '1px solid #D5D9D9', borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
              {/* ── Card Header ── */}
              <div style={{
                background: '#F7F8F8', borderBottom: '1px solid #D5D9D9',
                padding: '12px 20px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', flexWrap: 'wrap', gap: 8
              }}>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Return ID */}
                  <div>
                    <div style={{ fontSize: 11, color: '#565959', fontWeight: 600, textTransform: 'uppercase' }}>Return ID</div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>
                      #{r.id?.substring(0, 8).toUpperCase()}
                    </div>
                  </div>
                  {/* Order */}
                  <div>
                    <div style={{ fontSize: 11, color: '#565959', fontWeight: 600, textTransform: 'uppercase' }}>Order</div>
                    <Link to={`/admin/orders/${r.order_id}`} style={{ fontSize: 13, color: '#007185', fontWeight: 600, textDecoration: 'none' }}>
                      #{r.order_id?.substring(0, 8).toUpperCase()}
                    </Link>
                  </div>
                  {/* Customer */}
                  <div>
                    <div style={{ fontSize: 11, color: '#565959', fontWeight: 600, textTransform: 'uppercase' }}>Customer</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{getCustomerName(r)}</div>
                    {r.customer?.email && r.customer?.display_name && (
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{r.customer.email}</div>
                    )}
                  </div>
                  {/* Requested */}
                  <div>
                    <div style={{ fontSize: 11, color: '#565959', fontWeight: 600, textTransform: 'uppercase' }}>Requested</div>
                    <div style={{ fontSize: 13 }}>{fmtDate(r.created_at)}</div>
                  </div>
                  {/* Refund */}
                  {r.refund_amount != null && (
                    <div>
                      <div style={{ fontSize: 11, color: '#565959', fontWeight: 600, textTransform: 'uppercase' }}>Refund</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{fmtMoney(r.refund_amount)}</div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Status badge */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px', borderRadius: 20,
                    background: meta.bg, color: meta.color,
                    fontSize: 12, fontWeight: 700
                  }}>
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                  </div>
                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    style={{ background: 'none', border: '1px solid #D5D9D9', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: '#565959' }}
                  >
                    {isExpanded ? '▲ Less' : '▼ More'}
                  </button>
                </div>
              </div>

              {/* ── Card Body ── */}
              <div style={{ padding: '14px 20px' }}>
                {/* Reason */}
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#565959', textTransform: 'uppercase' }}>Reason: </span>
                  <span style={{ fontSize: 14 }}>{r.reason || 'No reason provided'}</span>
                </div>

                {/* Rejection reason */}
                {r.status === 'rejected' && r.rejection_reason && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 12 }}>
                    <strong>Rejection Reason:</strong> {r.rejection_reason}
                  </div>
                )}

                {/* Inspection notes */}
                {r.inspection_notes && (
                  <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#9A3412', marginBottom: 12 }}>
                    <strong>Inspection Notes:</strong> {r.inspection_notes}
                    {r.inspection_passed === false && <span style={{ marginLeft: 8, fontWeight: 700 }}> — FAILED</span>}
                  </div>
                )}

                {/* Tracking info */}
                {r.return_tracking_number && (
                  <div style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
                    <span style={{ fontWeight: 600 }}>Return Tracking: </span>
                    <span style={{ fontFamily: 'monospace', color: '#C2410C' }}>{r.return_tracking_number}</span>
                    {r.return_carrier && <span style={{ color: '#6B7280' }}> via {r.return_carrier}</span>}
                  </div>
                )}

                {/* Expanded timestamps */}
                {isExpanded && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: '#6B7280', background: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: 6, padding: '10px 14px', marginBottom: 12 }}>
                    <span>Submitted: {fmtDate(r.created_at)}</span>
                    {r.approved_at && <span>Approved: {fmtDate(r.approved_at)}</span>}
                    {r.return_received_at && <span>Received: {fmtDate(r.return_received_at)}</span>}
                    {r.inspected_at && <span>Inspected: {fmtDate(r.inspected_at)}</span>}
                    {r.completed_at && <span>Completed: {fmtDate(r.completed_at)}</span>}
                    {r.refund_transaction_id && (
                      <span>Txn ID: <span style={{ fontFamily: 'monospace', color: '#047857' }}>{r.refund_transaction_id}</span></span>
                    )}
                    {r.order?.amount && <span>Order Total: {fmtMoney(r.order.amount)}</span>}
                  </div>
                )}

                {/* ── Action Buttons per status ── */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>

                  {/* PENDING → Approve + Reject */}
                  {r.status === 'pending' && (
                    <>
                      <button
                        disabled={isBusy}
                        onClick={() => { setApproveModal({ id: r.id, orderAmount: r.order?.amount }); setRefundAmount(r.refund_amount ? String(r.refund_amount) : '') }}
                        style={{ background: '#10B981', color: 'white', border: 'none', borderRadius: 4, padding: '7px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: isBusy ? 0.6 : 1 }}
                      >
                        ✓ Approve Return
                      </button>
                      <button
                        disabled={isBusy}
                        onClick={() => setRejectModal({ id: r.id })}
                        style={{ background: '#EF4444', color: 'white', border: 'none', borderRadius: 4, padding: '7px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: isBusy ? 0.6 : 1 }}
                      >
                        ✗ Reject
                      </button>
                    </>
                  )}

                  {/* APPROVED → Mark Return Received */}
                  {r.status === 'approved' && (
                    <button
                      disabled={isBusy}
                      onClick={() => handleMarkReceived(r.id)}
                      style={{ background: '#8B5CF6', color: 'white', border: 'none', borderRadius: 4, padding: '7px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: isBusy ? 0.6 : 1 }}
                    >
                      {isBusy ? 'Updating…' : '🏭 Mark as Received'}
                    </button>
                  )}

                  {/* RETURN_RECEIVED → Start Inspection */}
                  {r.status === 'return_received' && (
                    <button
                      disabled={isBusy}
                      onClick={() => handleMarkInspecting(r.id)}
                      style={{ background: '#F97316', color: 'white', border: 'none', borderRadius: 4, padding: '7px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: isBusy ? 0.6 : 1 }}
                    >
                      {isBusy ? 'Updating…' : '🔍 Start Inspection'}
                    </button>
                  )}

                  {/* INSPECTING → Issue Refund / Complete */}
                  {r.status === 'inspecting' && (
                    <>
                      <button
                        disabled={isBusy}
                        onClick={() => setCompleteModal({ id: r.id, refundAmount: r.refund_amount })}
                        style={{ background: '#059669', color: 'white', border: 'none', borderRadius: 4, padding: '7px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: isBusy ? 0.6 : 1 }}
                      >
                        💰 Issue Refund &amp; Complete
                      </button>
                      <button
                        disabled={isBusy}
                        onClick={() => setRejectModal({ id: r.id })}
                        style={{ background: 'none', border: '1px solid #EF4444', color: '#EF4444', borderRadius: 4, padding: '7px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: isBusy ? 0.6 : 1 }}
                      >
                        Failed Inspection
                      </button>
                    </>
                  )}

                  {/* COMPLETED — show refund transaction */}
                  {r.status === 'completed' && (
                    <div style={{ fontSize: 13, color: '#065F46', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>💰 Refund of <strong>{fmtMoney(r.refund_amount)}</strong> issued</span>
                      {r.refund_processed_at && <span style={{ color: '#6B7280' }}>on {fmtDate(r.refund_processed_at)}</span>}
                    </div>
                  )}

                  {/* REJECTED — no further actions */}
                  {r.status === 'rejected' && (
                    <div style={{ fontSize: 13, color: '#991B1B' }}>
                      ❌ Return request was rejected
                    </div>
                  )}

                  {/* CANCELLED — no further actions */}
                  {r.status === 'cancelled' && (
                    <div style={{ fontSize: 13, color: '#6B7280' }}>
                      🚫 Cancelled by customer
                    </div>
                  )}

                  {/* RETURN_SHIPPED — waiting for arrival */}
                  {r.status === 'return_shipped' && (
                    <div style={{ fontSize: 13, color: '#1E40AF', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>📦 Item shipped back — awaiting warehouse arrival</span>
                      <button
                        disabled={isBusy}
                        onClick={() => handleMarkReceived(r.id)}
                        style={{ background: '#8B5CF6', color: 'white', border: 'none', borderRadius: 4, padding: '5px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: isBusy ? 0.6 : 1 }}
                      >
                        {isBusy ? '…' : 'Mark Received'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

export default AdminRefundsPage
