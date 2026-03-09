import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { customerAPI } from '../../services/api.service'

const REPLACEMENT_REASONS = [
  { label: 'Item arrived damaged', category: 'damaged_shipping' },
  { label: 'Item is defective / not working', category: 'defective_product' },
  { label: 'Wrong item received', category: 'wrong_item' },
  { label: 'Item does not match description', category: 'wrong_item' },
  { label: 'Missing parts or accessories', category: 'missing_parts' },
  { label: 'Quality not as expected', category: 'defective_product' },
  { label: 'Other', category: 'other' },
]

const STATUS_STEPS = [
  { key: 'pending', label: 'Submitted', icon: '📋', color: '#F59E0B' },
  { key: 'approved', label: 'Approved', icon: '✅', color: '#10B981' },
  { key: 'return_shipped', label: 'Return Shipped', icon: '📦', color: '#3B82F6' },
  { key: 'return_received', label: 'Return Received', icon: '🏭', color: '#8B5CF6' },
  { key: 'replacement_shipped', label: 'Replacement Sent', icon: '🚚', color: '#F97316' },
  { key: 'completed', label: 'Completed', icon: '✔️', color: '#059669' },
]

const STATUS_INDEX = STATUS_STEPS.reduce((acc, s, i) => { acc[s.key] = i; return acc }, {})

const STATUS_META = {
  pending: { label: 'Pending Review', color: '#F59E0B', bg: '#FEF3C7', icon: '⏳' },
  approved: { label: 'Approved', color: '#10B981', bg: '#D1FAE5', icon: '✅' },
  return_shipped: { label: 'Return Shipped', color: '#3B82F6', bg: '#DBEAFE', icon: '📦' },
  return_received: { label: 'Return Received', color: '#8B5CF6', bg: '#EDE9FE', icon: '🏭' },
  replacement_shipped: { label: 'Replacement Shipped', color: '#F97316', bg: '#FFEDD5', icon: '🚚' },
  completed: { label: 'Completed', color: '#059669', bg: '#D1FAE5', icon: '✔️' },
  rejected: { label: 'Rejected', color: '#EF4444', bg: '#FEE2E2', icon: '❌' },
  cancelled: { label: 'Cancelled', color: '#6B7280', bg: '#F3F4F6', icon: '🚫' },
}

const fmtDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const CustomerReplacementsPage = () => {
  const [searchParams] = useSearchParams()
  const prefilledOrderId = searchParams.get('order') || ''

  const [replacements, setReplacements] = useState([])
  const [recentOrders, setRecentOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(!!prefilledOrderId)

  // Form state
  const [orderId, setOrderId] = useState(prefilledOrderId)
  const [productId, setProductId] = useState('')
  const [orderItems, setOrderItems] = useState([])
  const [reason, setReason] = useState('')
  const [additionalDetails, setAdditionalDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Return tracking state
  const [trackingReturnId, setTrackingReturnId] = useState(null)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [submittingTracking, setSubmittingTracking] = useState(false)

  // ─── Load data ──────────────────────────────────────────────────
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [repRes, ordRes] = await Promise.all([
        customerAPI.getReplacements().catch(() => ({ data: [] })),
        customerAPI.getOrders?.().catch(() => ({ data: [] }))
      ])
      setReplacements(Array.isArray(repRes?.data) ? repRes.data : Array.isArray(repRes) ? repRes : [])
      const orders = Array.isArray(ordRes?.data) ? ordRes.data : Array.isArray(ordRes) ? ordRes : []
      setRecentOrders(orders.filter(o => o.status === 'delivered'))
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // ─── Load order items when order changes ────────────────────────
  useEffect(() => {
    if (!orderId) { setOrderItems([]); setProductId(''); return }
    const order = recentOrders.find(o => o.id === orderId)
    if (order) {
      const items = order.items || order.order_items || []
      setOrderItems(items)
      setProductId(items.length === 1 ? (items[0].product_id || items[0].id || '') : '')
    } else {
      // Manual ID — try fetching order details
      customerAPI.getOrder?.(orderId)
        .then(res => {
          const o = res?.data || res || {}
          const items = o.items || o.order_items || []
          setOrderItems(items)
          setProductId(items.length === 1 ? (items[0].product_id || items[0].id || '') : '')
        })
        .catch(() => setOrderItems([]))
    }
  }, [orderId, recentOrders])

  // ─── Submit replacement request ─────────────────────────────────
  const handleSubmitReplacement = async (e) => {
    e.preventDefault()
    if (!orderId || !reason || !productId) {
      toast.error('Please fill in all required fields')
      return
    }
    const selectedReason = REPLACEMENT_REASONS.find(r => r.label === reason)
    setSubmitting(true)
    try {
      await customerAPI.createReplacement({
        order_id: orderId,
        product_id: productId,
        reason_category: selectedReason?.category || 'other',
        reason_description: additionalDetails || reason,
      })
      toast.success('Replacement request submitted!')
      setShowForm(false)
      setReason('')
      setAdditionalDetails('')
      setProductId('')
      if (!prefilledOrderId) setOrderId('')
      loadData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit replacement request')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Submit return tracking ─────────────────────────────────────
  const handleSubmitTracking = async (repId) => {
    if (!trackingNumber.trim()) {
      toast.error('Please enter a tracking number')
      return
    }
    setSubmittingTracking(true)
    try {
      await customerAPI.updateReplacementReturnTracking(repId, trackingNumber.trim())
      toast.success('Tracking number submitted!')
      setTrackingReturnId(null)
      setTrackingNumber('')
      loadData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update tracking')
    } finally {
      setSubmittingTracking(false)
    }
  }

  // ─── Status timeline ───────────────────────────────────────────
  const StatusTimeline = ({ status }) => {
    const rejected = status === 'rejected'
    const cancelled = status === 'cancelled'
    if (rejected || cancelled) {
      const meta = STATUS_META[status]
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
          <span style={{ fontSize: 20 }}>{meta.icon}</span>
          <span style={{ fontWeight: 700, color: meta.color }}>{meta.label}</span>
        </div>
      )
    }
    const currentIdx = STATUS_INDEX[status] ?? -1
    return (
      <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start', overflowX: 'auto', padding: '10px 0' }}>
        {STATUS_STEPS.map((step, i) => {
          const done = i <= currentIdx
          const active = i === currentIdx
          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: i < STATUS_STEPS.length - 1 ? 1 : 'none' }}>
              <div style={{ textAlign: 'center', minWidth: 60 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', margin: '0 auto 6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? step.color : '#E5E7EB', color: done ? '#fff' : '#9CA3AF',
                  fontSize: 14, fontWeight: 700,
                  boxShadow: active ? `0 0 0 3px ${step.color}33` : 'none',
                  transition: 'all .3s'
                }}>
                  {done ? step.icon : (i + 1)}
                </div>
                <div style={{ fontSize: 11, color: done ? step.color : '#9CA3AF', fontWeight: done ? 600 : 400, lineHeight: 1.2 }}>
                  {step.label}
                </div>
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div style={{ flex: 1, height: 3, background: i < currentIdx ? step.color : '#E5E7EB', margin: '0 4px', borderRadius: 2, minWidth: 20, alignSelf: 'center', marginTop: -14, transition: 'all .3s' }} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ─── Replacement card ──────────────────────────────────────────
  const ReplacementCard = ({ r }) => {
    const meta = STATUS_META[r.status] || STATUS_META.pending
    return (
      <div style={{ background: 'white', border: '1px solid #D5D9D9', borderRadius: 8, marginBottom: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: '#F7FAFA', borderBottom: '1px solid #E8E8E8', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#565959', flexWrap: 'wrap' }}>
            <span><strong>Replacement ID:</strong> #{String(r.id).substring(0, 8).toUpperCase()}</span>
            <span><strong>Order:</strong> <Link to={`/orders/${r.order_id}`} style={{ color: '#007185' }}>#{String(r.order_id).substring(0, 8).toUpperCase()}</Link></span>
            <span><strong>Requested:</strong> {fmtDate(r.created_at)}</span>
          </div>
          <span style={{
            background: meta.bg, color: meta.color, fontWeight: 700,
            fontSize: 12, padding: '4px 12px', borderRadius: 20, whiteSpace: 'nowrap'
          }}>
            {meta.icon} {meta.label}
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px' }}>
          <StatusTimeline status={r.status} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '14px 0', fontSize: 14 }}>
            <div><span style={{ color: '#565959' }}>Reason:</span> <strong>{r.reason}</strong></div>
            {r.additional_details && (
              <div><span style={{ color: '#565959' }}>Details:</span> {r.additional_details}</div>
            )}
            {r.replacement_tracking_number && (
              <div><span style={{ color: '#565959' }}>Replacement Tracking:</span> <strong>{r.replacement_tracking_number}</strong></div>
            )}
            {r.return_tracking_number && (
              <div><span style={{ color: '#565959' }}>Return Tracking:</span> <strong>{r.return_tracking_number}</strong></div>
            )}
          </div>

          {/* Action: submit return tracking when approved */}
          {r.status === 'approved' && !r.return_tracking_number && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 6, padding: '12px 16px', marginTop: 12 }}>
              <p style={{ margin: '0 0 10px', fontSize: 14, color: '#92400E', fontWeight: 600 }}>
                📦 Please ship the original item back and enter your tracking number:
              </p>
              {trackingReturnId === r.id ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={e => setTrackingNumber(e.target.value)}
                    placeholder="Enter tracking number..."
                    style={{ flex: 1, border: '1px solid #D5D9D9', borderRadius: 4, padding: '8px 12px', fontSize: 14 }}
                  />
                  <button
                    onClick={() => handleSubmitTracking(r.id)}
                    disabled={submittingTracking}
                    style={{ background: '#FF9900', color: 'white', border: 'none', borderRadius: 4, padding: '8px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: submittingTracking ? 0.6 : 1 }}
                  >
                    {submittingTracking ? 'Saving...' : 'Submit'}
                  </button>
                  <button
                    onClick={() => { setTrackingReturnId(null); setTrackingNumber('') }}
                    style={{ background: 'none', border: '1px solid #D5D9D9', borderRadius: 4, padding: '8px 14px', fontSize: 14, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setTrackingReturnId(r.id)}
                  style={{ background: '#FF9900', color: 'white', border: 'none', borderRadius: 4, padding: '8px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                >
                  Enter Tracking Number
                </button>
              )}
            </div>
          )}

          {/* Timestamps */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#565959', borderTop: '1px solid #F3F4F6', paddingTop: 10, marginTop: 14 }}>
            <span>Submitted: {fmtDate(r.created_at)}</span>
            {r.approved_at && <span>Approved: {fmtDate(r.approved_at)}</span>}
            {r.shipped_at && <span>Replacement Shipped: {fmtDate(r.shipped_at)}</span>}
            {r.completed_at && <span>Completed: {fmtDate(r.completed_at)}</span>}
          </div>
        </div>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Replacements</h1>
          <p style={{ color: '#565959', margin: '6px 0 0' }}>Track and manage your replacement requests</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{ background: '#FF9900', color: 'white', border: '1px solid #FF9900', borderRadius: 4, padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            + Request a Replacement
          </button>
        )}
      </div>

      {/* ── Replacement Request Form ── */}
      {showForm && (
        <div style={{ background: 'white', border: '1px solid #D5D9D9', borderRadius: 8, padding: 24, marginBottom: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Request a Replacement</h2>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#565959', lineHeight: 1 }}>×</button>
          </div>

          <form onSubmit={handleSubmitReplacement}>
            {/* Order picker */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                Select Order <span style={{ color: '#C7511F' }}>*</span>
              </label>
              {recentOrders.length > 0 ? (
                <>
                  <select
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    style={{ width: '100%', border: '1px solid #D5D9D9', borderRadius: 4, padding: '9px 12px', fontSize: 14, background: 'white' }}
                    required
                  >
                    <option value="">— Choose a delivered order —</option>
                    {recentOrders.map(order => (
                      <option key={order.id} value={order.id}>
                        #{order.id.substring(0, 8).toUpperCase()} — {fmtDate(order.created_at)} — {order.amount != null ? `$${Number(order.amount).toFixed(2)}` : ''}
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: 12, color: '#565959', margin: '6px 0 0' }}>
                    Can't find your order?{' '}
                    <button
                      type="button"
                      onClick={() => setOrderId('')}
                      style={{ background: 'none', border: 'none', color: '#007185', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: 12 }}
                    >
                      Enter order ID manually
                    </button>
                  </p>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="e.g. abc123-..."
                    style={{ width: '100%', border: '1px solid #D5D9D9', borderRadius: 4, padding: '9px 12px', fontSize: 14, boxSizing: 'border-box' }}
                    required
                  />
                  <p style={{ fontSize: 12, color: '#565959', margin: '6px 0 0' }}>
                    Find your Order ID on the{' '}
                    <Link to="/orders" style={{ color: '#007185' }}>Your Orders</Link> page.
                  </p>
                </>
              )}
              {recentOrders.length > 0 && orderId === '' && (
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="Enter order ID manually..."
                  style={{ width: '100%', border: '1px solid #D5D9D9', borderRadius: 4, padding: '9px 12px', fontSize: 14, marginTop: 8, boxSizing: 'border-box' }}
                />
              )}
            </div>

            {/* Product picker */}
            {orderItems.length > 1 && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                  Select Product <span style={{ color: '#C7511F' }}>*</span>
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  style={{ width: '100%', border: '1px solid #D5D9D9', borderRadius: 4, padding: '9px 12px', fontSize: 14, background: 'white' }}
                  required
                >
                  <option value="">— Select a product —</option>
                  {orderItems.map((item, idx) => (
                    <option key={item.product_id || item.id || idx} value={item.product_id || item.id}>
                      {item.product_name || item.name || item.title || `Product ${idx + 1}`}
                      {item.quantity ? ` (qty: ${item.quantity})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reason */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                Reason for Replacement <span style={{ color: '#C7511F' }}>*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ width: '100%', border: '1px solid #D5D9D9', borderRadius: 4, padding: '9px 12px', fontSize: 14, background: 'white' }}
                required
              >
                <option value="">Select a reason...</option>
                {REPLACEMENT_REASONS.map(r => <option key={r.label} value={r.label}>{r.label}</option>)}
              </select>
            </div>

            {/* Additional details */}
            {reason && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                  Additional Details <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  value={additionalDetails}
                  onChange={(e) => setAdditionalDetails(e.target.value)}
                  placeholder="Describe the issue in more detail..."
                  rows={3}
                  style={{ width: '100%', border: '1px solid #D5D9D9', borderRadius: 4, padding: '9px 12px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {/* Policy box */}
            <div style={{ background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#1E40AF', marginBottom: 20 }}>
              <strong>Replacement Policy:</strong> Replacements are available within <strong>30 days</strong> of delivery for defective, damaged, or incorrect items.
              Once approved, please ship the original item back. Your replacement will be shipped after we receive your return.
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="submit"
                disabled={submitting}
                style={{ background: '#FF9900', color: 'white', border: 'none', borderRadius: 4, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? 'Submitting...' : 'Submit Replacement Request'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setReason(''); setAdditionalDetails(''); if (!prefilledOrderId) setOrderId('') }}
                style={{ background: 'none', border: '1px solid #D5D9D9', borderRadius: 4, padding: '10px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Replacement Requests List ── */}
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Your Replacement Requests</h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
          <div style={{ color: '#565959' }}>Loading your replacements...</div>
        </div>
      ) : replacements.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #D5D9D9', borderRadius: 8, padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔄</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No replacement requests yet</h3>
          <p style={{ color: '#565959', marginBottom: 20 }}>You haven't requested any replacements.</p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              style={{ background: '#FF9900', color: 'white', border: 'none', borderRadius: 4, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              Request a Replacement
            </button>
          )}
        </div>
      ) : (
        replacements.map(r => <ReplacementCard key={r.id} r={r} />)
      )}
    </div>
  )
}

export default CustomerReplacementsPage