import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { customerAPI } from '../../services/api.service'

const RETURN_REASONS = [
  'Item arrived damaged',
  'Item does not match description',
  'Wrong item received',
  'Item is defective / not working',
  'Changed my mind',
  'Ordered by mistake',
  'Item arrived too late',
  'Better price available elsewhere',
  'Missing parts or accessories',
  'Quality not as expected',
  'Other'
]

const REASON_TO_TYPE = {
  'Item arrived damaged':             'damaged_in_shipping',
  'Item does not match description':  'not_as_described',
  'Wrong item received':              'wrong_item',
  'Item is defective / not working':  'defective',
  'Changed my mind':                  'changed_mind',
  'Ordered by mistake':               'changed_mind',
  'Item arrived too late':            'other',
  'Better price available elsewhere': 'changed_mind',
  'Missing parts or accessories':     'defective',
  'Quality not as expected':          'quality_issue',
  'Other':                            'other'
}

// All 8 statuses in order (for the timeline)
const STATUS_STEPS = [
  { key: 'pending',         label: 'Submitted',       icon: '📋', color: '#F59E0B' },
  { key: 'approved',        label: 'Approved',        icon: '✅', color: '#10B981' },
  { key: 'return_shipped',  label: 'Shipped Back',    icon: '📦', color: '#3B82F6' },
  { key: 'return_received', label: 'Received',        icon: '🏭', color: '#8B5CF6' },
  { key: 'inspecting',      label: 'Inspecting',      icon: '🔍', color: '#F97316' },
  { key: 'completed',       label: 'Refund Issued',   icon: '💰', color: '#059669' },
]

const STATUS_INDEX = STATUS_STEPS.reduce((acc, s, i) => { acc[s.key] = i; return acc; }, {})

const STATUS_META = {
  pending:         { label: 'Pending Review',   color: '#F59E0B', bg: '#FEF3C7', icon: '⏳' },
  approved:        { label: 'Approved',          color: '#10B981', bg: '#D1FAE5', icon: '✅' },
  return_shipped:  { label: 'Return Shipped',    color: '#3B82F6', bg: '#DBEAFE', icon: '📦' },
  return_received: { label: 'Item Received',     color: '#8B5CF6', bg: '#EDE9FE', icon: '🏭' },
  inspecting:      { label: 'Under Inspection',  color: '#F97316', bg: '#FFEDD5', icon: '🔍' },
  completed:       { label: 'Refund Issued',     color: '#059669', bg: '#D1FAE5', icon: '💰' },
  rejected:        { label: 'Rejected',          color: '#EF4444', bg: '#FEE2E2', icon: '❌' },
  cancelled:       { label: 'Cancelled',         color: '#6B7280', bg: '#F3F4F6', icon: '🚫' },
}

