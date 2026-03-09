import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { addToCart } from '../../store/slices/cartSlice'
import { toast } from 'react-hot-toast'
import api from '../../config/api'
import StartChatButton from '../../components/chat/StartChatButton'
import { PLACEHOLDERS } from '../../utils/imagePlaceholder'
import { useLanguage } from '../../i18n/LanguageContext'

const ProductPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated)
  const { t } = useLanguage()
  
  // Core product state
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)
  
  // Enhanced features state
  const [stockStatus, setStockStatus] = useState('IN_STOCK')
  const [availableQuantity, setAvailableQuantity] = useState(0)
  const [badges, setBadges] = useState([])
  const [productImages, setProductImages] = useState([])
  const [addingToCart, setAddingToCart] = useState(false)
  
  // Wishlist state
  const [isInWishlist, setIsInWishlist] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)

  // Animation state
  const [imgKey, setImgKey] = useState(0)          // triggers fade on image switch
  const [cartBtnClass, setCartBtnClass] = useState('')
  const [heartClass, setHeartClass] = useState('')
  const [pageReady, setPageReady] = useState(false)

  // 3D image tilt state
  const imgRef = useRef(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [isImgHovering, setIsImgHovering] = useState(false)

  // Ripple effect state
  const [ripple, setRipple] = useState(null)
  const cartBtnRef = useRef(null)

  // Variant state
  const [variants, setVariants] = useState([])
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [selectedOptions, setSelectedOptions] = useState({}) // e.g. {color: 'Red', size: 'M'}
  const [variantAttributes, setVariantAttributes] = useState({}) // e.g. {color: ['Red','Blue'], size: ['S','M','L']}

  useEffect(() => {
    if (id) {
      fetchProduct()
      checkWishlistStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const fetchProduct = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('Fetching product:', id)
      
      // Fetch product from enhanced view
      const response = await api.get(`/products/${id}`)
      const productData = response
      
      console.log('Product data received:', productData)
      
      // Normalize product data
      const normalizedProduct = {
        ...productData,
        name: productData.title || productData.name,
        image: productData.image_url || productData.image,
        price: Number(productData.price),
        original_price: productData.compare_at_price ? Number(productData.compare_at_price) : null,
        rating: productData.average_rating || productData.rating || null,
        reviews_count: productData.total_reviews || productData.reviews_count || 0,
        seller_name: productData.seller_name || 'FastShop',
        seller_id: productData.seller_id || 1,
        stock_status: productData.stock_status || 'IN_STOCK',
        available_quantity: productData.available_quantity || 100,
        badges: productData.badges || [],
        max_quantity_per_order: productData.max_quantity_per_order || 10,
        min_quantity_per_order: productData.min_quantity_per_order || 1
      }
      
      setProduct(normalizedProduct)
      setStockStatus(normalizedProduct.stock_status)
      setAvailableQuantity(normalizedProduct.available_quantity)
      // Trigger reveal animation after data loads
      setTimeout(() => setPageReady(true), 50)
      
      // Safely parse badges
      let parsedBadges = []
      if (normalizedProduct.badges) {
        if (typeof normalizedProduct.badges === 'string') {
          try {
            parsedBadges = JSON.parse(normalizedProduct.badges)
          } catch (e) {
            console.warn('Failed to parse badges:', e)
            parsedBadges = []
          }
        } else if (Array.isArray(normalizedProduct.badges)) {
          parsedBadges = normalizedProduct.badges
        }
      }
      setBadges(parsedBadges)
      
      // Set product images
      const images = productData.images || (productData.image_url ? [productData.image_url] : [productData.image || PLACEHOLDERS.product])
      setProductImages(images)

      // Fetch variants if available
      if (productData.variants && productData.variants.length > 0) {
        processVariants(productData.variants)
      } else {
        // Try fetching variants separately
        try {
          const variantData = await api.get(`/variants/products/${id}`)
          const variantList = variantData.variants || variantData || []
          if (variantList.length > 0) {
            processVariants(variantList)
          }
        } catch (e) {
          // No variants, that's fine
        }
      }

    } catch (err) {
      console.error('Error fetching product:', err)
      setError(err.message || 'Failed to load product')
      toast.error('Failed to load product')
    } finally {
      setLoading(false)
    }
  }

  const processVariants = (variantList) => {
    setVariants(variantList)

    // Extract unique attribute values
    const attrs = {}
    variantList.forEach(v => {
      if (v.attributes) {
        Object.entries(v.attributes).forEach(([key, val]) => {
          if (!attrs[key]) attrs[key] = []
          if (!attrs[key].includes(val)) attrs[key].push(val)
        })
      } else {
        // Support flat fields: color, size, storage, material, style
        ;['color', 'size', 'storage', 'material', 'style'].forEach(field => {
          if (v[field]) {
            if (!attrs[field]) attrs[field] = []
            if (!attrs[field].includes(v[field])) attrs[field].push(v[field])
          }
        })
      }
    })
    setVariantAttributes(attrs)

    // Auto-select first active variant
    const firstActive = variantList.find(v => v.is_active !== false && v.stock_quantity > 0) || variantList[0]
    if (firstActive) {
      selectVariant(firstActive, attrs, variantList)
    }
  }

  const selectVariant = (variant, attrs = variantAttributes, variantList = variants) => {
    setSelectedVariant(variant)
    const opts = {}
    if (variant.attributes) {
      Object.assign(opts, variant.attributes)
    } else {
      ;['color', 'size', 'storage', 'material', 'style'].forEach(field => {
        if (variant[field]) opts[field] = variant[field]
      })
    }
    setSelectedOptions(opts)

    // Update price if variant has override
    if (variant.price) {
      setProduct(prev => prev ? { ...prev, price: Number(variant.price) } : prev)
    }

    // Update stock from variant
    if (variant.stock_quantity !== undefined) {
      const qty = Number(variant.stock_quantity)
      setAvailableQuantity(qty)
      setStockStatus(qty === 0 ? 'OUT_OF_STOCK' : qty <= 5 ? 'LOW_STOCK' : 'IN_STOCK')
    }
  }

  const handleOptionSelect = (attrKey, value) => {
    const newOpts = { ...selectedOptions, [attrKey]: value }
    setSelectedOptions(newOpts)

    // Find matching variant
    const match = variants.find(v => {
      const vAttrs = v.attributes || {}
      ;['color', 'size', 'storage', 'material', 'style'].forEach(f => {
        if (v[f]) vAttrs[f] = v[f]
      })
      return Object.entries(newOpts).every(([k, val]) => vAttrs[k] === val)
    })

    if (match) selectVariant(match)
  }

  const isOptionAvailable = (attrKey, value) => {
    const newOpts = { ...selectedOptions, [attrKey]: value }
    return variants.some(v => {
      const vAttrs = v.attributes || {}
      ;['color', 'size', 'storage', 'material', 'style'].forEach(f => {
        if (v[f]) vAttrs[f] = v[f]
      })
      const matches = Object.entries(newOpts).every(([k, val]) => vAttrs[k] === val)
      return matches && (v.stock_quantity === undefined || v.stock_quantity > 0)
    })
  }

  const handleAddToCart = async () => {
    if (!product) return

    // Redirect unauthenticated users to login
    if (!isAuthenticated) {
      toast(t('pleaseSignInCart'), { icon: '🔒', duration: 3000 })
      navigate(`/login?redirect=/product/${id}`)
      return
    }

    // Validate stock
    if (stockStatus === 'OUT_OF_STOCK') {
      toast.error(t('outOfStockError'))
      return
    }
    
    // Validate quantity
    if (quantity > availableQuantity) {
      toast.error(t('onlyAvailable', { qty: availableQuantity }))
      return
    }
    
    if (quantity > product.max_quantity_per_order) {
      toast.error(t('maxPerOrder', { max: product.max_quantity_per_order }))
      return
    }
    
    setAddingToCart(true)
    setCartBtnClass('pdp-btn-adding')
    setTimeout(() => setCartBtnClass(''), 420)

    // Trigger ripple from button center
    if (cartBtnRef.current) {
      const rect = cartBtnRef.current.getBoundingClientRect()
      setRipple({ x: rect.width / 2 - 25, y: rect.height / 2 - 25 })
      setTimeout(() => setRipple(null), 700)
    }
    
    try {
      // Add to cart with inventory locking
      const cartItem = {
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity,
        variantId: selectedVariant?.id || null,
        price_at_add: product.price // Track price at time of adding
      }
      
      dispatch(addToCart(cartItem))
      toast.success(t('addedToCart'), {
        duration: 2000,
        style: { background: '#067D62', color: '#fff' }
      })
      
    } catch (err) {
      console.error('Error adding to cart:', err)
      toast.error(t('failedAddCart'))
    } finally {
      setAddingToCart(false)
    }
  }

  const handleBuyNow = async () => {
    if (!product) return

    // Redirect unauthenticated users to login
    if (!isAuthenticated) {
      toast(t('pleaseSignIn'), { icon: '🔒', duration: 3000 })
      navigate(`/login?redirect=/product/${id}`)
      return
    }

    // Validate stock
    if (stockStatus === 'OUT_OF_STOCK') {
      toast.error(t('outOfStockError'))
      return
    }
    
    setAddingToCart(true)
    
    try {
      const cartItem = {
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity,
        variantId: selectedVariant?.id || null,
        price_at_add: product.price
      }

      dispatch(addToCart(cartItem))
      navigate('/checkout')
    } catch (err) {
      console.error('Error:', err)
      toast.error(t('failedCheckout'))
      setAddingToCart(false)
    }
  }

  const checkWishlistStatus = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return // User not logged in
      
      const response = await api.get(`/wishlist/check/${id}`)
      setIsInWishlist(response.isInWishlist)
    } catch (err) {
      console.error('Error checking wishlist status:', err)
    }
  }

  const handleToggleWishlist = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        toast.error(t('pleaseLoginWishlist'))
        navigate('/login')
        return
      }
      
      setWishlistLoading(true)
      
      setHeartClass('pdp-heart-bounce')
      setTimeout(() => setHeartClass(''), 600)
      if (isInWishlist) {
        await api.delete(`/wishlist/${id}`)
        setIsInWishlist(false)
        toast.success(t('removedFromWishlist'))
      } else {
        await api.post('/wishlist', { productId: id })
        setIsInWishlist(true)
        toast.success(t('addedToWishlist'))
      }
    } catch (err) {
      console.error('Error toggling wishlist:', err)
      toast.error(err.response?.data?.message || t('failedUpdateWishlist'))
    } finally {
      setWishlistLoading(false)
    }
  }

  const handleImgMouseMove = (e) => {
    if (!imgRef.current) return
    const rect = imgRef.current.getBoundingClientRect()
    const x = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2)
    const y = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2)
    setTilt({ x: -x * 10, y: y * 10 })
  }

  // Loading State
  if (loading) {
    return (
      <div className="bg-white min-h-screen">
        <div className="max-w-[1500px] mx-auto px-5 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Image skeleton */}
            <div className="lg:col-span-5 flex gap-4">
              <div className="flex flex-col gap-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="pdp-shimmer w-16 h-16 rounded"></div>
                ))}
              </div>
              <div className="pdp-shimmer flex-1 h-[500px] rounded-lg"></div>
            </div>
            {/* Info skeleton */}
            <div className="lg:col-span-4 space-y-4 pt-2">
              <div className="pdp-shimmer h-7 rounded w-3/4"></div>
              <div className="pdp-shimmer h-5 rounded w-1/2"></div>
              <div className="pdp-shimmer h-10 rounded w-1/3"></div>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="pdp-shimmer h-4 rounded" style={{ width: `${70 + i * 5}%` }}></div>
              ))}
            </div>
            {/* Buy box skeleton */}
            <div className="lg:col-span-3">
              <div className="border border-[#D5D9D9] rounded-lg p-5 space-y-4">
                <div className="pdp-shimmer h-10 rounded w-1/2"></div>
                <div className="pdp-shimmer h-20 rounded"></div>
                <div className="pdp-shimmer h-12 rounded"></div>
                <div className="pdp-shimmer h-12 rounded"></div>
                <div className="pdp-shimmer h-12 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Error State
  if (error) {
    return (
      <div className="bg-white min-h-screen">
        <div className="max-w-[1500px] mx-auto px-5 py-5">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-[#0F1111] mb-2">{t('failedToLoadProduct')}</h2>
            <p className="text-[#565959] mb-6">{error}</p>
            <button
              onClick={fetchProduct}
              className="bg-[#FF9900] text-[#0F1111] px-6 py-2 rounded-lg hover:bg-[#F08804] transition-colors font-semibold"
            >
              {t('retry')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Product Not Found
  if (!product) {
    return (
      <div className="bg-white min-h-screen">
        <div className="max-w-[1500px] mx-auto px-5 py-5">
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-2xl font-bold text-[#0F1111] mb-4">{t('productNotFound')}</h2>
            <Link 
              to="/" 
              className="text-[#007185] hover:text-[#C7511F] hover:underline"
            >
              {t('returnToHomepage')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const images = productImages.length > 0 ? productImages : [product.image || PLACEHOLDERS.product]
  const rating = product.rating
  const reviews = product.reviews_count || 0
  const originalPrice = product.original_price
  const savings = originalPrice - product.price
  const savingsPercent = Math.round((savings / originalPrice) * 100)
  
  // Calculate delivery date (simple estimation)
  const deliveryDate = new Date()
  deliveryDate.setDate(deliveryDate.getDate() + 2)
  const deliveryDateStr = deliveryDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  // Badge rendering helper
  const renderBadge = (badge) => {
    if (!badge || !badge.type) return null
    
    const badgeStyles = {
      best_seller: 'bg-[#FF9900] text-white',
      amazons_choice: 'bg-[#232F3E] text-white',
      deal: 'bg-[#CC0C39] text-white',
      limited_time: 'bg-[#B12704] text-white',
      new_arrival: 'bg-[#067D62] text-white',
      top_rated: 'bg-[#007185] text-white'
    }
    
    return (
      <span 
        key={badge.type}
        className={`inline-block px-3 py-1 rounded text-xs font-semibold ${badgeStyles[badge.type] || 'bg-gray-600 text-white'}`}
      >
        {badge.text || badge.type.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  return (
    <div className="bg-white min-h-screen">
      {/* ── PDP Animation Styles ── */}
      <style>{`
        /* ═══════════════════════════════════════════════════════════════
           PRODUCT PAGE — ENHANCED 3D ANIMATION & HOVER SYSTEM V2
           ═══════════════════════════════════════════════════════════════ */

        /* ── Staggered 3D perspective page reveal ── */
        @keyframes pdpReveal3D {
          from { opacity: 0; transform: perspective(1400px) rotateX(14deg) translateY(40px) scale(0.97); }
          to   { opacity: 1; transform: perspective(1400px) rotateX(0deg)  translateY(0px)  scale(1);    }
        }
        .pdp-reveal-ready.pdp-s0 { animation: pdpReveal3D 0.72s cubic-bezier(0.23,1,0.32,1) 0s   both; }
        .pdp-reveal-ready.pdp-s1 { animation: pdpReveal3D 0.72s cubic-bezier(0.23,1,0.32,1) 0.1s both; }
        .pdp-reveal-ready.pdp-s2 { animation: pdpReveal3D 0.72s cubic-bezier(0.23,1,0.32,1) 0.2s both; }
        .pdp-reveal-ready.pdp-s3 { animation: pdpReveal3D 0.72s cubic-bezier(0.23,1,0.32,1) 0.35s both; }

        /* ── 3D flip on thumbnail switch ── */
        @keyframes pdpImg3DFlip {
          from { opacity: 0; transform: perspective(900px) rotateY(-55deg) scale(0.88); }
          to   { opacity: 1; transform: perspective(900px) rotateY(0deg)   scale(1);    }
        }
        .pdp-img-3d-flip { animation: pdpImg3DFlip 0.52s cubic-bezier(0.23,1,0.32,1) both; }

        /* ── Main image 3D tilt container ── */
        .pdp-main-3d {
          transform-style: preserve-3d;
          will-change: transform;
          border-radius: 16px;
          background: #fff;
        }

        /* ── Dynamic shine overlay ── */
        .pdp-img-shine {
          position: absolute; inset: 0;
          border-radius: inherit;
          pointer-events: none; z-index: 3;
          background: radial-gradient(ellipse at 28% 28%, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.12) 45%, transparent 72%);
          transition: opacity 0.4s ease;
        }

        /* ── Thumbnails: 3D depth lift ── */
        .pdp-thumb {
          transition: transform 0.25s cubic-bezier(0.23,1,0.32,1), border-color 0.2s ease, box-shadow 0.25s cubic-bezier(0.23,1,0.32,1);
          transform-style: preserve-3d; background: #fff;
        }
        .pdp-thumb:hover {
          transform: perspective(400px) translateZ(18px) scale(1.09);
          box-shadow: 0 0 0 2.5px #FF9900, 0 14px 30px rgba(0,0,0,0.22);
        }
        .pdp-thumb-active {
          box-shadow: 0 0 0 3px #FF9900, 0 8px 20px rgba(255,153,0,0.28);
          transform: perspective(400px) translateZ(9px) scale(1.05);
        }

        /* ── Add-to-cart press ── */
        @keyframes pdpBtnPress {
          0%   { transform: scale(1); }
          33%  { transform: scale(0.92); }
          66%  { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
        .pdp-btn-adding { animation: pdpBtnPress 0.42s cubic-bezier(0.23,1,0.32,1); }

        /* ── Universal button lift ── */
        .pdp-btn-lift {
          transition: transform 0.22s cubic-bezier(0.23,1,0.32,1), box-shadow 0.22s ease;
          position: relative; overflow: hidden;
        }
        .pdp-btn-lift:hover:not(:disabled) {
          transform: translateY(-3px) scale(1.015);
          box-shadow: 0 10px 28px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.12);
        }
        .pdp-btn-lift:active:not(:disabled) {
          transform: translateY(0) scale(0.97);
          box-shadow: 0 2px 8px rgba(0,0,0,0.14);
        }

        /* ── Add to Cart: yellow glow pulse ── */
        @keyframes pdpYellowGlow {
          0%, 100% { box-shadow: 0 10px 28px rgba(0,0,0,0.2), 0 0 0 0 rgba(255,216,20,0); }
          50%       { box-shadow: 0 10px 28px rgba(0,0,0,0.2), 0 0 26px 5px rgba(255,216,20,0.55); }
        }
        .pdp-btn-addcart:hover:not(:disabled) {
          transform: translateY(-3px) scale(1.015);
          animation: pdpYellowGlow 1.5s ease infinite;
        }

        /* ── Buy Now: orange glow pulse ── */
        @keyframes pdpOrangeGlow {
          0%, 100% { box-shadow: 0 10px 28px rgba(0,0,0,0.2), 0 0 0 0 rgba(255,164,28,0); }
          50%       { box-shadow: 0 10px 28px rgba(0,0,0,0.2), 0 0 26px 5px rgba(255,164,28,0.5); }
        }
        .pdp-btn-buynow:hover:not(:disabled) {
          transform: translateY(-3px) scale(1.015);
          animation: pdpOrangeGlow 1.5s ease infinite;
        }

        /* ── Wishlist border hover ── */
        .pdp-btn-wishlist {
          transition: transform 0.22s cubic-bezier(0.23,1,0.32,1), box-shadow 0.22s ease, border-color 0.22s ease, background 0.22s ease;
        }
        .pdp-btn-wishlist:hover:not(:disabled) {
          transform: translateY(-3px) scale(1.015);
          border-color: #FF9900 !important;
          background: #fffbf0;
          box-shadow: 0 10px 28px rgba(0,0,0,0.14), 0 0 18px 2px rgba(255,153,0,0.2);
        }
        .pdp-btn-wishlist:active:not(:disabled) { transform: translateY(0) scale(0.97); }

        /* ── Chat button hover ── */
        .pdp-btn-chat {
          transition: transform 0.22s cubic-bezier(0.23,1,0.32,1), box-shadow 0.22s ease, background 0.22s ease, color 0.22s ease;
        }
        .pdp-btn-chat:hover {
          transform: translateY(-3px) scale(1.015);
          box-shadow: 0 10px 28px rgba(0,113,133,0.3);
        }

        /* ── Heart bounce ── */
        @keyframes pdpHeartBounce {
          0%   { transform: scale(1); }
          25%  { transform: scale(1.65) rotate(-18deg); }
          55%  { transform: scale(0.8) rotate(9deg); }
          75%  { transform: scale(1.22); }
          100% { transform: scale(1); }
        }
        .pdp-heart-bounce { animation: pdpHeartBounce 0.62s cubic-bezier(0.23,1,0.32,1); }

        /* ── Cart ripple ── */
        @keyframes pdpCartRipple {
          0%   { transform: scale(0); opacity: 0.55; }
          100% { transform: scale(4); opacity: 0; }
        }
        .pdp-ripple {
          position: absolute; width: 50px; height: 50px;
          border-radius: 50%; background: rgba(255,255,255,0.45);
          pointer-events: none; transform-origin: center;
          animation: pdpCartRipple 0.65s ease-out forwards;
        }

        /* ── Buy box 3D float card ── */
        .pdp-buybox {
          transition: transform 0.4s cubic-bezier(0.23,1,0.32,1), box-shadow 0.4s ease;
          transform-style: preserve-3d;
        }
        .pdp-buybox:hover {
          transform: perspective(1200px) translateZ(22px) translateY(-7px) rotateX(1.2deg);
          box-shadow: 0 36px 80px rgba(0,0,0,0.16), 0 14px 30px rgba(0,0,0,0.1);
        }

        /* ── Review cards 3D tilt ── */
        .pdp-review-card {
          transition: transform 0.35s cubic-bezier(0.23,1,0.32,1), box-shadow 0.35s ease, background 0.25s ease;
          transform-style: preserve-3d; border-radius: 8px;
        }
        .pdp-review-card:hover {
          transform: perspective(1100px) rotateX(-2.5deg) rotateY(0.6deg) translateY(-5px);
          box-shadow: 0 18px 44px rgba(0,0,0,0.1), 0 5px 14px rgba(0,0,0,0.06);
          background: #fafafa;
        }

        /* ── Helpful button hover ── */
        .pdp-helpful-btn {
          transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .pdp-helpful-btn:hover {
          transform: translateY(-2px) scale(1.04);
          background: #f0f0f0;
          border-color: #FF9900 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        /* ── Floating badge pulse ── */
        @keyframes pdpBadgeFloat {
          0%, 100% { transform: translateY(0)   scale(1);    }
          50%       { transform: translateY(-7px) scale(1.04); }
        }
        .pdp-badge-float { animation: pdpBadgeFloat 3s cubic-bezier(0.45,0.05,0.55,0.95) infinite; display: inline-block; }

        /* ── Price pop on load ── */
        @keyframes pdpPricePop {
          from { opacity:0; transform: scale(0.65) translateY(14px); }
          to   { opacity:1; transform: scale(1)    translateY(0); }
        }
        .pdp-price-pop { animation: pdpPricePop 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.45s both; }

        /* ── Quantity select: focus glow ── */
        .pdp-qty-select:focus {
          border-color: #FF9900 !important;
          box-shadow: 0 0 0 3px rgba(255,153,0,0.28);
          outline: none;
        }
        .pdp-qty-select { transition: border-color 0.2s ease, box-shadow 0.2s ease; }

        /* ── Rating bar animated fill ── */
        .pdp-bar-fill { transition: width 1.25s cubic-bezier(0.23,1,0.32,1) 0.5s; }

        /* ── Skeleton shimmer ── */
        @keyframes pdpShimmer {
          0%   { background-position: -900px 0; }
          100% { background-position:  900px 0; }
        }
        .pdp-shimmer {
          background: linear-gradient(90deg, #f0f0f0 25%, #e6e6e6 50%, #f0f0f0 75%);
          background-size: 900px 100%;
          animation: pdpShimmer 1.5s infinite linear;
        }

        /* ── Star micro-interaction ── */
        @keyframes pdpStarPop {
          0%   { transform: scale(1) rotate(0deg); }
          40%  { transform: scale(1.55) rotate(18deg); }
          70%  { transform: scale(0.88) rotate(-6deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .pdp-star:hover { animation: pdpStarPop 0.42s cubic-bezier(0.23,1,0.32,1); display:inline-block; }

        /* ── Product detail row hover ── */
        .pdp-detail-row {
          transition: background 0.15s ease, padding-left 0.2s cubic-bezier(0.23,1,0.32,1);
          border-radius: 3px; padding-left: 4px;
        }
        .pdp-detail-row:hover { background: #f4f6f6; padding-left: 12px; }

        /* ── About-this-item bullets ── */
        .pdp-bullet {
          transition: transform 0.2s cubic-bezier(0.23,1,0.32,1), color 0.15s ease;
        }
        .pdp-bullet:hover { transform: translateX(7px); }
        .pdp-bullet:hover::before { color: #FF9900 !important; }

        /* ── Rating bar row interactive ── */
        .pdp-rating-row { transition: transform 0.18s ease; cursor: pointer; }
        .pdp-rating-row:hover { transform: translateX(4px); }
        .pdp-rating-row:hover .pdp-bar-fill { filter: brightness(1.2); }

        /* ── Buy-box info / seller rows ── */
        .pdp-seller-row {
          transition: background 0.14s ease, padding-left 0.2s cubic-bezier(0.23,1,0.32,1);
          border-radius: 4px; padding: 3px 8px; margin: 0 -8px;
        }
        .pdp-seller-row:hover { background: #edf2f2; padding-left: 14px; }

        /* ── Section headings: hover teal ── */
        .pdp-section-h3 { transition: color 0.18s ease; cursor: default; }
        .pdp-section-h3:hover { color: #007185; }

        /* ── Prime / delivery badge ── */
        .pdp-prime-badge {
          transition: transform 0.22s cubic-bezier(0.23,1,0.32,1), box-shadow 0.22s ease;
          display: inline-flex;
        }
        .pdp-prime-badge:hover {
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 8px 22px rgba(0,113,133,0.38);
        }

        /* ── Variant text buttons 3D ── */
        .pdp-variant-btn {
          transition: transform 0.18s cubic-bezier(0.23,1,0.32,1), box-shadow 0.18s ease, border-color 0.15s ease, background 0.15s ease;
        }
        .pdp-variant-btn:hover:not([disabled]):not(.pdp-variant-disabled) {
          transform: translateY(-2px) perspective(400px) translateZ(10px);
          box-shadow: 0 8px 22px rgba(0,0,0,0.18);
        }
        .pdp-variant-btn:active:not([disabled]):not(.pdp-variant-disabled) { transform: scale(0.94); }

        /* ── Delivery info box ── */
        .pdp-delivery-box {
          transition: transform 0.22s cubic-bezier(0.23,1,0.32,1), box-shadow 0.22s ease;
        }
        .pdp-delivery-box:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        }

        /* ── Breadcrumb item ── */
        .pdp-breadcrumb-sep {
          transition: transform 0.15s ease;
          display: inline-block;
        }
        .pdp-breadcrumb-sep:hover { transform: scaleX(1.5); }

        /* ── Author / seller link ── */
        .pdp-seller-link {
          transition: color 0.15s ease, letter-spacing 0.15s ease;
        }
        .pdp-seller-link:hover { letter-spacing: 0.01em; }

        /* ── Mobile: reduce heavy 3D ── */
        @media (max-width: 768px) {
          .pdp-main-3d { will-change: auto; }
          .pdp-buybox:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.1); }
          .pdp-review-card:hover { transform: translateY(-3px); box-shadow: 0 8px 22px rgba(0,0,0,0.08); }
          .pdp-btn-lift:hover:not(:disabled),
          .pdp-btn-addcart:hover:not(:disabled),
          .pdp-btn-buynow:hover:not(:disabled),
          .pdp-btn-wishlist:hover:not(:disabled) { transform: translateY(-2px); }
          .pdp-bullet:hover { transform: translateX(4px); }
          .pdp-detail-row:hover { padding-left: 8px; }
        }
      `}</style>

      {/* Breadcrumb */}
      <div className="border-b border-[#D5D9D9]">
        <div className="max-w-[1500px] mx-auto px-5 py-4 text-sm">
          <Link to="/" className="pdp-seller-link text-[#007185] hover:text-[#C7511F] hover:underline">Home</Link>
          <span className="pdp-breadcrumb-sep mx-2 text-[#565959]">›</span>
          <Link to={`/category/${product.category}`} className="pdp-seller-link text-[#007185] hover:text-[#C7511F] hover:underline">
            {product.category}
          </Link>
          <span className="pdp-breadcrumb-sep mx-2 text-[#565959]">›</span>
          <span className="text-[#0F1111] font-medium">{product.name}</span>
        </div>
      </div>

      {/* Product Container */}
      <div className="max-w-[1500px] mx-auto px-5 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Image Gallery - 5 columns */}
          <div className={`lg:col-span-5 pdp-s0 ${pageReady ? 'pdp-reveal-ready' : 'opacity-0'}`}>
            <div className="flex gap-3">
              {/* Thumbnails */}
              <div className="flex flex-col gap-2">
                {images.map((img, index) => (
                  <div
                    key={index}
                    onClick={() => { setSelectedImage(index); setImgKey(k => k + 1) }}
                    className={`pdp-thumb w-[88px] h-[88px] border-2 rounded-lg cursor-pointer flex items-center justify-center ${selectedImage === index ? 'pdp-thumb-active border-[#FF9900]' : 'border-[#D5D9D9]'
                      }`}
                  >
                    {img && img.startsWith('http') ? (
                      <img 
                        src={img} 
                        alt={`${product.name} ${index + 1}`} 
                        className="w-full h-full object-cover rounded-md"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="88" height="88"%3E%3Crect fill="%23f3f4f6" width="88" height="88"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="40"%3E📦%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-3xl rounded-md">
                        📦
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Main Image */}
              <div className="flex-1">
                <div
                  ref={imgRef}
                  className="pdp-main-3d border border-[#D5D9D9] rounded-xl overflow-hidden relative cursor-zoom-in"
                  onMouseMove={handleImgMouseMove}
                  onMouseEnter={() => setIsImgHovering(true)}
                  onMouseLeave={() => { setIsImgHovering(false); setTilt({ x: 0, y: 0 }) }}
                  style={{
                    transform: isImgHovering
                      ? `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(1.03,1.03,1.03)`
                      : 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)',
                    transition: isImgHovering ? 'transform 0.08s linear' : 'transform 0.65s cubic-bezier(0.23,1,0.32,1)',
                  }}
                >
                  {/* Glass shine overlay — moves with tilt */}
                  <div className="pdp-img-shine" style={{ opacity: isImgHovering ? 1 : 0 }} />
                  {/* Badges Overlay */}
                  {badges && badges.length > 0 && (
                    <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
                      {badges.slice(0, 2).map((badge, idx) => badge && <span key={idx} className="pdp-badge-float">{renderBadge(badge)}</span>)}
                    </div>
                  )}
                  {images[selectedImage] && images[selectedImage].startsWith('http') ? (
                    <img
                      key={imgKey}
                      src={images[selectedImage]}
                      alt={product.name}
                      className="pdp-img-3d-flip w-full h-[660px] object-contain"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="660" height="660"%3E%3Crect fill="%23f3f4f6" width="660" height="660"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="160"%3E📦%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  ) : (
                      <div key={imgKey} className="pdp-img-3d-flip w-full h-[660px] bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-9xl">
                      📦
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Product Info - 4 columns */}
          <div className={`lg:col-span-4 pdp-s1 ${pageReady ? 'pdp-reveal-ready' : 'opacity-0'}`}>
            {/* Badges */}
            {badges && badges.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {badges.map((badge, idx) => badge && <span key={idx}>{renderBadge(badge)}</span>)}
              </div>
            )}
            
            <h1 className="text-2xl font-normal text-[#0F1111] mb-2 leading-tight">{product.name}</h1>
            
            <Link to={`/seller/${product.seller_id}`} className="pdp-seller-link text-[#007185] hover:text-[#C7511F] hover:underline text-sm inline-block mb-3">
              {t('visitStore', { name: product.seller_name || 'Store' })}
            </Link>
            
            {/* Rating Section */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#D5D9D9]">
              <div className="flex text-[#FF9900] text-lg gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="pdp-star">{i < Math.floor(rating) ? '★' : '☆'}</span>
                ))}
              </div>
              <a href="#reviews" className="pdp-seller-link text-[#007185] hover:text-[#C7511F] hover:underline text-sm">
                {rating} {t('outOfFiveStars')}
              </a>
              <a href="#reviews" className="pdp-seller-link text-[#007185] hover:text-[#C7511F] hover:underline text-sm">{reviews.toLocaleString()} {t('ratings')}</a>
            </div>

            {/* Price Section */}
            <div className="mb-4 pb-4 border-b border-[#D5D9D9]">
              <div className="text-sm text-[#565959] mb-1">{t('price')}</div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl text-[#B12704] font-normal">${product.price.toFixed(2)}</span>
                {originalPrice > product.price && (
                  <>
                    <span className="text-sm text-[#565959] line-through">${originalPrice.toFixed(2)}</span>
                    <span className="text-sm text-[#CC0C39]">Save ${savings.toFixed(2)} ({savingsPercent}%)</span>
                  </>
                )}
              </div>
              <div className="pdp-prime-badge items-center gap-2 bg-[#007185] text-white px-3 py-1 rounded text-sm cursor-pointer">
                <span>⚡</span>
                <span>{t('freePrimeDelivery')}</span>
              </div>
            </div>

            {/* Variant Selection */}
            {Object.keys(variantAttributes).length > 0 && (
              <div className="mb-6 pb-4 border-b border-[#D5D9D9]">
                {Object.entries(variantAttributes).map(([attrKey, values]) => (
                  <div key={attrKey} className="mb-4">
                    <div className="text-sm font-semibold text-[#0F1111] mb-2 capitalize">
                      {attrKey}:{' '}
                      <span className="font-normal text-[#565959]">{selectedOptions[attrKey] || ''}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {values.map(value => {
                        const isSelected = selectedOptions[attrKey] === value
                        const available = isOptionAvailable(attrKey, value)

                        if (attrKey === 'color') {
                          // Color swatch style
                          const colorMap = {
                            red: '#dc2626', blue: '#2563eb', green: '#16a34a', black: '#111827',
                            white: '#f9fafb', yellow: '#f59e0b', purple: '#7c3aed', pink: '#db2777',
                            orange: '#ea580c', gray: '#6b7280', grey: '#6b7280', silver: '#9ca3af',
                            gold: '#d97706', navy: '#1e3a5f', brown: '#92400e'
                          }
                          const bgColor = colorMap[value.toLowerCase()] || '#9ca3af'
                          return (
                            <button
                              key={value}
                              onClick={() => available && handleOptionSelect(attrKey, value)}
                              title={value}
                              className={`w-9 h-9 rounded-full border-2 transition-all ${
                                isSelected ? 'border-[#FF9900] scale-110' : 'border-[#D5D9D9] hover:border-[#565959]'
                              } ${!available ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                              style={{ backgroundColor: bgColor }}
                            />
                          )
                        }

                        // Text button style (size, storage, etc.)
                        return (
                          <button
                            key={value}
                            onClick={() => available && handleOptionSelect(attrKey, value)}
                            className={`pdp-variant-btn px-3 py-1.5 text-sm border rounded ${
                              isSelected
                                ? 'border-[#FF9900] bg-[#FFF3cd] text-[#0F1111] font-semibold'
                                : available
                                ? 'border-[#D5D9D9] text-[#0F1111] hover:border-[#565959]'
                                : 'pdp-variant-disabled border-[#D5D9D9] text-[#A0A0A0] line-through cursor-not-allowed'
                            }`}
                          >
                            {value}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {selectedVariant?.sku && (
                  <p className="text-xs text-[#565959] mt-1">SKU: {selectedVariant.sku}</p>
                )}
              </div>
            )}

            {/* About This Item */}
            <div className="mb-6">
              <h3 className="pdp-section-h3 font-bold text-[#0F1111] mb-3">{t('aboutThisItem')}</h3>
              <ul className="space-y-2">
                {[
                  product.description,
                  t('premiumQuality'),
                  t('fastShipping'),
                  t('thirtyDayReturn'),
                  t('secureTransactionItem')
                ].filter(Boolean).map((item, i) => (
                  <li key={i} className="pdp-bullet text-sm text-[#0F1111] pl-5 relative before:content-['•'] before:absolute before:left-0 before:font-bold">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Product Details */}
            <div className="mb-6">
              <h3 className="pdp-section-h3 font-bold text-[#0F1111] mb-3">{t('productDetails')}</h3>
              <div className="space-y-0">
                {[
                  { key: t('sku'), value: product.sku || product.id },
                  { key: t('stockStatus'), value: stockStatus === 'IN_STOCK' ? t('inStock').replace('\u2713 ', '') : stockStatus === 'LOW_STOCK' ? `Low Stock (${availableQuantity} left)` : t('outOfStock').replace('\u2717 ', ''), stockKey: true },
                  { key: t('returns'), value: t('thirtyDayReturn') },
                  { key: t('shipping'), value: t('freeStandardDelivery') },
                  ...(product.specifications ? Object.entries(product.specifications).map(([k, v]) => ({ key: k, value: v })) : [])
                ].map(({ key, value, stockKey }) => (
                  <div key={key} className="pdp-detail-row flex py-2 border-b border-[#F7F8F8]">
                    <div className="font-semibold text-[#0F1111] w-36 text-sm flex-shrink-0">{key}</div>
                    <div className={`flex-1 text-sm ${stockKey
                      ? stockStatus === 'IN_STOCK' ? 'text-[#067D62] font-semibold'
                        : stockStatus === 'LOW_STOCK' ? 'text-[#B12704] font-semibold'
                          : 'text-[#CC0C39] font-semibold'
                      : 'text-[#0F1111]'
                      }`}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Buy Box - 3 columns */}
          <div className={`lg:col-span-3 pdp-s2 ${pageReady ? 'pdp-reveal-ready' : 'opacity-0'}`}>
            <div className="pdp-buybox border border-[#D5D9D9] rounded-lg p-5 sticky top-5">
              <div className="pdp-price-pop text-3xl text-[#B12704] font-normal mb-3">${product.price.toFixed(2)}</div>
              
              {/* Delivery Info */}
              <div className="pdp-delivery-box bg-[#F7F8F8] rounded p-3 mb-4">
                <p className="text-sm text-[#0F1111] mb-1">
                  <strong>{t('freeDelivery')}</strong> <span className="text-[#067D62] font-semibold">{deliveryDateStr}</span>
                </p>
                <p className="text-sm text-[#0F1111] mb-1">
                  {t('orderWithin')} <strong>5 hrs 23 mins</strong>
                </p>
                <p className="text-sm text-[#0F1111]">📍 {t('deliverTo2')} New York 10001</p>
              </div>
              
              {/* Stock Status */}
              {stockStatus === 'IN_STOCK' && (
                <div className="text-[#067D62] font-semibold mb-4">{t('inStock')}</div>
              )}
              {stockStatus === 'LOW_STOCK' && (
                <div className="text-[#B12704] font-semibold mb-4">{t('lowStock', { qty: availableQuantity })}</div>
              )}
              {stockStatus === 'OUT_OF_STOCK' && (
                <div className="text-[#CC0C39] font-semibold mb-4">{t('outOfStock')}</div>
              )}
              
              {/* Quantity Selector */}
              {stockStatus !== 'OUT_OF_STOCK' && (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-[#0F1111] mb-2">{t('quantity')}</label>
                  <select
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="pdp-qty-select w-full border border-[#D5D9D9] rounded px-3 py-2 text-[#0F1111] outline-none"
                  >
                    {[...Array(Math.min(product.max_quantity_per_order, availableQuantity, 10))].map((_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Action Buttons */}
              {stockStatus !== 'OUT_OF_STOCK' && (
                <>
                  <button
                    ref={cartBtnRef}
                    onClick={handleAddToCart}
                    disabled={addingToCart}
                    className={`pdp-btn-lift pdp-btn-addcart w-full bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] py-3 rounded-lg font-semibold mb-2 disabled:opacity-50 disabled:cursor-not-allowed ${cartBtnClass}`}
                  >
                    {ripple && (
                      <span className="pdp-ripple" style={{ left: ripple.x, top: ripple.y }} />
                    )}
                    {addingToCart ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block w-4 h-4 border-2 border-[#0F1111] border-t-transparent rounded-full animate-spin"></span>
                        {t('adding')}
                      </span>
                    ) : t('addToCart')}
                  </button>

                  <button
                    onClick={handleBuyNow}
                    disabled={addingToCart}
                    className="pdp-btn-lift pdp-btn-buynow w-full bg-[#FFA41C] hover:bg-[#FF8F00] text-[#0F1111] py-3 rounded-lg font-semibold mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('buyNow')}
                  </button>

                  <button
                    onClick={handleToggleWishlist}
                    disabled={wishlistLoading}
                    className="pdp-btn-wishlist w-full border-2 border-[#D5D9D9] text-[#0F1111] py-3 rounded-lg font-semibold mb-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <span className={`text-xl ${heartClass}`}>{isInWishlist ? '❤️' : '🤍'}</span>
                    {wishlistLoading ? t('updating') : isInWishlist ? t('inWishlist') : t('addToWishlist')}
                  </button>

                  {/* Chat with Seller Button */}
                  <StartChatButton
                    recipientId={product.seller_id}
                    recipientName={product.seller_name || 'Seller'}
                    recipientRole="seller"
                    metadata={{
                      type: 'product_inquiry',
                      productId: product.id,
                      productName: product.name,
                      productPrice: product.price
                    }}
                    className="pdp-btn-chat w-full border-2 border-[#007185] hover:bg-[#007185] text-[#007185] hover:text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                  >
                    <span className="text-xl">💬</span>
                    {t('chatWithSeller')}
                  </StartChatButton>
                </>
              )}
              
              {/* Seller Info */}
              <div className="pt-4 border-t border-[#D5D9D9] text-sm space-y-1">
                <p className="pdp-seller-row text-[#0F1111]">
                  <strong>{t('shipsFrom')}</strong> FastShop
                </p>
                <p className="pdp-seller-row text-[#0F1111]">
                  <strong>{t('soldBy')}</strong>{' '}
                  <Link to={`/seller/${product.seller_id}`} className="pdp-seller-link text-[#007185] hover:text-[#C7511F] hover:underline">
                    {product.seller_name || 'FastShop'}
                  </Link>
                </p>
                <p className="pdp-seller-row text-[#0F1111]">⭐ {t('positiveRatings')} (5,432 {t('ratings')})</p>
                <p className="pdp-seller-row text-[#0F1111]">{t('secureTransaction')}</p>
                <p className="pdp-seller-row text-[#0F1111]">{t('returnPolicy')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Reviews Section */}
        <div className={`mt-12 pdp-s3 ${pageReady ? 'pdp-reveal-ready' : 'opacity-0'}`} id="reviews">
          <h2 className="pdp-section-h3 text-3xl font-bold text-[#0F1111] mb-6">{t('customerReviews')}</h2>
          
          {/* Review Summary */}
          <div className="bg-[#F7F8F8] rounded-lg p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Average Rating */}
              <div className="text-center">
                <div className="text-5xl font-bold text-[#0F1111] mb-2">{rating}</div>
                <div className="flex justify-center text-[#FF9900] text-2xl mb-2 gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="pdp-star">{i < Math.floor(rating) ? '★' : '☆'}</span>
                  ))}
                </div>
                <div className="text-sm text-[#565959]">{reviews.toLocaleString()} ratings</div>
              </div>
              
              {/* Rating Bars */}
              <div className="md:col-span-2 space-y-2">
                {[
                  { stars: 5, percentage: 65 },
                  { stars: 4, percentage: 20 },
                  { stars: 3, percentage: 10 },
                  { stars: 2, percentage: 3 },
                  { stars: 1, percentage: 2 }
                ].map(({ stars, percentage }) => (
                  <div key={stars} className="pdp-rating-row flex items-center gap-3">
                    <a href="#reviews" className="pdp-seller-link w-16 text-sm text-[#007185] hover:underline flex-shrink-0">{t('starRating', { n: stars })}</a>
                    <div className="flex-1 h-4 bg-[#D5D9D9] rounded overflow-hidden">
                      <div
                        className="pdp-bar-fill h-full bg-[#FF9900] rounded"
                        style={{ width: pageReady ? `${percentage}%` : '0%' }}
                      ></div>
                    </div>
                    <a href="#reviews" className="pdp-seller-link w-12 text-right text-sm text-[#007185] hover:underline flex-shrink-0">{percentage}%</a>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Individual Reviews */}
          <div className="space-y-6">
            {[
              {
                name: 'John Smith',
                rating: 5,
                date: 'February 5, 2026',
                verified: true,
                title: 'Amazing sound quality and comfort!',
                text: 'These headphones exceeded my expectations. The noise cancellation is incredible - I can\'t hear anything when it\'s on. The battery life is exactly as advertised, lasting me through multiple long flights. The comfort is outstanding, I can wear them for hours without any discomfort. Highly recommended!',
                helpful: 234
              },
              {
                name: 'Sarah Johnson',
                rating: 4,
                date: 'February 3, 2026',
                verified: true,
                title: 'Great headphones, minor issues',
                text: 'Overall very satisfied with these headphones. The sound quality is excellent and the ANC works well. My only complaint is that the Bluetooth connection occasionally drops when I\'m far from my device. Other than that, they\'re perfect for daily use.',
                helpful: 156
              },
              {
                name: 'Michael Chen',
                rating: 5,
                date: 'January 28, 2026',
                verified: true,
                title: 'Best purchase of the year!',
                text: 'I\'ve tried many headphones over the years, and these are by far the best. The build quality is premium, the sound is crystal clear, and the noise cancellation is top-notch. Worth every penny!',
                helpful: 189
              }
            ].map((review, index) => (
              <div key={index} className="pdp-review-card border-b border-[#D5D9D9] pb-6 rounded-lg px-3 py-2 -mx-3">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-xl">
                    👤
                  </div>
                  <div>
                    <div className="font-semibold text-[#0F1111]">{review.name}</div>
                    <div className="flex text-[#FF9900] gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className="pdp-star">{i < review.rating ? '★' : '☆'}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-[#565959] mb-2">
                  {review.verified && <span className="text-[#FF9900] font-semibold mr-2">{t('verifiedPurchase')}</span>}
                  {t('reviewedIn')} {review.date}
                </div>
                <div className="mb-3">
                  <div className="font-bold text-[#0F1111] mb-1">{review.title}</div>
                  <div className="text-[#0F1111] leading-relaxed">{review.text}</div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <button className="pdp-helpful-btn border border-[#D5D9D9] px-4 py-1 rounded text-[#0F1111]">
                    {t('helpful')}
                  </button>
                  <span className="text-[#565959]">{review.helpful} {t('peopleFoundHelpful')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductPage
