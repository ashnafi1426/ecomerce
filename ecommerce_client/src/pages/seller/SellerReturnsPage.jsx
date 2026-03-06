import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { sellerAPI } from '../../services/api.service'

// Amazon Seller Central style status flow
const STATUS_META = {
  pending:          { label: 'Pending Authorization', color: '#D97706', bg: '#FEF3C7', icon: '⏳', step: 1 },
  approved:         { label: 'Authorized',            color: '#059669', bg: '#D1FAE5', icon: '✅', step: 2 },
  return_shipped:   { label: 'Buyer Shipped',         color: '#2563EB', bg: '#DBEAFE', icon: '📦', step: 3 },
  return_received:  { label: 'Received',              color: '#7C3AED', bg: '#EDE9FE', icon: '🏭', step: 4 },
  inspecting:       { label: 'Inspecting',            color: '#EA580C', bg: '#FFEDD5', icon: '🔍', step: 5 },
  completed:        { label: 'Refund Issued',         color: '#047857', bg: '#D1FAE5', icon: '💰', step: 6 },
  rejected:         { label: 'Closed',                color: '#DC2626', bg: '#FEE2E2', icon: '❌', step: 0 },
  cancelled:        { label: 'Cancelled',             color: '#6B7280', bg: '#F3F4F6', icon: '🚫', step: 0 },
}

const STEPS = [
  { key: 'pending', label: 'Authorization' },
  { key: 'approved', label: 'Authorized' },
  { key: 'return_shipped', label: 'In Transit' },
  { key: 'return_received', label: 'Received' },
  { key: 'inspecting', label: 'Inspection' },
  { key: 'completed', label: 'Refund Issued' },
]

