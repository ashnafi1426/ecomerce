import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppSelector, useAppDispatch } from '../../hooks/redux'
import { clearCart } from '../../store/slices/cartSlice'
import { toast } from 'react-hot-toast'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import StripeCheckoutForm from '../../components/StripeCheckoutFormUpdated'
import api from '../../config/api'

// Load Stripe with your publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

const CheckoutPage = () => {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { items } = useAppSelector((state) => state.cart)
  const { user } = useAppSelector((state) => state.auth)

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [clientSecret, setClientSecret] = useState('')
  const [paymentIntentId, setPaymentIntentId] = useState('')
  const [orderBreakdown, setOrderBreakdown] = useState(null)

  // Coupon state
  const [couponCode, setCouponCode] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState(null) // { code, discount_amount, discount_type, discount_value }

  const [shippingAddress, setShippingAddress] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
    phone: ''
  })

  const [billingAddress, setBillingAddress] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
    phone: ''
  })

  const [useSameAddress, setUseSameAddress] = useState(true)

  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart')
    }
  }, [items, navigate])

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const shipping = subtotal > 50 ? 0 : 5.99
  const tax = subtotal * 0.08

  // Calculate discount from applied coupon
  const discount = appliedCoupon
    ? appliedCoupon.discount_type === 'percentage'
      ? Math.min(subtotal * (appliedCoupon.discount_value / 100), appliedCoupon.max_discount || Infinity)
      : appliedCoupon.discount_value
    : 0

  const totalAmount = Math.max(0, subtotal - discount) + shipping + tax

  // Apply coupon handler
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code')
      return
    }

    setCouponLoading(true)
    try {
      const response = await api.post('/coupons/apply', {
        code: couponCode.trim().toUpperCase(),
        cart_total: subtotal,
        user_id: user?.id
      })

      if (response.success || response.coupon) {
        const coupon = response.coupon || response
        setAppliedCoupon(coupon)
        toast.success(`Coupon applied! You saved $${(response.discount_amount || discount).toFixed(2)}`)
      } else {
        toast.error(response.message || 'Invalid coupon code')
      }
    } catch (err) {
      toast.error(err.message || 'Invalid or expired coupon code')
    } finally {
      setCouponLoading(false)
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
    toast.success('Coupon removed')
  }

  const handleShippingSubmit = async (e) => {
    e.preventDefault()

    if (!items || items.length === 0) {
      toast.error('Your cart is empty. Please add items before checkout.')
      navigate('/cart')
      return
    }

    const requiredFields = {
      fullName: 'Full Name',
      email: 'Email',
      address: 'Address',
      city: 'City',
      state: 'State',
      zipCode: 'ZIP Code',
      phone: 'Phone'
    }

    const missingFields = []

    for (const [field, label] of Object.entries(requiredFields)) {
      if (!shippingAddress[field] || shippingAddress[field].trim() === '') {
        missingFields.push(label)
      }
    }

    if (missingFields.length > 0) {
      toast.error(`Please fill in all required fields: ${missingFields.join(', ')}`)
      return
    }

    const zipCodePattern = /^\d{5}(-\d{4})?$/
    if (!zipCodePattern.test(shippingAddress.zipCode.trim())) {
      toast.error('Please enter a valid ZIP code (e.g., 12345 or 12345-6789)')
      return
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(shippingAddress.email.trim())) {
      toast.error('Please enter a valid email address')
      return
    }

    const phonePattern = /^[\d\s\-\(\)\+]{10,}$/
    if (!phonePattern.test(shippingAddress.phone.replace(/\s/g, ''))) {
      toast.error('Please enter a valid phone number')
      return
    }

    setLoading(true)

    try {
      const cartItems = items.map(item => ({
        id: item.id,
        quantity: item.quantity
      }))

      const response = await api.post('/stripe/create-intent', {
        cartItems,
        shippingAddress,
        billingAddress: useSameAddress ? shippingAddress : billingAddress,
        coupon_code: appliedCoupon?.code || null
      })

      if (response && response.success) {
        setClientSecret(response.client_secret)
        setPaymentIntentId(response.payment_intent_id)
        setOrderBreakdown(response.items)
        setStep(2)
      } else {
        throw new Error(response?.error || 'Invalid response from payment service')
      }
    } catch (error) {
      let errorMessage = 'Failed to initialize payment'
      if (error.message) errorMessage = error.message
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSuccess = async (paymentIntent) => {
    setLoading(true)

    try {
      const response = await api.post('/stripe/create-order', {
        payment_intent_id: paymentIntent.id
      })

      dispatch(clearCart())
      toast.success('Order placed successfully!')

      navigate('/orders', {
        state: {
          newOrderId: response.order_id,
          showSuccess: true
        }
      })
    } catch (error) {
      toast.error(error.message || 'Failed to create order')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentError = (error) => {
    toast.error('Payment failed. Please try again.')
  }

  return (
    <div className="min-h-screen bg-[#EAEDED]">
      {/* Header */}
      <div className="bg-white border-b border-[#D5D9D9]">
        <div className="max-w-[1200px] mx-auto px-5 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-normal text-[#0F1111]">Checkout</h1>
          <div className="flex items-center gap-2 text-[#565959]">
            <span>🔒</span>
            <span className="text-sm">Secure Checkout</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b border-[#D5D9D9]">
        <div className="max-w-[1000px] mx-auto px-5 py-5">
          <div className="flex justify-between items-center">
            <div className={`flex-1 flex flex-col items-center relative ${step >= 1 ? 'text-[#FF9900]' : 'text-[#565959]'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-2 z-10 ${step >= 1 ? 'bg-[#FF9900] text-white' : 'bg-[#D5D9D9]'}`}>
                {step > 1 ? '✓' : '1'}
              </div>
              <span className="text-sm font-semibold">Shipping</span>
              {step >= 2 && <div className="absolute top-5 left-1/2 w-full h-0.5 bg-[#FF9900] -z-10"></div>}
            </div>
            <div className={`flex-1 flex flex-col items-center relative ${step >= 2 ? 'text-[#FF9900]' : 'text-[#565959]'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-2 z-10 ${step >= 2 ? 'bg-[#FF9900] text-white' : 'bg-[#D5D9D9]'}`}>
                2
              </div>
              <span className="text-sm font-semibold">Payment</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1200px] mx-auto px-5 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Forms */}
          <div className="lg:col-span-2">
            {/* Step 1: Shipping Address */}
            {step === 1 && (
              <div className="bg-white border border-[#D5D9D9] rounded-lg p-6">
                <h2 className="text-2xl font-bold text-[#0F1111] mb-6">Shipping Address</h2>
                <form onSubmit={handleShippingSubmit}>
                  <div className="space-y-4">
                    <div>
                      <label className="block font-semibold text-[#0F1111] mb-2">Full Name *</label>
                      <input
                        type="text"
                        value={shippingAddress.fullName}
                        onChange={(e) => setShippingAddress({...shippingAddress, fullName: e.target.value})}
                        placeholder="Enter your full name"
                        className="w-full border border-[#D5D9D9] rounded px-3 py-2 focus:border-[#FF9900] focus:ring-1 focus:ring-[#FF9900] outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#0F1111] mb-2">Email *</label>
                      <input
                        type="email"
                        value={shippingAddress.email}
                        onChange={(e) => setShippingAddress({...shippingAddress, email: e.target.value})}
                        placeholder="your.email@example.com"
                        className="w-full border border-[#D5D9D9] rounded px-3 py-2 focus:border-[#FF9900] focus:ring-1 focus:ring-[#FF9900] outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#0F1111] mb-2">Address *</label>
                      <input
                        type="text"
                        value={shippingAddress.address}
                        onChange={(e) => setShippingAddress({...shippingAddress, address: e.target.value})}
                        placeholder="Street address, P.O. box, company name, c/o"
                        className="w-full border border-[#D5D9D9] rounded px-3 py-2 focus:border-[#FF9900] focus:ring-1 focus:ring-[#FF9900] outline-none"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-[#0F1111] mb-2">City *</label>
                        <input
                          type="text"
                          value={shippingAddress.city}
                          onChange={(e) => setShippingAddress({...shippingAddress, city: e.target.value})}
                          placeholder="Enter city name"
                          className="w-full border border-[#D5D9D9] rounded px-3 py-2 focus:border-[#FF9900] focus:ring-1 focus:ring-[#FF9900] outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-[#0F1111] mb-2">State *</label>
                        <select
                          value={shippingAddress.state}
                          onChange={(e) => setShippingAddress({...shippingAddress, state: e.target.value})}
                          className="w-full border border-[#D5D9D9] rounded px-3 py-2 focus:border-[#FF9900] focus:ring-1 focus:ring-[#FF9900] outline-none"
                          required
                        >
                          <option value="">Select State</option>
                          <option value="AL">Alabama</option><option value="AK">Alaska</option>
                          <option value="AZ">Arizona</option><option value="AR">Arkansas</option>
                          <option value="CA">California</option><option value="CO">Colorado</option>
                          <option value="CT">Connecticut</option><option value="DE">Delaware</option>
                          <option value="FL">Florida</option><option value="GA">Georgia</option>
                          <option value="HI">Hawaii</option><option value="ID">Idaho</option>
                          <option value="IL">Illinois</option><option value="IN">Indiana</option>
                          <option value="IA">Iowa</option><option value="KS">Kansas</option>
                          <option value="KY">Kentucky</option><option value="LA">Louisiana</option>
                          <option value="ME">Maine</option><option value="MD">Maryland</option>
                          <option value="MA">Massachusetts</option><option value="MI">Michigan</option>
                          <option value="MN">Minnesota</option><option value="MS">Mississippi</option>
                          <option value="MO">Missouri</option><option value="MT">Montana</option>
                          <option value="NE">Nebraska</option><option value="NV">Nevada</option>
                          <option value="NH">New Hampshire</option><option value="NJ">New Jersey</option>
                          <option value="NM">New Mexico</option><option value="NY">New York</option>
                          <option value="NC">North Carolina</option><option value="ND">North Dakota</option>
                          <option value="OH">Ohio</option><option value="OK">Oklahoma</option>
                          <option value="OR">Oregon</option><option value="PA">Pennsylvania</option>
                          <option value="RI">Rhode Island</option><option value="SC">South Carolina</option>
                          <option value="SD">South Dakota</option><option value="TN">Tennessee</option>
                          <option value="TX">Texas</option><option value="UT">Utah</option>
                          <option value="VT">Vermont</option><option value="VA">Virginia</option>
                          <option value="WA">Washington</option><option value="WV">West Virginia</option>
                          <option value="WI">Wisconsin</option><option value="WY">Wyoming</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-[#0F1111] mb-2">ZIP Code *</label>
                        <input
                          type="text"
                          value={shippingAddress.zipCode}
                          onChange={(e) => {
                            let value = e.target.value.replace(/\D/g, '')
                            if (value.length > 5) {
                              value = value.slice(0, 5) + '-' + value.slice(5, 9)
                            }
                            setShippingAddress({...shippingAddress, zipCode: value})
                          }}
                          placeholder="12345 or 12345-6789"
                          maxLength="10"
                          className="w-full border border-[#D5D9D9] rounded px-3 py-2 focus:border-[#FF9900] focus:ring-1 focus:ring-[#FF9900] outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-[#0F1111] mb-2">Phone *</label>
                        <input
                          type="tel"
                          value={shippingAddress.phone}
                          onChange={(e) => {
                            let value = e.target.value.replace(/\D/g, '')
                            if (value.length >= 6) {
                              value = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6, 10)}`
                            } else if (value.length >= 3) {
                              value = `(${value.slice(0, 3)}) ${value.slice(3)}`
                            }
                            setShippingAddress({...shippingAddress, phone: value})
                          }}
                          placeholder="(555) 123-4567"
                          maxLength="14"
                          className="w-full border border-[#D5D9D9] rounded px-3 py-2 focus:border-[#FF9900] focus:ring-1 focus:ring-[#FF9900] outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#D5D9D9]">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useSameAddress}
                          onChange={(e) => setUseSameAddress(e.target.checked)}
                          className="accent-[#FF9900]"
                        />
                        <span className="text-sm text-[#0F1111]">Billing address same as shipping</span>
                      </label>
                    </div>

                    {/* ── Coupon Code Section ── */}
                    <div className="pt-4 border-t border-[#D5D9D9]">
                      <label className="block font-semibold text-[#0F1111] mb-2">Promo / Coupon Code</label>

                      {appliedCoupon ? (
                        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded px-3 py-2">
                          <div>
                            <span className="font-semibold text-green-700">{appliedCoupon.code}</span>
                            <span className="text-green-600 text-sm ml-2">
                              {appliedCoupon.discount_type === 'percentage'
                                ? `${appliedCoupon.discount_value}% off`
                                : `$${appliedCoupon.discount_value} off`}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveCoupon}
                            className="text-red-500 hover:text-red-700 text-sm font-semibold"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleApplyCoupon())}
                            placeholder="Enter coupon code"
                            className="flex-1 border border-[#D5D9D9] rounded px-3 py-2 focus:border-[#FF9900] focus:ring-1 focus:ring-[#FF9900] outline-none uppercase"
                          />
                          <button
                            type="button"
                            onClick={handleApplyCoupon}
                            disabled={couponLoading || !couponCode.trim()}
                            className="bg-[#FF9900] hover:bg-[#F08804] disabled:bg-gray-300 text-white px-4 py-2 rounded font-semibold transition-colors"
                          >
                            {couponLoading ? '...' : 'Apply'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-6 bg-[#FF9900] hover:bg-[#F08804] text-white py-3 rounded font-semibold transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Continue to Payment'}
                  </button>
                </form>
              </div>
            )}

            {/* Step 2: Payment Method */}
            {step === 2 && clientSecret && (
              <div className="space-y-6">
                <div className="bg-white border border-[#D5D9D9] rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-[#0F1111]">Shipping Address</h2>
                    <button
                      onClick={() => setStep(1)}
                      className="text-[#007185] hover:text-[#C7511F] hover:underline"
                      disabled={loading}
                    >
                      Edit
                    </button>
                  </div>
                  <div className="text-sm text-[#0F1111]">
                    <p className="font-semibold">{shippingAddress.fullName}</p>
                    <p className="text-[#565959]">{shippingAddress.email}</p>
                    <p className="text-[#565959]">{shippingAddress.address}</p>
                    <p className="text-[#565959]">{shippingAddress.city}, {shippingAddress.state} {shippingAddress.zipCode}</p>
                    <p className="text-[#565959]">{shippingAddress.phone}</p>
                  </div>
                </div>

                <div className="bg-white border border-[#D5D9D9] rounded-lg p-6">
                  <h2 className="text-2xl font-bold text-[#0F1111] mb-6">Payment Information</h2>

                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <StripeCheckoutForm
                      cartItems={items}
                      shippingAddress={shippingAddress}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                    />
                  </Elements>

                  <div className="mt-4 pt-4 border-t border-[#D5D9D9]">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      disabled={loading}
                      className="w-full border border-[#D5D9D9] py-3 rounded font-semibold hover:bg-[#F7F8F8] transition-colors text-[#0F1111] disabled:opacity-50"
                    >
                      Back to Shipping
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-[#D5D9D9] rounded-lg p-6 sticky top-5">
              <h3 className="text-xl font-bold text-[#0F1111] mb-4">Order Summary</h3>

              <div className="space-y-3 mb-4 pb-4 border-b border-[#D5D9D9]">
                <div className="flex justify-between text-sm text-[#0F1111]">
                  <span>Items ({items.length}):</span>
                  <span className="font-semibold">${subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount ({appliedCoupon?.code}):</span>
                    <span className="font-semibold">-${discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-[#0F1111]">
                  <span>Shipping:</span>
                  <span className="font-semibold">
                    {shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-[#0F1111]">
                  <span>Tax (8%):</span>
                  <span className="font-semibold">${tax.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between text-xl font-bold text-[#B12704] mb-4">
                <span>Order Total:</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>

              <div className="border-t border-[#D5D9D9] pt-4">
                <h4 className="font-semibold text-[#0F1111] mb-3">Items in your order:</h4>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      {item.image && item.image.startsWith('http') ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-16 h-16 object-cover rounded border border-[#D5D9D9]"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="60"%3E%3Crect fill="%23f3f4f6" width="60" height="60"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="30"%3E%F0%9F%93%A6%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-3xl rounded border border-[#D5D9D9]">
                          📦
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#0F1111] line-clamp-2">{item.name}</p>
                        <p className="text-sm text-[#565959]">Qty: {item.quantity}</p>
                        <p className="text-sm font-bold text-[#B12704]">${(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CheckoutPage