const CustomerReturnsPage = () => {
  const [searchParams] = useSearchParams()
  const prefilledOrderId = searchParams.get('order') || ''

  const [returns, setReturns] = useState([])
  const [recentOrders, setRecentOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(!!prefilledOrderId)
  const [cancellingId, setCancellingId] = useState(null)

  // Shipping form state (per return)
  const [shippingReturnId, setShippingReturnId] = useState(null)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [carrier, setCarrier] = useState('')
  const [submittingShipping, setSubmittingShipping] = useState(false)

  // Image upload state
  const [imageReturnId, setImageReturnId] = useState(null)
  const [imageUrls, setImageUrls] = useState([])
  const [newImageUrl, setNewImageUrl] = useState('')
  const [submittingImages, setSubmittingImages] = useState(false)

  // Form state
  const [orderId, setOrderId] = useState(prefilledOrderId)
  const [reason, setReason] = useState('')
  const [additionalDetails, setAdditionalDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    await Promise.all([fetchReturns(), fetchRecentOrders()])
    setLoading(false)
  }

  const fetchReturns = async () => {
    try {
      const response = await customerAPI.getReturns()
      let data = []
      if (Array.isArray(response)) data = response
      else if (response?.returns) data = response.returns
      else if (response?.data?.returns) data = response.data.returns
      else if (response?.data && Array.isArray(response.data)) data = response.data
      setReturns(data)
    } catch (err) {
      console.error('Failed to load returns:', err)
      setReturns([])
    }
  }

  const fetchRecentOrders = async () => {
    try {
      const response = await customerAPI.getOrders({ limit: 20 })
      let orders = []
      if (Array.isArray(response)) orders = response
      else if (response?.orders) orders = response.orders
      else if (response?.data) orders = response.data
      // Only show delivered orders for return eligibility
      setRecentOrders(orders.filter(o =>
        ['delivered', 'completed'].includes(o.status?.toLowerCase())
      ))
    } catch {
      setRecentOrders([])
    }
  }

  // 30-day return window check
  const isWithinReturnWindow = (order) => {
    if (!order?.delivered_at && !order?.updated_at) return true // assume eligible if no date
    const deliveredAt = new Date(order.delivered_at || order.updated_at)
    const daysSince = (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24)
    return daysSince <= 30
  }

  const getDaysLeft = (order) => {
    if (!order?.delivered_at && !order?.updated_at) return null
    const deliveredAt = new Date(order.delivered_at || order.updated_at)
    const daysSince = (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24)
    return Math.max(0, Math.floor(30 - daysSince))
  }

  const handleSubmitReturn = async (e) => {
    e.preventDefault()
    if (!orderId.trim()) { toast.error('Please select or enter an order ID'); return }
    if (!reason) { toast.error('Please select a reason for your return'); return }

    const finalReason = additionalDetails.trim()
      ? `${reason}. ${additionalDetails.trim()}`
      : reason

    setSubmitting(true)
    try {
      await customerAPI.createReturn({
        orderId: orderId.trim(),
        reason: finalReason,
        returnType: REASON_TO_TYPE[reason] || 'other',
        detailedDescription: additionalDetails.trim() || null
      })
      toast.success('Return request submitted successfully!')
      setShowForm(false)
      setOrderId('')
      setReason('')
      setAdditionalDetails('')
      await fetchReturns()
    } catch (err) {
      toast.error(err.message || 'Failed to submit return request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async (returnId) => {
    if (!window.confirm('Cancel this return request?')) return
    setCancellingId(returnId)
    try {
      await customerAPI.cancelReturn(returnId)
      toast.success('Return request cancelled')
      await fetchReturns()
    } catch (err) {
      toast.error(err.message || 'Failed to cancel return')
    } finally {
      setCancellingId(null)
    }
  }

  const handleSubmitShipping = async (e) => {
    e.preventDefault()
    if (!trackingNumber.trim()) { toast.error('Please enter a tracking number'); return }
    setSubmittingShipping(true)
    try {
      await customerAPI.updateReturnShipping(shippingReturnId, {
        trackingNumber: trackingNumber.trim(),
        carrier: carrier.trim() || null
      })
      toast.success('Shipping info submitted! We\'ll track your return.')
      setShippingReturnId(null)
      setTrackingNumber('')
      setCarrier('')
      await fetchReturns()
    } catch (err) {
      toast.error(err.message || 'Failed to update shipping info')
    } finally {
      setSubmittingShipping(false)
    }
  }

  const handleAddImage = () => {
    if (!newImageUrl.trim()) return
    setImageUrls(prev => [...prev, newImageUrl.trim()])
    setNewImageUrl('')
  }

  const handleRemoveImage = (idx) => {
    setImageUrls(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmitImages = async () => {
    if (imageUrls.length === 0) { toast.error('Please add at least one image URL'); return }
    setSubmittingImages(true)
    try {
      await customerAPI.updateReturnImages(imageReturnId, imageUrls)
      toast.success('Evidence images updated')
      setImageReturnId(null)
      setImageUrls([])
      await fetchReturns()
    } catch (err) {
      toast.error(err.message || 'Failed to update images')
    } finally {
      setSubmittingImages(false)
    }
  }

  const openImageEditor = (r) => {
    setImageReturnId(r.id)
    setImageUrls(Array.isArray(r.images) ? [...r.images] : [])
    setNewImageUrl('')
  }

  const fmtDate = (ts) => ts
    ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const fmtMoney = (n) => n != null ? `$${Number(n).toFixed(2)}` : null

  // ── Timeline bar ─────────────────────────────────────────────────────────
  const StatusTimeline = ({ status }) => {
    if (status === 'rejected' || status === 'cancelled') {
      const meta = STATUS_META[status]
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', fontSize: 13, color: meta.color }}>
          <span style={{ fontSize: 20 }}>{meta.icon}</span>
          <span style={{ fontWeight: 700 }}>{meta.label}</span>
        </div>
      )
    }

    const currentIdx = STATUS_INDEX[status] ?? 0

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '12px 0', overflowX: 'auto' }}>
        {STATUS_STEPS.map((step, idx) => {
          const done = idx < currentIdx
          const active = idx === currentIdx
          const color = active ? step.color : done ? '#10B981' : '#D1D5DB'
          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: active ? step.color : done ? '#10B981' : '#E5E7EB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: active || done ? 15 : 12,
                  color: active || done ? 'white' : '#9CA3AF',
                  fontWeight: 700,
                  border: active ? `2px solid ${step.color}` : 'none',
                  boxShadow: active ? `0 0 0 4px ${step.color}22` : 'none'
                }}>
                  {done ? '✓' : active ? step.icon : idx + 1}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: active ? 700 : 500,
                  color: active ? step.color : done ? '#10B981' : '#9CA3AF',
                  whiteSpace: 'nowrap', textAlign: 'center', maxWidth: 60
                }}>
                  {step.label}
                </div>
              </div>
              {idx < STATUS_STEPS.length - 1 && (
                <div style={{
                  height: 2, width: 24, flexShrink: 0, marginBottom: 18,
                  background: idx < currentIdx ? '#10B981' : '#E5E7EB'
                }} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── Return card ───────────────────────────────────────────────────────────
  const ReturnCard = ({ r }) => {
    const meta = STATUS_META[r.status] || STATUS_META.pending

    return (
      <div style={{
        background: 'white', border: '1px solid #D5D9D9', borderRadius: 8,
        overflow: 'hidden', marginBottom: 16
      }}>
        {/* Card header */}
        <div style={{
          background: '#F7F8F8', borderBottom: '1px solid #D5D9D9',
          padding: '12px 20px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: 8
        }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 11, color: '#565959', fontWeight: 600, textTransform: 'uppercase' }}>Return ID</span>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>
                #{r.id?.substring(0, 8).toUpperCase()}
              </div>
            </div>
            <div>
              <span style={{ fontSize: 11, color: '#565959', fontWeight: 600, textTransform: 'uppercase' }}>Order</span>
              <div style={{ fontSize: 13 }}>
                <Link to={`/orders/${r.order_id}`} style={{ color: '#007185', textDecoration: 'none', fontWeight: 600 }}>
                  #{r.order_id?.substring(0, 8).toUpperCase()}
                </Link>
              </div>
            </div>
            <div>
              <span style={{ fontSize: 11, color: '#565959', fontWeight: 600, textTransform: 'uppercase' }}>Requested</span>
              <div style={{ fontSize: 13 }}>{fmtDate(r.created_at)}</div>
            </div>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 20,
            background: meta.bg, color: meta.color,
            fontSize: 12, fontWeight: 700
          }}>
            <span>{meta.icon}</span>
            <span>{meta.label}</span>
          </div>
        </div>

        {/* Timeline */}
        <div style={{ padding: '8px 20px 4px', borderBottom: '1px solid #F3F4F6' }}>
          <StatusTimeline status={r.status} />
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px' }}>
          {/* Reason */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#565959', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Reason</div>
            <div style={{ fontSize: 14, color: '#0F1111' }}>{r.reason}</div>
          </div>

          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
            {r.refund_amount != null && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: '#565959', fontWeight: 600, textTransform: 'uppercase' }}>Refund Amount</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#059669' }}>{fmtMoney(r.refund_amount)}</div>
              </div>
            )}
            {r.refund_status && r.refund_status !== 'pending' && (
              <div style={{ background: r.refund_status === 'failed' ? '#FEF2F2' : '#EFF6FF', border: `1px solid ${r.refund_status === 'failed' ? '#FCA5A5' : '#BFDBFE'}`, borderRadius: 6, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: '#565959', fontWeight: 600, textTransform: 'uppercase' }}>Refund Status</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: r.refund_status === 'failed' ? '#DC2626' : r.refund_status === 'completed' ? '#059669' : '#1D4ED8', textTransform: 'capitalize' }}>
                  {r.refund_status === 'failed' ? 'Processing' : r.refund_status}
                </div>
              </div>
            )}
            {r.return_tracking_number && (
              <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 6, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: '#565959', fontWeight: 600, textTransform: 'uppercase' }}>Return Tracking</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#C2410C', fontFamily: 'monospace' }}>
                  {r.return_tracking_number}
                </div>
                {r.return_carrier && (
                  <div style={{ fontSize: 11, color: '#9A3412' }}>{r.return_carrier}</div>
                )}
              </div>
            )}
            {r.order && r.order.amount != null && (
              <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: '#565959', fontWeight: 600, textTransform: 'uppercase' }}>Order Total</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtMoney(r.order.amount)}</div>
              </div>
            )}
          </div>

          {/* Status-specific messages */}
          {r.status === 'pending' && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#92400E', marginBottom: 12 }}>
              ⏳ Your return request is under review. We'll notify you within 2–3 business days.
            </div>
          )}
          {r.status === 'approved' && (
            <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#065F46', marginBottom: 12 }}>
              ✅ <strong>Return approved!</strong> Please ship the item back within 7 days.
              Pack it securely and use the address on your original order.
              Once we receive it, your refund of <strong>{fmtMoney(r.refund_amount) || 'the approved amount'}</strong> will be processed
              within 3–5 business days.
            </div>
          )}

          {/* Shipping info form — appears when return is approved and no tracking yet */}
          {r.status === 'approved' && !r.return_tracking_number && (
            shippingReturnId === r.id ? (
              <form onSubmit={handleSubmitShipping} style={{ background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: 6, padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1E40AF', marginBottom: 10 }}>
                  📦 Enter Return Shipping Details
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={e => setTrackingNumber(e.target.value)}
                    placeholder="Tracking number *"
                    required
                    style={{ flex: '1 1 200px', border: '1px solid #D5D9D9', borderRadius: 4, padding: '8px 12px', fontSize: 13, boxSizing: 'border-box' }}
                  />
                  <select
                    value={carrier}
                    onChange={e => setCarrier(e.target.value)}
                    style={{ flex: '0 1 160px', border: '1px solid #D5D9D9', borderRadius: 4, padding: '8px 12px', fontSize: 13, background: 'white' }}
                  >
                    <option value="">Carrier (optional)</option>
                    <option value="USPS">USPS</option>
                    <option value="UPS">UPS</option>
                    <option value="FedEx">FedEx</option>
                    <option value="DHL">DHL</option>
                    <option value="Amazon">Amazon</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="submit"
                    disabled={submittingShipping}
                    style={{ background: '#3B82F6', color: 'white', border: 'none', borderRadius: 4, padding: '7px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: submittingShipping ? 0.6 : 1 }}
                  >
                    {submittingShipping ? 'Submitting...' : 'Submit Tracking'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShippingReturnId(null); setTrackingNumber(''); setCarrier('') }}
                    style={{ background: 'none', border: '1px solid #D5D9D9', borderRadius: 4, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <button
                  onClick={() => setShippingReturnId(r.id)}
                  style={{ background: '#3B82F6', color: 'white', border: 'none', borderRadius: 4, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  📦 Add Return Shipping Info
                </button>
              </div>
            )
          )}
          {r.status === 'return_shipped' && (
            <div style={{ background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#1E40AF', marginBottom: 12 }}>
              📦 We've received notice that you've shipped the item back.
              {r.return_tracking_number && ` Tracking: ${r.return_tracking_number}.`}
              We'll update you when it arrives at our warehouse.
            </div>
          )}
          {r.status === 'return_received' && (
            <div style={{ background: '#F5F3FF', border: '1px solid #C4B5FD', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#4C1D95', marginBottom: 12 }}>
              🏭 Your returned item has arrived at our warehouse and is being processed.
            </div>
          )}
          {r.status === 'inspecting' && (
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#9A3412', marginBottom: 12 }}>
              🔍 Our team is inspecting the returned item. Your refund will be issued shortly.
              {r.inspection_notes && <div style={{ marginTop: 6, fontStyle: 'italic' }}>Note: {r.inspection_notes}</div>}
            </div>
          )}
          {r.status === 'completed' && r.refund_status !== 'failed' && (
            <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#065F46', marginBottom: 12 }}>
              💰 <strong>Refund of {fmtMoney(r.refund_amount)} has been processed!</strong>
              {r.refund_processed_at && <> on {fmtDate(r.refund_processed_at)}</>}.
              Please allow 3–5 business days to appear on your statement.
              {r.refund_transaction_id && (
                <div style={{ marginTop: 4, fontSize: 11, fontFamily: 'monospace', color: '#047857' }}>
                  Transaction ID: {r.refund_transaction_id}
                </div>
              )}
            </div>
          )}
          {r.status === 'completed' && r.refund_status === 'failed' && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 12 }}>
              ⚠️ <strong>Your return is approved but the refund is being processed.</strong>
              <div style={{ marginTop: 4 }}>
                The seller is working on issuing your refund of {fmtMoney(r.refund_amount)}.
                If you don't see the refund within 5 business days, please{' '}
                <Link to="/customer-service" style={{ color: '#007185', textDecoration: 'underline' }}>
                  contact customer support
                </Link>.
              </div>
            </div>
          )}
          {r.status === 'rejected' && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 12 }}>
              ❌ Your return request was not approved.
              {r.rejection_reason && <div style={{ marginTop: 4 }}>Reason: <strong>{r.rejection_reason}</strong></div>}
              <div style={{ marginTop: 6 }}>
                <Link to="/customer-service" style={{ color: '#007185', textDecoration: 'underline' }}>
                  Contact customer support
                </Link> if you have questions.
              </div>
            </div>
          )}
          {r.status === 'cancelled' && (
            <div style={{ background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#374151', marginBottom: 12 }}>
              🚫 This return request was cancelled.
            </div>
          )}

          {/* Evidence images display */}
          {Array.isArray(r.images) && r.images.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#565959', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Evidence Photos</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {r.images.map((img, i) => (
                  <a key={i} href={img} target="_blank" rel="noopener noreferrer">
                    <img
                      src={img}
                      alt={`Evidence ${i + 1}`}
                      style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, border: '1px solid #D5D9D9', cursor: 'pointer' }}
                      onError={e => { e.target.style.display = 'none' }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Image editor — for pending/approved returns */}
          {['pending', 'approved'].includes(r.status) && (
            imageReturnId === r.id ? (
              <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 6, padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#9A3412', marginBottom: 10 }}>
                  📷 Add Evidence Images
                </div>
                {imageUrls.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {imageUrls.map((url, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={url} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid #D5D9D9' }}
                          onError={e => { e.target.src = '' ; e.target.alt = 'Invalid URL' ; e.target.style.background = '#FEE2E2' ; e.target.style.fontSize = '9px' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(i)}
                          style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: '#EF4444', color: 'white', border: 'none', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                        >x</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input
                    type="url"
                    value={newImageUrl}
                    onChange={e => setNewImageUrl(e.target.value)}
                    placeholder="Paste image URL..."
                    style={{ flex: 1, border: '1px solid #D5D9D9', borderRadius: 4, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddImage() } }}
                  />
                  <button type="button" onClick={handleAddImage}
                    style={{ background: '#F97316', color: 'white', border: 'none', borderRadius: 4, padding: '7px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >+ Add</button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleSubmitImages}
                    disabled={submittingImages || imageUrls.length === 0}
                    style={{ background: '#F97316', color: 'white', border: 'none', borderRadius: 4, padding: '7px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: submittingImages || imageUrls.length === 0 ? 0.6 : 1 }}
                  >
                    {submittingImages ? 'Saving...' : 'Save Images'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setImageReturnId(null); setImageUrls([]); setNewImageUrl('') }}
                    style={{ background: 'none', border: '1px solid #D5D9D9', borderRadius: 4, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}
                  >Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <button
                  onClick={() => openImageEditor(r)}
                  style={{ background: 'none', border: '1px solid #D5D9D9', borderRadius: 4, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: '#565959' }}
                >
                  📷 {Array.isArray(r.images) && r.images.length > 0 ? 'Edit Evidence Images' : 'Add Evidence Images'}
                </button>
              </div>
            )
          )}

          {/* Timestamps row */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#565959', borderTop: '1px solid #F3F4F6', paddingTop: 10 }}>
            <span>Submitted: {fmtDate(r.created_at)}</span>
            {r.approved_at && <span>Approved: {fmtDate(r.approved_at)}</span>}
            {r.return_received_at && <span>Received: {fmtDate(r.return_received_at)}</span>}
            {r.completed_at && <span>Completed: {fmtDate(r.completed_at)}</span>}
          </div>

          {/* Cancel button */}
          {r.status === 'pending' && (
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => handleCancel(r.id)}
                disabled={cancellingId === r.id}
                style={{
                  background: 'none', border: '1px solid #D5D9D9', borderRadius: 4,
                  padding: '6px 16px', fontSize: 13, cursor: 'pointer', color: '#565959',
                  opacity: cancellingId === r.id ? 0.6 : 1
                }}
              >
                {cancellingId === r.id ? 'Cancelling...' : 'Cancel Return Request'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Returns &amp; Refunds</h1>
          <p style={{ color: '#565959', margin: '6px 0 0' }}>Track and manage your return requests</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{ background: '#FF9900', color: 'white', border: '1px solid #FF9900', borderRadius: 4, padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            + Request a Return
          </button>
        )}
      </div>

      {/* ── Return Request Form ── */}
      {showForm && (
        <div style={{ background: 'white', border: '1px solid #D5D9D9', borderRadius: 8, padding: 24, marginBottom: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Submit a Return Request</h2>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#565959', lineHeight: 1 }}>×</button>
          </div>

          <form onSubmit={handleSubmitReturn}>

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
                    {recentOrders.map(order => {
                      const eligible = isWithinReturnWindow(order)
                      const daysLeft = getDaysLeft(order)
                      return (
                        <option key={order.id} value={order.id} disabled={!eligible}>
                          #{order.id.substring(0, 8).toUpperCase()} —{' '}
                          {fmtDate(order.created_at)} —{' '}
                          {order.amount != null ? `$${Number(order.amount).toFixed(2)}` : ''}
                          {eligible
                            ? daysLeft != null ? ` (${daysLeft}d left to return)` : ''
                            : ' (Return window expired)'
                          }
                        </option>
                      )
                    })}
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
              {/* Manual input when picker is shown but they want to type */}
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

            {/* Reason */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                Reason for Return <span style={{ color: '#C7511F' }}>*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ width: '100%', border: '1px solid #D5D9D9', borderRadius: 4, padding: '9px 12px', fontSize: 14, background: 'white' }}
                required
              >
                <option value="">Select a reason...</option>
                {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
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
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#92400E', marginBottom: 20 }}>
              <strong>Return Policy:</strong> Returns are accepted within <strong>30 days</strong> of delivery.
              Once your return is approved, please ship the item back within 7 days.
              Refunds are processed within 3–5 business days after item inspection.
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="submit"
                disabled={submitting}
                style={{ background: '#FF9900', color: 'white', border: 'none', borderRadius: 4, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? 'Submitting...' : 'Submit Return Request'}
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

      {/* ── Return Requests List ── */}
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Your Return Requests</h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
          <div style={{ color: '#565959' }}>Loading your returns...</div>
        </div>
      ) : returns.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #D5D9D9', borderRadius: 8, padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No return requests yet</h3>
          <p style={{ color: '#565959', marginBottom: 20 }}>You haven't requested any returns.</p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              style={{ background: '#FF9900', color: 'white', border: 'none', borderRadius: 4, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              Request a Return
            </button>
          )}
        </div>
      ) : (
        returns.map(r => <ReturnCard key={r.id} r={r} />)
      )}
    </div>
  )
}

export default CustomerReturnsPage