const SellerReturnsPage = () => {
  const [returns, setReturns] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  // Modal states
  const [authorizeModal, setAuthorizeModal] = useState(null)
  const [closeModal, setCloseModal] = useState(null)
  const [inspectModal, setInspectModal] = useState(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [closeReason, setCloseReason] = useState('')
  const [inspectionNotes, setInspectionNotes] = useState('')
  const [inspectionPassed, setInspectionPassed] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [returnsRes, statsRes] = await Promise.allSettled([
        sellerAPI.getReturns(),
        sellerAPI.getReturnStats()
      ])
      if (returnsRes.status === 'fulfilled') {
        const data = returnsRes.value
        setReturns(data?.returns || data?.data?.returns || (Array.isArray(data) ? data : []))
      }
      if (statsRes.status === 'fulfilled') {
        const data = statsRes.value
        setStats(data?.stats || data?.data?.stats || data || null)
      }
    } catch (err) {
      setError(err.message || 'Failed to load returns')
      toast.error('Failed to load returns')
    } finally {
      setLoading(false)
    }
  }

  const derivedStats = stats || (() => {
    const s = { total: returns.length, pending: 0, approved: 0, completed: 0, rejected: 0, this_month: 0, total_refunded: 0 }
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    returns.forEach(r => {
      if (r.status === 'pending') s.pending++
      else if (['approved', 'return_shipped', 'return_received', 'inspecting'].includes(r.status)) s.approved++
      else if (r.status === 'completed') s.completed++
      else if (r.status === 'rejected') s.rejected++
      if (new Date(r.created_at) >= thirtyDaysAgo) s.this_month++
      if (r.refund_amount && r.refund_status === 'completed') s.total_refunded += Number(r.refund_amount)
    })
    return s
  })()

  const getCustomerName = (r) => r.customer?.display_name || r.customer?.email || 'Unknown Customer'
  const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
  const fmtMoney = (n) => n != null ? `$${Number(n).toFixed(2)}` : '—'

  const filtered = returns.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const fields = [getCustomerName(r), r.id, r.order_id, r.reason].map(f => (f || '').toLowerCase())
      if (!fields.some(f => f.includes(term))) return false
    }
    return true
  })

  // ── ACTIONS ──────────────────────────────────────────────────────
  const handleAuthorize = async (e) => {
    e.preventDefault()
    if (!authorizeModal || !refundAmount || Number(refundAmount) <= 0) {
      toast.error('Enter a valid refund amount')
      return
    }
    setActionLoading(true)
    try {
      await sellerAPI.authorizeReturn(authorizeModal, Number(refundAmount))
      toast.success('Return authorized successfully!')
      setAuthorizeModal(null)
      setRefundAmount('')
      fetchAll()
    } catch (err) {
      toast.error(err.message || 'Failed to authorize return')
    } finally {
      setActionLoading(false)
    }
  }

  const handleClose = async (e) => {
    e.preventDefault()
    if (!closeModal || !closeReason.trim()) {
      toast.error('Please provide a reason for closing')
      return
    }
    setActionLoading(true)
    try {
      await sellerAPI.closeReturn(closeModal, closeReason.trim())
      toast.success('Return request closed')
      setCloseModal(null)
      setCloseReason('')
      fetchAll()
    } catch (err) {
      toast.error(err.message || 'Failed to close return')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReceive = async (id) => {
    if (!window.confirm('Confirm that you have received the returned item?')) return
    setActionLoading(true)
    try {
      await sellerAPI.markReturnReceived(id)
      toast.success('Item marked as received')
      fetchAll()
    } catch (err) {
      toast.error(err.message || 'Failed to mark as received')
    } finally {
      setActionLoading(false)
    }
  }

  const handleInspect = async (e) => {
    e.preventDefault()
    if (!inspectModal) return
    setActionLoading(true)
    try {
      await sellerAPI.inspectReturn(inspectModal, { inspectionNotes: inspectionNotes.trim(), inspectionPassed })
      toast.success('Inspection recorded')
      setInspectModal(null)
      setInspectionNotes('')
      setInspectionPassed(true)
      fetchAll()
    } catch (err) {
      toast.error(err.message || 'Failed to record inspection')
    } finally {
      setActionLoading(false)
    }
  }

  const handleIssueRefund = async (id) => {
    if (!window.confirm('Issue the refund to the customer? This will refund the money via Stripe.')) return
    setActionLoading(true)
    try {
      await sellerAPI.issueRefund(id)
      toast.success('Refund issued successfully — money returned to customer via Stripe!')
      fetchAll()
    } catch (err) {
      const msg = err.message || 'Failed to issue refund'
      if (msg.includes('Stripe refund failed')) {
        toast.error('Stripe refund failed — return is marked completed but money was NOT sent. Use "Retry Refund" to try again.')
      } else {
        toast.error(msg)
      }
      fetchAll()
    } finally {
      setActionLoading(false)
    }
  }

  const handleRetryRefund = async (id) => {
    if (!window.confirm('Retry the Stripe refund? This will attempt to send money back to the customer.')) return
    setActionLoading(true)
    try {
      await sellerAPI.retryRefund(id)
      toast.success('Stripe refund succeeded — money returned to customer!')
      fetchAll()
    } catch (err) {
      toast.error(err.message || 'Retry failed — please try again or contact support')
    } finally {
      setActionLoading(false)
    }
  }

  // ── STATUS ACTIONS for each return ──────────────────────────────
  const getActions = (r) => {
    const actions = []
    switch (r.status) {
      case 'pending':
        actions.push({ label: 'Authorize Return', color: '#059669', bg: '#D1FAE5', onClick: () => { setAuthorizeModal(r.id); setRefundAmount(r.order?.amount ? String(r.order.amount / 100) : '') } })
        actions.push({ label: 'Close Request', color: '#DC2626', bg: '#FEE2E2', onClick: () => setCloseModal(r.id) })
        break
      case 'return_shipped':
        actions.push({ label: 'Mark as Received', color: '#7C3AED', bg: '#EDE9FE', onClick: () => handleReceive(r.id) })
        break
      case 'return_received':
        actions.push({ label: 'Start Inspection', color: '#EA580C', bg: '#FFEDD5', onClick: () => setInspectModal(r.id) })
        break
      case 'inspecting':
        actions.push({ label: 'Issue Refund', color: '#047857', bg: '#D1FAE5', onClick: () => handleIssueRefund(r.id) })
        actions.push({ label: 'Close (Deny Refund)', color: '#DC2626', bg: '#FEE2E2', onClick: () => setCloseModal(r.id) })
        break
      case 'completed':
        if (r.refund_status === 'failed') {
          actions.push({ label: 'Retry Refund', color: '#DC2626', bg: '#FEE2E2', onClick: () => handleRetryRefund(r.id) })
        }
        break
    }
    return actions
  }

  // ── RENDER ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div style={{ textAlign: 'center', color: '#565959' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
          <div>Loading returns...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <h2 style={{ color: '#0F1111', marginTop: 20 }}>Failed to load returns</h2>
        <p style={{ color: '#565959', marginBottom: 20 }}>{error}</p>
        <button onClick={fetchAll} style={btnStyle('#FF9900', 'white')}>Retry</button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#0F1111' }}>Manage Returns</h1>
          <p style={{ color: '#565959', margin: '4px 0 0', fontSize: 14 }}>Amazon Seller Central-style return management</p>
        </div>
        <button onClick={fetchAll} style={{ ...btnStyle('#232F3E', 'white'), fontSize: 13 }}>Refresh</button>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Total Returns', value: derivedStats.total, color: '#0F1111', bg: '#F7F8F8' },
          { label: 'Pending Action', value: derivedStats.pending, color: '#D97706', bg: '#FEF3C7' },
          { label: 'In Progress', value: derivedStats.approved, color: '#2563EB', bg: '#DBEAFE' },
          { label: 'Completed', value: derivedStats.completed, color: '#047857', bg: '#D1FAE5' },
          { label: 'Closed/Rejected', value: derivedStats.rejected, color: '#DC2626', bg: '#FEE2E2' },
          { label: 'This Month', value: derivedStats.this_month, color: '#7C3AED', bg: '#EDE9FE' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', border: '1px solid #D5D9D9', borderRadius: 8, padding: '14px 16px', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 11, color: '#565959', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="text" placeholder="Search by customer, order ID, or reason..."
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          style={inputStyle}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, minWidth: 180, flex: 'unset' }}>
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_META).map(([key, m]) => (
            <option key={key} value={key}>{m.icon} {m.label}</option>
          ))}
        </select>
      </div>

      {/* Returns List */}
      {filtered.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #D5D9D9', borderRadius: 8, padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No returns found</h3>
          <p style={{ color: '#565959' }}>{statusFilter !== 'all' ? 'Try changing the filter.' : 'You have no return requests yet.'}</p>
        </div>
      ) : (
        filtered.map(r => {
          const meta = STATUS_META[r.status] || STATUS_META.pending
          const isExpanded = expandedId === r.id
          const actions = getActions(r)
          const currentStep = meta.step || 0

          return (
            <div key={r.id} style={{ background: 'white', border: '1px solid #D5D9D9', borderRadius: 8, overflow: 'hidden', marginBottom: 12, borderLeft: actions.length > 0 ? `4px solid ${meta.color}` : undefined }}>
              {/* Header row */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : r.id)}
                style={{
                  padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: 'pointer', flexWrap: 'wrap', gap: 8,
                  background: isExpanded ? '#F9FAFB' : 'white',
                  borderBottom: isExpanded ? '1px solid #E5E7EB' : 'none'
                }}
              >
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
                  <div style={{ minWidth: 85 }}>
                    <div style={labelStyle}>Return ID</div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>#{r.id?.substring(0, 8).toUpperCase()}</div>
                  </div>
                  <div style={{ minWidth: 110 }}>
                    <div style={labelStyle}>Customer</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F1111' }}>{getCustomerName(r)}</div>
                  </div>
                  <div style={{ minWidth: 75 }}>
                    <div style={labelStyle}>Date</div>
                    <div style={{ fontSize: 13 }}>{fmtDate(r.created_at)}</div>
                  </div>
                  <div style={{ minWidth: 75 }}>
                    <div style={labelStyle}>Type</div>
                    <div style={{ fontSize: 12, textTransform: 'capitalize' }}>{(r.return_type || 'other').replace(/_/g, ' ')}</div>
                  </div>
                  {r.refund_amount != null && (
                    <div style={{ minWidth: 65 }}>
                      <div style={labelStyle}>Refund</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{fmtMoney(r.refund_amount)}</div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {actions.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: 0.5 }}>Action Required</span>
                  )}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 20, background: meta.bg, color: meta.color, fontSize: 12, fontWeight: 700 }}>
                    {meta.icon} {meta.label}
                  </span>
                  <span style={{ fontSize: 14, color: '#9CA3AF', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>&#9660;</span>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ padding: '16px 20px' }}>
                  {/* Progress Tracker */}
                  {currentStep > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20, overflow: 'auto', paddingBottom: 4 }}>
                      {STEPS.map((step, i) => {
                        const done = currentStep > (i + 1)
                        const active = currentStep === (i + 1)
                        return (
                          <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 80 }}>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: '50%', margin: '0 auto 4px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                                background: done ? '#059669' : active ? '#FF9900' : '#E5E7EB',
                                color: done || active ? 'white' : '#9CA3AF'
                              }}>
                                {done ? '✓' : i + 1}
                              </div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: done ? '#059669' : active ? '#FF9900' : '#9CA3AF', textTransform: 'uppercase' }}>{step.label}</div>
                            </div>
                            {i < STEPS.length - 1 && (
                              <div style={{ height: 2, flex: '0 0 20px', background: done ? '#059669' : '#E5E7EB', marginBottom: 16 }} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Reason */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={labelStyle}>Customer's Reason</div>
                    <div style={{ fontSize: 14, color: '#0F1111', padding: '8px 12px', background: '#F9FAFB', borderRadius: 6, border: '1px solid #E5E7EB' }}>
                      {r.reason || '—'}
                      {r.detailed_description && (
                        <div style={{ fontSize: 13, color: '#565959', marginTop: 4, fontStyle: 'italic' }}>{r.detailed_description}</div>
                      )}
                    </div>
                  </div>

                  {/* Info grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
                    <InfoCard label="Order ID" value={`#${r.order_id?.substring(0, 8).toUpperCase()}`} />
                    {r.order?.amount != null && <InfoCard label="Order Total" value={fmtMoney(r.order.amount)} />}
                    {r.return_tracking_number && <InfoCard label="Return Tracking" value={r.return_tracking_number} sub={r.return_carrier} highlight />}
                    {r.customer?.email && <InfoCard label="Customer Email" value={r.customer.email} />}
                  </div>

                  {/* Evidence images */}
                  {Array.isArray(r.images) && r.images.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={labelStyle}>Customer Evidence Photos</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                        {r.images.map((img, i) => (
                          <a key={i} href={img} target="_blank" rel="noopener noreferrer">
                            <img src={img} alt={`Evidence ${i + 1}`}
                              style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, border: '1px solid #D5D9D9' }}
                              onError={e => { e.target.style.display = 'none' }}
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inspection notes */}
                  {r.inspection_notes && (
                    <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#9A3412', marginBottom: 14 }}>
                      <strong>Inspection Notes:</strong> {r.inspection_notes}
                      {r.inspection_passed != null && (
                        <span style={{ marginLeft: 10, fontWeight: 700 }}>
                          {r.inspection_passed ? '(Passed)' : '(Failed)'}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Rejection reason */}
                  {r.rejection_reason && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 14 }}>
                      <strong>Close Reason:</strong> {r.rejection_reason}
                    </div>
                  )}

                  {/* Refund failure warning */}
                  {r.status === 'completed' && r.refund_status === 'failed' && (
                    <div style={{ background: '#FEF2F2', border: '2px solid #EF4444', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#DC2626', marginBottom: 6 }}>
                        ⚠️ Stripe Refund Failed — Money NOT Sent to Customer
                      </div>
                      <div style={{ fontSize: 13, color: '#991B1B', marginBottom: 4 }}>
                        The return was completed but the Stripe refund of <strong>{fmtMoney(r.refund_amount)}</strong> failed.
                        {r.inspection_notes && r.inspection_notes.includes('Stripe refund failed') && (
                          <div style={{ marginTop: 4, fontSize: 12, fontStyle: 'italic' }}>{r.inspection_notes}</div>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#7F1D1D' }}>
                        Click "Retry Refund" below to attempt sending the money again.
                      </div>
                    </div>
                  )}

                  {/* ACTION BUTTONS */}
                  {actions.length > 0 && (
                    <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', marginBottom: 10 }}>Action Required</div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {actions.map((a, i) => (
                          <button
                            key={i} onClick={(e) => { e.stopPropagation(); a.onClick() }}
                            disabled={actionLoading}
                            style={{
                              background: a.color, color: 'white', border: 'none',
                              padding: '10px 22px', borderRadius: 6, cursor: actionLoading ? 'not-allowed' : 'pointer',
                              fontWeight: 700, fontSize: 13, opacity: actionLoading ? 0.6 : 1
                            }}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: '#565959', borderTop: '1px solid #F3F4F6', paddingTop: 10 }}>
                    <span>Submitted: {fmtDate(r.created_at)}</span>
                    {r.approved_at && <span>Authorized: {fmtDate(r.approved_at)}</span>}
                    {r.return_shipped_at && <span>Shipped: {fmtDate(r.return_shipped_at)}</span>}
                    {r.return_received_at && <span>Received: {fmtDate(r.return_received_at)}</span>}
                    {r.completed_at && <span>Refund Issued: {fmtDate(r.completed_at)}</span>}
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}

      {/* Return Workflow Guide */}
      <div style={{ background: 'white', border: '1px solid #D5D9D9', borderRadius: 8, padding: 24, marginTop: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#0F1111' }}>Seller Return Workflow</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          {[
            { icon: '1️⃣', title: 'Review Request', desc: 'Customer submits a return request. Review the reason and evidence photos.' },
            { icon: '2️⃣', title: 'Authorize or Close', desc: 'Authorize the return and set refund amount, or close the request with a reason.' },
            { icon: '3️⃣', title: 'Await Shipment', desc: 'Customer ships the item back with tracking number.' },
            { icon: '4️⃣', title: 'Receive & Inspect', desc: 'Mark item as received, then inspect its condition.' },
            { icon: '5️⃣', title: 'Issue Refund', desc: 'If inspection passes, issue the refund to the customer.' },
          ].map(p => (
            <div key={p.title} style={{ padding: 14, background: '#F7F8F8', borderRadius: 8 }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{p.icon}</div>
              <div style={{ fontWeight: 700, marginBottom: 4, color: '#0F1111', fontSize: 13 }}>{p.title}</div>
              <div style={{ fontSize: 12, color: '#565959', lineHeight: 1.4 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MODALS ────────────────────────────────────────────────── */}

      {/* Authorize Return Modal */}
      {authorizeModal && (
        <Modal title="Authorize Return" onClose={() => setAuthorizeModal(null)}>
          <form onSubmit={handleAuthorize}>
            <p style={{ fontSize: 13, color: '#565959', marginBottom: 14 }}>
              Authorize this return and set the refund amount the customer will receive.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={formLabel}>Refund Amount ($) *</label>
              <input type="number" step="0.01" min="0.01" required
                value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
                placeholder="0.00" style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setAuthorizeModal(null)} style={btnStyle('#F3F4F6', '#374151')}>Cancel</button>
              <button type="submit" disabled={actionLoading} style={btnStyle('#059669', 'white', actionLoading)}>{actionLoading ? 'Processing...' : 'Authorize Return'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Close Return Modal */}
      {closeModal && (
        <Modal title="Close Return Request" onClose={() => setCloseModal(null)}>
          <form onSubmit={handleClose}>
            <p style={{ fontSize: 13, color: '#565959', marginBottom: 14 }}>
              Close this return request. Please provide a clear reason for the customer.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={formLabel}>Reason for Closing *</label>
              <textarea required rows={3}
                value={closeReason} onChange={e => setCloseReason(e.target.value)}
                placeholder="E.g. Item was used, outside return window, etc."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setCloseModal(null)} style={btnStyle('#F3F4F6', '#374151')}>Cancel</button>
              <button type="submit" disabled={actionLoading} style={btnStyle('#DC2626', 'white', actionLoading)}>{actionLoading ? 'Processing...' : 'Close Request'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Inspection Modal */}
      {inspectModal && (
        <Modal title="Record Inspection" onClose={() => setInspectModal(null)}>
          <form onSubmit={handleInspect}>
            <p style={{ fontSize: 13, color: '#565959', marginBottom: 14 }}>
              Record your inspection results for the returned item.
            </p>
            <div style={{ marginBottom: 14 }}>
              <label style={formLabel}>Inspection Result *</label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 16px', borderRadius: 6, border: `2px solid ${inspectionPassed ? '#059669' : '#D5D9D9'}`, background: inspectionPassed ? '#D1FAE5' : 'white' }}>
                  <input type="radio" name="result" checked={inspectionPassed} onChange={() => setInspectionPassed(true)} />
                  <span style={{ fontWeight: 600, color: '#059669' }}>Pass</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 16px', borderRadius: 6, border: `2px solid ${!inspectionPassed ? '#DC2626' : '#D5D9D9'}`, background: !inspectionPassed ? '#FEE2E2' : 'white' }}>
                  <input type="radio" name="result" checked={!inspectionPassed} onChange={() => setInspectionPassed(false)} />
                  <span style={{ fontWeight: 600, color: '#DC2626' }}>Fail</span>
                </label>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={formLabel}>Inspection Notes</label>
              <textarea rows={3}
                value={inspectionNotes} onChange={e => setInspectionNotes(e.target.value)}
                placeholder="Describe item condition, damage, etc."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setInspectModal(null)} style={btnStyle('#F3F4F6', '#374151')}>Cancel</button>
              <button type="submit" disabled={actionLoading} style={btnStyle('#EA580C', 'white', actionLoading)}>{actionLoading ? 'Processing...' : 'Save Inspection'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ── Shared Components & Styles ──────────────────────────────────
const labelStyle = { fontSize: 11, color: '#565959', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }
const inputStyle = { flex: '1 1 250px', border: '1px solid #D5D9D9', borderRadius: 4, padding: '9px 12px', fontSize: 14, boxSizing: 'border-box', width: '100%' }
const formLabel = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#0F1111' }

const btnStyle = (bg, color, disabled = false) => ({
  background: bg, color, border: 'none', padding: '10px 20px', borderRadius: 6,
  cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13,
  opacity: disabled ? 0.6 : 1
})

const InfoCard = ({ label, value, sub, highlight }) => (
  <div style={{ background: highlight ? '#FFF7ED' : '#F9FAFB', border: `1px solid ${highlight ? '#FED7AA' : '#E5E7EB'}`, borderRadius: 6, padding: '10px 12px' }}>
    <div style={labelStyle}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: highlight ? '#C2410C' : '#0F1111', wordBreak: 'break-all' }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: '#9A3412' }}>{sub}</div>}
  </div>
)

const Modal = ({ title, onClose, children }) => (
  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 16 }}>
    <div style={{ background: 'white', borderRadius: 12, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 4px 24px rgba(0,0,0,0.15)', maxHeight: '90vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F1111', margin: 0 }}>{title}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280', padding: 4 }}>&times;</button>
      </div>
      {children}
    </div>
  </div>
)

export default SellerReturnsPage
