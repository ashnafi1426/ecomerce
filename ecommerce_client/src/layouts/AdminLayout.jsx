import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAppSelector, useAppDispatch } from '../hooks/redux'
import { logout } from '../store/slices/authSlice'
import { toast } from 'react-toastify'
import { useState, useCallback, useMemo } from 'react'
import ChatWidget from '../components/chat/ChatWidget'

const AdminLayout = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { user } = useAppSelector((state) => state.auth)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)

  const handleLogout = useCallback(() => {
    dispatch(logout())
    toast.success('Logged out successfully')
    navigate('/login')
  }, [dispatch, navigate])

  const isActive = useCallback((path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }, [location.pathname])

  const closeMobileSidebar = useCallback(() => {
    setShowMobileSidebar(false)
  }, [])

  // Memoized sidebar menu items to prevent re-renders
  const sidebarSections = useMemo(() => [
    {
      title: 'Main',
      items: [
        { path: '/admin', icon: '📊', label: 'Dashboard', exact: true },
        { path: '/admin/analytics', icon: '📈', label: 'Analytics' }
      ]
    },
    {
      title: 'Management',
      items: [
        { path: '/admin/users', icon: '👥', label: 'Users' },
        { path: '/admin/customers', icon: '🛍️', label: 'Customers' },
        { path: '/admin/sellers', icon: '🏪', label: 'Sellers' },
        { path: '/admin/managers', icon: '👔', label: 'Managers' },
        { path: '/admin/roles', icon: '🔐', label: 'Roles' },
        { path: '/admin/products', icon: '📦', label: 'Products' },
        { path: '/admin/product-approvals', icon: '✅', label: 'Product Approvals' },
        { path: '/admin/orders', icon: '🛒', label: 'Orders' },
        { path: '/admin/refunds', icon: '💸', label: 'Refunds' },
        { path: '/admin/categories', icon: '📂', label: 'Categories' }
      ]
    },
    {
      title: 'Financial',
      items: [
        { path: '/admin/payments', icon: '💰', label: 'Payments' },
        { path: '/admin/seller-earnings', icon: '💵', label: 'Seller Earnings' },
        { path: '/admin/commission-settings', icon: '⚙️', label: 'Commission Settings' },
        { path: '/admin/payouts', icon: '💳', label: 'Payouts' }
      ]
    },
    {
      title: 'System',
      items: [
        { path: '/admin/settings', icon: '⚙️', label: 'Settings' },
        { path: '/admin/logs', icon: '📋', label: 'Audit Logs' },
        { path: '/admin/reports', icon: '📄', label: 'Reports' }
      ]
    }
  ], [])

  // Memoized sidebar menu component
  const SidebarMenu = useMemo(() => (
    <>
      {sidebarSections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="sidebar-section">
          <div className="sidebar-section-title">{section.title}</div>
          <ul className="sidebar-menu">
            {section.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Link 
                  to={item.path} 
                  className={
                    item.exact 
                      ? (location.pathname === item.path ? 'active' : '')
                      : (isActive(item.path) ? 'active' : '')
                  } 
                  onClick={closeMobileSidebar}
                >
                  <span className="menu-icon">{item.icon}</span> {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  ), [sidebarSections, location.pathname, isActive, closeMobileSidebar])

  return (
    <div className="admin-layout-container">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .admin-layout-container { min-height: 100vh; background: #F7F8F8; }
        
        /* Top Header */
        .top-header { background: linear-gradient(135deg, #131921 0%, #232F3E 100%); color: #FFFFFF; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2); position: sticky; top: 0; z-index: 100; }
        .logo { font-size: 1.5em; font-weight: bold; color: #FFFFFF; text-decoration: none; display: flex; align-items: center; gap: 8px; }
        .logo:hover { color: #FF9900; }
        .user-menu { display: flex; align-items: center; gap: 15px; }
        .user-info { display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 8px 12px; border: 1px solid transparent; border-radius: 4px; }
        .user-info:hover { border-color: #FFFFFF; }
        .user-avatar { width: 35px; height: 35px; border-radius: 50%; background: #FF9900; display: flex; align-items: center; justify-content: center; font-size: 1.2em; }
        .btn-logout { background: #C7511F; color: #FFFFFF; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 0.9em; transition: background 0.2s; }
        .btn-logout:hover { background: #A33F1A; }
        .mobile-menu-btn { display: none; background: transparent; border: 1px solid #FFFFFF; color: #FFFFFF; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 1.2em; }
        
        /* Dashboard Layout */
        .dashboard-layout { display: flex; min-height: calc(100vh - 60px); }
        
        /* Sidebar */
        .sidebar { width: 260px; background: #FFFFFF; border-right: 1px solid #D5D9D9; padding: 20px 0; box-shadow: 2px 0 8px rgba(0,0,0,0.05); position: sticky; top: 60px; height: calc(100vh - 60px); overflow-y: auto; transition: transform 0.3s ease; }
        .sidebar-section { margin-bottom: 25px; }
        .sidebar-section-title { padding: 0 20px; font-size: 0.75em; text-transform: uppercase; color: #565959; font-weight: 700; margin-bottom: 10px; }
        .sidebar-menu { list-style: none; }
        .sidebar-menu li { margin-bottom: 3px; }
        .sidebar-menu a { display: flex; align-items: center; gap: 12px; padding: 12px 20px; color: #0F1111; text-decoration: none; transition: all 0.2s; }
        .sidebar-menu a:hover { background: #F7F8F8; border-left: 3px solid #FF9900; }
        .sidebar-menu a.active { background: linear-gradient(90deg, #FFF4E5 0%, transparent 100%); border-left: 3px solid #FF9900; font-weight: 600; color: #FF9900; }
        .menu-icon { font-size: 1.3em; width: 25px; text-align: center; }
        
        /* Main Content */
        .main-content { flex: 1; padding: 20px; overflow-y: auto; max-width: 100%; }
        
        /* Responsive utilities */
        @media (min-width: 1280px) {
          .main-content { padding: 30px; }
        }
        
        /* Mobile Sidebar Overlay */
        .sidebar-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 999; }
        .sidebar-overlay.show { display: block; }
        
        @media (max-width: 1024px) {
          .logo { font-size: 1.3em; }
          .user-info { gap: 5px; padding: 6px 8px; }
          .user-info > div { display: none; }
          .btn-logout { padding: 6px 12px; font-size: 0.85em; }
        }
        
        @media (max-width: 768px) {
          .top-header { padding: 12px 15px; flex-wrap: wrap; }
          .logo { font-size: 1.2em; }
          .mobile-menu-btn { display: block; }
          .user-menu { gap: 10px; }
          .user-info { display: none; }
          .btn-logout { padding: 6px 10px; font-size: 0.8em; }
          
          .dashboard-layout { flex-direction: column; }
          .sidebar { position: fixed; top: 0; left: 0; bottom: 0; width: 280px; max-width: 85vw; z-index: 1000; transform: translateX(-100%); height: 100vh; }
          .sidebar.show { transform: translateX(0); }
          .main-content { padding: 15px; width: 100%; }
        }
        
        @media (max-width: 480px) {
          .top-header { padding: 10px; }
          .logo { font-size: 1em; }
          .logo span { display: none; }
          .user-menu { gap: 8px; }
          .btn-logout { padding: 5px 8px; font-size: 0.75em; }
          .main-content { padding: 10px; }
        }
      `}</style>

      {/* Sidebar Overlay for Mobile */}
      <div 
        className={`sidebar-overlay ${showMobileSidebar ? 'show' : ''}`}
        onClick={closeMobileSidebar}
      ></div>

      {/* TOP HEADER */}
      <div className="top-header">
        <div className="flex items-center gap-3">
          <button className="mobile-menu-btn" onClick={() => setShowMobileSidebar(!showMobileSidebar)}>
            ☰
          </button>
          <Link to="/" className="logo">🛒 <span>FastShop Admin</span></Link>
        </div>
        <div className="user-menu">
          <div className="user-info">
            <div className="user-avatar">👤</div>
            <div>
              <div style={{ fontSize: '0.85em' }}>Administrator</div>
              <div style={{ fontWeight: 'bold' }}>{user?.displayName || user?.email || 'Admin User'}</div>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {/* DASHBOARD LAYOUT */}
      <div className="dashboard-layout">
        {/* SIDEBAR */}
        <aside className={`sidebar ${showMobileSidebar ? 'show' : ''}`}>
          {SidebarMenu}
        </aside>

        {/* MAIN CONTENT */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
      <ChatWidget />
    </div>
  )
}

export default AdminLayout
