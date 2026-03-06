import { Link, useNavigate } from 'react-router-dom'
import { useAppSelector, useAppDispatch } from '../hooks/redux'
import { logout } from '../store/slices/authSlice'
import { useState, useRef, useEffect } from 'react'
import NotificationCenter from './NotificationCenter'
import { customerAPI } from '../services/api.service'

const Header = () => {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { isAuthenticated, user } = useAppSelector((state) => state.auth)
  const { items } = useAppSelector((state) => state.cart)
  const guestCart = useAppSelector((state) => state.guestCart)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchCategory, setSearchCategory] = useState('All')
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const accountMenuRef = useRef(null)
  const categoryMenuRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) setShowAccountMenu(false)
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target)) setShowCategoryMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      const params = new URLSearchParams({ q: searchQuery })
      if (searchCategory !== 'All') params.set('category', searchCategory)
      navigate(`/search?${params.toString()}`)
    }
  }

  const handleLogout = () => {
    dispatch(logout())
    navigate('/')
    setShowAccountMenu(false)
  }

  const cartCount = isAuthenticated
    ? items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
    : guestCart.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0

  const username = user?.display_name || user?.name || user?.email?.split('@')[0] || 'User'

  const FALLBACK_CATEGORIES = [
    { name: 'Electronics', slug: 'electronics' },
    { name: 'Fashion', slug: 'fashion' },
    { name: 'Home & Kitchen', slug: 'home-kitchen' },
    { name: 'Books', slug: 'books' },
    { name: 'Sports & Outdoors', slug: 'sports-outdoors' },
    { name: 'Beauty & Personal Care', slug: 'beauty-personal-care' },
    { name: 'Toys & Games', slug: 'toys-games' },
    { name: 'Automotive', slug: 'automotive' },
  ]
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES)

  useEffect(() => {
    customerAPI.getCategories()
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.data || []
        if (list.length > 0) {
          setCategories(list.map(cat => ({
            name: cat.name,
            slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-').replace(/&/g, ''),
          })))
        }
      })
      .catch(() => { })
  }, [])

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 1000, width: '100%' }}>
      <style>{`
        /* ── Base reset ── */
        .hdr { background: #0F1111; color: #fff; font-family: Arial, sans-serif; }
        .hdr *, .hdr *::before, .hdr *::after { box-sizing: border-box; }
        .hdr a { color: inherit; text-decoration: none; }

        /* ── Top bar ── */
        .hdr-top { background: #232F3E; font-size: 14px; color: #ccc; }
        .hdr-top-inner { max-width: 1500px; margin: 0 auto; padding: 8px 20px; display: flex; align-items: center; gap: 24px; }
        .hdr-top a { color: #ccc; transition: color .15s; }
        .hdr-top a:hover { color: #fff; text-decoration: underline; }

        /* ── Main bar ── */
        .hdr-main { background: #131921; padding: 12px 20px; display: flex; align-items: center; gap: 14px; transition: box-shadow .2s; }
        .hdr-main.scrolled { box-shadow: 0 4px 20px rgba(0,0,0,.7); }

        /* ── Logo ── */
        .hdr-logo { display: flex; flex-direction: column; padding: 8px 10px; border: 1px solid transparent; border-radius: 3px; flex-shrink: 0; transition: border-color .15s; cursor: pointer; }
        .hdr-logo:hover { border-color: #fff; }
        .hdr-logo-name { font-size: 28px; font-weight: 800; color: #FF9900; letter-spacing: -1px; line-height: 1; }
        .hdr-logo-sub { font-size: 14px; color: #aaa; line-height: 1.2; }

        /* ── Deliver to ── */
        .hdr-deliver { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid transparent; border-radius: 3px; cursor: pointer; flex-shrink: 0; transition: border-color .15s; white-space: nowrap; }
        .hdr-deliver:hover { border-color: #fff; }
        .hdr-deliver-icon { font-size: 24px; }
        .hdr-deliver-line1 { font-size: 13px; color: #ccc; }
        .hdr-deliver-line2 { font-size: 16px; font-weight: 700; color: #fff; }

        /* ── Search bar ── */
        .hdr-search { flex: 1; display: flex; height: 50px; border-radius: 6px; overflow: hidden; min-width: 0; }
        .hdr-search-cat { background: #F3F3F3; border: none; padding: 0 6px 0 10px; font-size: 14px; color: #555; cursor: pointer; border-right: 1px solid #cdcdcd; min-width: 65px; max-width: 150px; flex-shrink: 0; }
        .hdr-search-cat:hover { background: #e6e6e6; }
        .hdr-search-input { flex: 1; border: none; padding: 0 14px; font-size: 17px; color: #111; outline: none; min-width: 0; background: #fff; }
        .hdr-search-input:focus { outline: 3px solid #FF9900; outline-offset: -3px; }
        .hdr-search-btn { background: #FF9900; border: none; padding: 0 20px; cursor: pointer; flex-shrink: 0; transition: background .15s; display: flex; align-items: center; justify-content: center; }
        .hdr-search-btn:hover { background: #e67e00; }

        /* ── Right actions ── */
        .hdr-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .hdr-action { padding: 8px 12px; border: 1px solid transparent; border-radius: 3px; cursor: pointer; transition: border-color .15s; flex-shrink: 0; background: none; color: #fff; text-align: left; text-decoration: none; display: flex; flex-direction: column; }
        .hdr-action:hover { border-color: #fff; }
        .hdr-action-line1 { font-size: 13px; color: #ccc; white-space: nowrap; }
        .hdr-action-line2 { font-size: 15px; font-weight: 700; white-space: nowrap; }

        /* ── Cart ── */
        .hdr-cart { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border: 1px solid transparent; border-radius: 3px; cursor: pointer; transition: border-color .15s; text-decoration: none; color: #fff; }
        .hdr-cart:hover { border-color: #fff; }
        .hdr-cart-wrap { position: relative; }
        .hdr-cart-count { position: absolute; top: -8px; right: -10px; background: #FF9900; color: #111; font-size: 14px; font-weight: 700; min-width: 24px; height: 24px; border-radius: 12px; display: flex; align-items: center; justify-content: center; padding: 0 5px; }
        .hdr-cart-label { font-size: 17px; font-weight: 700; }

        /* ── Dropdowns ── */
        .hdr-dropdown { position: fixed; background: #fff; color: #111; border-radius: 6px; box-shadow: 0 6px 24px rgba(0,0,0,.2); z-index: 99999; animation: hdrFadeIn .12s ease; }
        @keyframes hdrFadeIn { from { opacity:0; transform: translateY(-6px); } to { opacity:1; transform: translateY(0); } }
        .hdr-dd-item { display: block; padding: 10px 20px; font-size: 15px; color: #111; cursor: pointer; white-space: nowrap; transition: background .1s, color .1s; text-align: left; width: 100%; background: none; border: none; text-decoration: none; }
        .hdr-dd-item:hover { background: #f1f1f1; color: #c45500; text-decoration: underline; }
        .hdr-dd-heading { padding: 14px 20px 6px; font-size: 13px; font-weight: 700; color: #777; text-transform: uppercase; letter-spacing: .6px; }
        .hdr-dd-sep { margin: 6px 0; border: none; border-top: 1px solid #e8e8e8; }

        /* ── Nav bar ── */
        .hdr-nav { background: #232F3E; }
        .hdr-nav-inner { max-width: 1500px; margin: 0 auto; padding: 0 12px; display: flex; align-items: center; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; }
        .hdr-nav-inner::-webkit-scrollbar { display: none; }
        .hdr-nav-link { font-size: 15px; color: #fff; padding: 11px 14px; white-space: nowrap; border: 1px solid transparent; border-radius: 3px; transition: border-color .15s; cursor: pointer; background: none; text-decoration: none; display: block; }
        .hdr-nav-link:hover { border-color: #fff; color: #fff; }

        /* ── Mobile hamburger ── */
        .hdr-hamburger { background: none; border: 1px solid transparent; border-radius: 3px; color: #fff; padding: 10px 12px; cursor: pointer; flex-shrink: 0; display: none; align-items: center; gap: 6px; transition: border-color .15s; font-size: 16px; font-weight: 600; }
        .hdr-hamburger:hover { border-color: #fff; }

        /* ── Mobile drawer ── */
        .hdr-drawer { display: none; background: #1a252f; border-top: 1px solid #374151; overflow: hidden; max-height: 0; transition: max-height .3s ease; }
        .hdr-drawer.open { display: block; max-height: 80vh; overflow-y: auto; }
        .hdr-drawer-inner { padding: 16px 20px 24px; }
        .hdr-drawer-user { background: #223044; border-radius: 6px; padding: 16px 18px; margin-bottom: 16px; }
        .hdr-section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #9ca3af; letter-spacing: .8px; padding: 14px 4px 8px; }
        .hdr-drawer-link { display: flex; align-items: center; gap: 14px; padding: 14px 12px; color: #e5e7eb; font-size: 16px; border-radius: 4px; transition: background .12s; text-decoration: none; }
        .hdr-drawer-link:hover { background: rgba(255,255,255,.07); color: #fff; }

        /* ── Responsive ── */
        @media (max-width: 1199px) { .hdr-deliver { display: none; } }
        @media (max-width: 899px) {
          .hdr-main { padding: 10px 14px; gap: 10px; }
          .hdr-action-line1 { display: none; }
          .hdr-cart-label { display: none; }
        }
        @media (max-width: 767px) {
          .hdr-top { display: none; }
          .hdr-main { padding: 10px 12px; gap: 8px; }
          .hdr-hamburger { display: flex; }
          .hdr-search-cat { display: none; }
          .hdr-action-line1, .hdr-action-line2 { display: none; }
          .hdr-orders, .hdr-wishlist, .hdr-notifications { display: none !important; }
          .hdr-cart-label { display: none; }
          .hdr-logo-sub { display: none; }
          .hdr-action { padding: 6px 7px; }
          .hdr-action-icon { font-size: 26px; display: block !important; }
          .hdr-logo-name { font-size: 22px; }
        }
        @media (max-width: 479px) {
          .hdr-main { padding: 8px 10px; gap: 6px; }
          .hdr-logo-name { font-size: 20px; }
          .hdr-search { height: 44px; }
          .hdr-search-btn { padding: 0 16px; }
        }
      `}</style>

      {/* ── Top utility bar (desktop) ── */}
      <div className="hdr-top">
        <div className="hdr-top-inner">
          <span style={{ marginRight: 'auto', color: '#FF9900', fontWeight: 600 }}>
            🚚 FREE delivery on orders over $25
          </span>
          <Link to="/deals">Today's Deals</Link>
          <Link to="/customer-service">Customer Service</Link>
          <Link to="/seller/register">Sell on FastShop</Link>
          {!isAuthenticated && (
            <Link to="/login" style={{ fontWeight: 700, color: '#FF9900' }}>Sign in</Link>
          )}
        </div>
      </div>

      {/* ── Main bar ── */}
      <div className={`hdr-main${scrolled ? ' scrolled' : ''}`}>

        {/* Hamburger (mobile) */}
        <button className="hdr-hamburger" onClick={() => setShowMobileMenu(p => !p)} aria-label="Menu">
          <svg width="24" height="17" viewBox="0 0 24 17" fill="none">
            <rect y="0" width="24" height="2.8" rx="1.4" fill="white" />
            <rect y="7.1" width="24" height="2.8" rx="1.4" fill="white" />
            <rect y="14.2" width="24" height="2.8" rx="1.4" fill="white" />
          </svg>
          All
        </button>

        {/* Logo */}
        <Link to="/" className="hdr-logo">
          <span className="hdr-logo-name">FastShop</span>
          <span className="hdr-logo-sub">.com</span>
        </Link>

        {/* Deliver to (desktop ≥1200px) */}
        <div className="hdr-deliver">
          <span className="hdr-deliver-icon">📍</span>
          <div>
            <div className="hdr-deliver-line1">Deliver to</div>
            <div className="hdr-deliver-line2">United States</div>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="hdr-search">
          <select
            className="hdr-search-cat"
            value={searchCategory}
            onChange={e => setSearchCategory(e.target.value)}
          >
            <option value="All">All</option>
            {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <input
            type="text"
            className="hdr-search-input"
            placeholder="Search FastShop..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="hdr-search-btn" aria-label="Search">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </form>

        {/* Right actions */}
        <div className="hdr-actions">

          {/* Account dropdown */}
          {isAuthenticated ? (
            <div ref={accountMenuRef} style={{ position: 'relative' }}>
              <button
                className="hdr-action"
                onClick={() => setShowAccountMenu(p => !p)}
                onMouseEnter={() => setShowAccountMenu(true)}
              >
                <span className="hdr-action-line1">Hello, {username}</span>
                <span className="hdr-action-line2">Account &amp; Lists ▾</span>
                <span className="hdr-action-icon" style={{ display: 'none', fontSize: 26 }}>👤</span>
              </button>
              {showAccountMenu && (
                <div
                  className="hdr-dropdown"
                  style={{
                    top: (accountMenuRef.current?.getBoundingClientRect().bottom ?? 56) + 4,
                    right: Math.max(0, window.innerWidth - (accountMenuRef.current?.getBoundingClientRect().right ?? 0)),
                    width: 380,
                    paddingBottom: 8,
                  }}
                  onMouseLeave={() => setShowAccountMenu(false)}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                    <div>
                      <div className="hdr-dd-heading">Your Account</div>
                      <button className="hdr-dd-item" onClick={() => { navigate('/account'); setShowAccountMenu(false) }}>Your Account</button>
                      <button className="hdr-dd-item" onClick={() => { navigate('/orders'); setShowAccountMenu(false) }}>Your Orders</button>
                      <button className="hdr-dd-item" onClick={() => { navigate('/wishlist'); setShowAccountMenu(false) }}>Wish List</button>
                      <button className="hdr-dd-item" onClick={() => { navigate('/recommendations'); setShowAccountMenu(false) }}>Recommendations</button>
                    </div>
                    <div>
                      <div className="hdr-dd-heading">Your Lists</div>
                      <button className="hdr-dd-item" onClick={() => { navigate('/lists/create'); setShowAccountMenu(false) }}>Create a List</button>
                      <button className="hdr-dd-item" onClick={() => { navigate('/wishlist'); setShowAccountMenu(false) }}>Find a List</button>
                      {user?.role === 'seller' && <button className="hdr-dd-item" style={{ color: '#c45500', fontWeight: 600 }} onClick={() => { navigate('/seller'); setShowAccountMenu(false) }}>Seller Central</button>}
                      {user?.role === 'admin' && <button className="hdr-dd-item" style={{ color: '#c00', fontWeight: 600 }} onClick={() => { navigate('/admin'); setShowAccountMenu(false) }}>Admin Dashboard</button>}
                      {user?.role === 'manager' && <button className="hdr-dd-item" style={{ color: '#0066c0', fontWeight: 600 }} onClick={() => { navigate('/manager'); setShowAccountMenu(false) }}>Manager Portal</button>}
                    </div>
                  </div>
                  <hr className="hdr-dd-sep" />
                  <button className="hdr-dd-item" onClick={handleLogout}>Sign Out</button>
                </div>
              )}
            </div>
          ) : (
              <Link to="/login" className="hdr-action">
                <span className="hdr-action-line1">Hello, sign in</span>
                <span className="hdr-action-line2">Account &amp; Lists ▾</span>
                <span className="hdr-action-icon" style={{ display: 'none', fontSize: 26 }}>👤</span>
              </Link>
          )}

          {/* Returns & Orders */}
          <Link to="/orders" className="hdr-action hdr-orders">
            <span className="hdr-action-line1">Returns</span>
            <span className="hdr-action-line2">&amp; Orders</span>
          </Link>

          {/* Notifications */}
          {isAuthenticated && (
            <div className="hdr-notifications" style={{ display: 'flex', alignItems: 'center', padding: '0 4px' }}>
              <NotificationCenter />
            </div>
          )}

          {/* Wishlist */}
          {isAuthenticated && (
            <Link to="/wishlist" className="hdr-action hdr-wishlist" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 24, lineHeight: 1 }}>♡</span>
              <span className="hdr-action-line2">Wishlist</span>
            </Link>
          )}

          {/* Cart */}
          <Link to="/cart" className="hdr-cart">
            <div className="hdr-cart-wrap">
              <svg width="42" height="36" viewBox="0 0 34 30" fill="none">
                <path d="M2 2h3l4.5 16h14l3-10H8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="13" cy="26" r="2" fill="white" />
                <circle cx="24" cy="26" r="2" fill="white" />
              </svg>
              {cartCount > 0 && (
                <span className="hdr-cart-count">{cartCount > 99 ? '99+' : cartCount}</span>
              )}
            </div>
            <span className="hdr-cart-label">Cart</span>
          </Link>
        </div>
      </div>

      {/* ── Navigation bar ── */}
      <nav className="hdr-nav">
        <div className="hdr-nav-inner">
          {/* All categories */}
          <div ref={categoryMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              className="hdr-nav-link"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
              onClick={() => setShowCategoryMenu(p => !p)}
              onMouseEnter={() => setShowCategoryMenu(true)}
            >
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                <rect y="0" width="18" height="2.2" rx="1.1" fill="white" />
                <rect y="5.9" width="18" height="2.2" rx="1.1" fill="white" />
                <rect y="11.8" width="18" height="2.2" rx="1.1" fill="white" />
              </svg>
              All
            </button>
            {showCategoryMenu && (
              <div
                className="hdr-dropdown"
                style={{
                  top: (categoryMenuRef.current?.getBoundingClientRect().bottom ?? 88) + 2,
                  left: categoryMenuRef.current?.getBoundingClientRect().left ?? 0,
                  width: 280,
                  maxHeight: 500,
                  overflowY: 'auto',
                  paddingBottom: 6,
                }}
                onMouseLeave={() => setShowCategoryMenu(false)}
              >
                {categories.map(cat => (
                  <Link key={cat.slug} to={`/category/${cat.slug}`} className="hdr-dd-item" onClick={() => setShowCategoryMenu(false)}>
                    {cat.name}
                  </Link>
                ))}
                <hr className="hdr-dd-sep" />
                <Link to="/categories" className="hdr-dd-item" style={{ color: '#c45500', fontWeight: 600 }} onClick={() => setShowCategoryMenu(false)}>
                  See All Categories →
                </Link>
              </div>
            )}
          </div>

          <Link to="/deals" className="hdr-nav-link">Today's Deals</Link>
          <Link to="/sellers" className="hdr-nav-link">Browse Sellers</Link>
          <Link to="/customer-service" className="hdr-nav-link">Customer Service</Link>
          <Link to="/registry" className="hdr-nav-link">Registry</Link>
          <Link to="/gift-cards" className="hdr-nav-link">Gift Cards</Link>
          <Link to="/seller/register" className="hdr-nav-link">Sell</Link>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {!isAuthenticated && (
              <Link to="/register" className="hdr-nav-link" style={{ background: '#FF9900', color: '#111', fontWeight: 700, borderRadius: 20, padding: '8px 18px' }}>
                Join Free
              </Link>
            )}
            <Link to="/prime" className="hdr-nav-link" style={{ color: '#FF9900', fontWeight: 700 }}>
              Prime
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Mobile drawer ── */}
      <div className={`hdr-drawer${showMobileMenu ? ' open' : ''}`}>
        <div className="hdr-drawer-inner">
          {isAuthenticated ? (
            <div className="hdr-drawer-user">
              <div style={{ fontWeight: 700, fontSize: 17, color: '#fff' }}>Hello, {username}</div>
              <div style={{ fontSize: 14, color: '#9ca3af', marginTop: 4 }}>{user?.email}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <Link to="/login" style={{ flex: 1, background: '#FF9900', color: '#111', fontWeight: 700, borderRadius: 4, padding: '12px 0', textAlign: 'center', fontSize: 16, textDecoration: 'none' }} onClick={() => setShowMobileMenu(false)}>Sign In</Link>
              <Link to="/register" style={{ flex: 1, background: '#374151', color: '#fff', borderRadius: 4, padding: '12px 0', textAlign: 'center', fontSize: 16, textDecoration: 'none' }} onClick={() => setShowMobileMenu(false)}>Register</Link>
            </div>
          )}

          <div className="hdr-section-title">Quick Links</div>
          <Link to="/deals" className="hdr-drawer-link" onClick={() => setShowMobileMenu(false)}>🏷️&nbsp; Today's Deals</Link>
          <Link to="/orders" className="hdr-drawer-link" onClick={() => setShowMobileMenu(false)}>📦&nbsp; Your Orders</Link>
          {isAuthenticated && <Link to="/wishlist" className="hdr-drawer-link" onClick={() => setShowMobileMenu(false)}>♡&nbsp; Wishlist</Link>}
          {isAuthenticated && <Link to="/account" className="hdr-drawer-link" onClick={() => setShowMobileMenu(false)}>⚙️&nbsp; Account Settings</Link>}
          <Link to="/customer-service" className="hdr-drawer-link" onClick={() => setShowMobileMenu(false)}>💬&nbsp; Customer Service</Link>
          <Link to="/seller/register" className="hdr-drawer-link" onClick={() => setShowMobileMenu(false)}>🏪&nbsp; Sell on FastShop</Link>

          <div className="hdr-section-title">Shop by Category</div>
          {categories.map(cat => (
            <Link key={cat.slug} to={`/category/${cat.slug}`} className="hdr-drawer-link" onClick={() => setShowMobileMenu(false)}>
              <span style={{ color: '#9ca3af', marginRight: 2 }}>›</span> {cat.name}
            </Link>
          ))}
          <Link to="/categories" className="hdr-drawer-link" style={{ color: '#FF9900', fontWeight: 600 }} onClick={() => setShowMobileMenu(false)}>
            See All Categories →
          </Link>

          {user?.role === 'seller' && <>
            <div className="hdr-section-title">Seller Tools</div>
            <Link to="/seller" className="hdr-drawer-link" style={{ color: '#FF9900' }} onClick={() => setShowMobileMenu(false)}>🏪&nbsp; Seller Central</Link>
          </>}
          {user?.role === 'admin' && <>
            <div className="hdr-section-title">Admin</div>
            <Link to="/admin" className="hdr-drawer-link" style={{ color: '#f87171' }} onClick={() => setShowMobileMenu(false)}>⚙️&nbsp; Admin Dashboard</Link>
          </>}

          {isAuthenticated && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #374151' }}>
              <button
                onClick={() => { handleLogout(); setShowMobileMenu(false) }}
                style={{ width: '100%', background: 'transparent', color: '#d1d5db', border: '1px solid #4b5563', borderRadius: 4, padding: '12px 0', fontSize: 16, cursor: 'pointer' }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header