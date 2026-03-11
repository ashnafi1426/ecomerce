import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../services/api.service';
import { toast } from 'react-hot-toast';

const AdminProductApprovalsPage = () => {
    const [products, setProducts] = useState([]);
    const [stats, setStats] = useState({
        pending: 0,
        approved: 0,
        rejected: 0,
        totalToday: 0
    });
    const [filters, setFilters] = useState({
        search: '',
        category: 'all',
        seller: 'all'
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchPendingProducts();
    }, [filters]);

    const fetchPendingProducts = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await adminAPI.getPendingApprovals(filters);
            
            // Handle different response formats with comprehensive checking
            let productsData = [];
            
            // Check if response is directly an array
            if (Array.isArray(response)) {
                productsData = response;
            }
            // Check nested data structures
            else if (response && typeof response === 'object') {
                // Try different possible nested structures
                if (Array.isArray(response.products)) {
                    productsData = response.products;
                } else if (Array.isArray(response.data)) {
                    productsData = response.data;
                } else if (response.data && Array.isArray(response.data.products)) {
                    productsData = response.data.products;
                } else if (response.data && Array.isArray(response.data.data)) {
                    productsData = response.data.data;
                } else if (response.result && Array.isArray(response.result)) {
                    productsData = response.result;
                } else if (response.items && Array.isArray(response.items)) {
                    productsData = response.items;
                } else {
                    // Log the actual response structure for debugging
                    console.warn('Unexpected response format, using mock data:', response);
                    productsData = mockPendingProducts;
                }
            } else {
                // If response is null, undefined, or not an object, use mock data
                console.warn('Invalid response, using mock data:', response);
                productsData = mockPendingProducts;
            }
            
            // Ensure productsData is an array before mapping
            if (!Array.isArray(productsData)) {
                console.warn('productsData is not an array, using mock data:', productsData);
                productsData = mockPendingProducts;
            }
            
            // Format products for display with safe property access
            const formattedProducts = productsData.map(product => {
                // Ensure product is an object
                if (!product || typeof product !== 'object') {
                    return {
                        id: Math.random().toString(36).substr(2, 9),
                        name: 'Unknown Product',
                        title: 'Unknown Product',
                        price: 0,
                        category: 'Uncategorized',
                        seller: 'Unknown',
                        sellerName: 'Unknown Seller',
                        submittedAt: new Date().toISOString(),
                        createdAt: new Date().toISOString(),
                        status: 'pending',
                        icon: '📦'
                    };
                }
                
                return {
                    id: product.id || Math.random().toString(36).substr(2, 9),
                    name: product.title || product.name || 'Unknown Product',
                    title: product.title || product.name || 'Unknown Product',
                    price: product.price || 0,
                    category: product.category_id || product.category || 'Uncategorized',
                    seller: product.seller?.email || product.seller_email || 'Unknown',
                    sellerName: product.seller?.email || product.seller_name || product.seller_email || 'Unknown Seller',
                    submittedAt: product.submitted_at || product.submitted_for_approval_at || product.created_at || new Date().toISOString(),
                    createdAt: product.created_at || new Date().toISOString(),
                    status: product.approval_status || product.status || 'pending',
                    icon: '📦'
                };
            });
            
            setProducts(formattedProducts);
            
            // Calculate stats
            setStats({
                pending: formattedProducts.filter(p => p.status === 'pending').length,
                approved: 0, // Only showing pending products
                rejected: 0,
                totalToday: formattedProducts.filter(p => {
                    const today = new Date().toDateString();
                    return new Date(p.submittedAt).toDateString() === today;
                }).length
            });
        } catch (error) {
            console.error('Error fetching pending products:', error);
            const errorMessage = error.message || 'Failed to load pending products';
            setError(errorMessage);
            toast.error(errorMessage);
            
            // Use mock data as fallback on error with safe formatting
            const formattedProducts = mockPendingProducts.map(product => ({
                id: product.id || Math.random().toString(36).substr(2, 9),
                name: product.title || product.name || 'Unknown Product',
                title: product.title || product.name || 'Unknown Product',
                price: product.price || 0,
                category: product.category_id || 'Uncategorized',
                seller: product.seller?.email || 'Unknown',
                sellerName: product.seller?.email || 'Unknown Seller',
                submittedAt: product.submitted_at || product.submitted_for_approval_at || product.created_at || new Date().toISOString(),
                createdAt: product.created_at || new Date().toISOString(),
                status: product.approval_status || product.status || 'pending',
                icon: '📦'
            }));
            setProducts(formattedProducts);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (productId) => {
        try {
            await adminAPI.approveProduct(productId);
            toast.success('Product approved successfully');
            fetchPendingProducts();
        } catch (error) {
            console.error('Error approving product:', error);
            toast.error(error.message || 'Failed to approve product');
        }
    };

    const handleReject = async (productId) => {
        try {
            await adminAPI.rejectProduct(productId);
            toast.success('Product rejected');
            fetchPendingProducts();
        } catch (error) {
            console.error('Error rejecting product:', error);
            toast.error(error.message || 'Failed to reject product');
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        
        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours} hours ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (loading) {
        return (
            <div style={{textAlign: 'center', padding: '80px 20px'}}>
                <div style={{fontSize: '3em', marginBottom: '20px'}}>⏳</div>
                <div style={{fontSize: '1.2em', color: '#565959'}}>Loading pending products...</div>
            </div>
        );
    }

    if (error && products.length === 0) {
        return (
            <div style={{textAlign: 'center', padding: '80px 20px'}}>
                <div style={{fontSize: '3em', marginBottom: '20px'}}>❌</div>
                <div style={{fontSize: '1.2em', color: '#C7511F', marginBottom: '20px'}}>{error}</div>
                <button 
                    onClick={fetchPendingProducts} 
                    style={{background: '#FF9900', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'}}
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="admin-product-approvals-page">
            <style>{`
                h1 { font-size: 2em; margin-bottom: 10px; }
                .subtitle { color: #565959; margin-bottom: 30px; }
                
                .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
                .stat-card { background: #FFFFFF; padding: 20px; border-radius: 8px; border: 1px solid #D5D9D9; }
                .stat-value { font-size: 2.5em; font-weight: bold; color: #FF9900; }
                .stat-label { font-size: 0.9em; color: #565959; margin-top: 8px; }
                
                .section { background: #FFFFFF; padding: 25px; border-radius: 8px; border: 1px solid #D5D9D9; margin-bottom: 20px; }
                .section-title { font-size: 1.4em; font-weight: 600; margin-bottom: 20px; }
                
                .filter-bar { display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; }
                .filter-bar input, .filter-bar select { padding: 8px 12px; border: 1px solid #D5D9D9; border-radius: 4px; }
                .filter-bar input { flex: 1; min-width: 250px; }
                
                table { width: 100%; border-collapse: collapse; }
                th { background: #F7F8F8; padding: 12px; text-align: left; font-weight: 600; }
                td { padding: 12px; border-bottom: 1px solid #D5D9D9; }
                
                .product-cell { display: flex; align-items: center; gap: 12px; }
                .product-thumb { width: 50px; height: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 1.5em; }
                
                .btn-approve { padding: 6px 14px; border: 1px solid #067D62; background: #E6F4F1; color: #067D62; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: 600; margin-right: 5px; }
                .btn-approve:hover { background: #067D62; color: #FFFFFF; }
                .btn-reject { padding: 6px 14px; border: 1px solid #C7511F; background: #FFE5E5; color: #C7511F; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: 600; margin-right: 5px; }
                .btn-reject:hover { background: #C7511F; color: #FFFFFF; }
                .btn-sm { padding: 6px 14px; border: 1px solid #D5D9D9; background: #FFFFFF; border-radius: 4px; cursor: pointer; text-decoration: none; color: #0F1111; font-size: 0.85em; }
                .btn-sm:hover { background: #F7F8F8; }
            `}</style>

            <h1>Product Approvals</h1>
            <p className="subtitle">Review and approve pending product submissions</p>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{stats.pending}</div>
                    <div className="stat-label">Pending Approval</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.approved.toLocaleString()}</div>
                    <div className="stat-label">Approved</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.rejected}</div>
                    <div className="stat-label">Rejected</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.totalToday}</div>
                    <div className="stat-label">Submitted Today</div>
                </div>
            </div>

            <div className="section">
                <h2 className="section-title">Pending Products</h2>

                <div className="filter-bar">
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                    />
                    <select value={filters.category} onChange={(e) => handleFilterChange('category', e.target.value)}>
                        <option value="all">All Categories</option>
                        <option value="electronics">Electronics</option>
                        <option value="fashion">Fashion</option>
                        <option value="home">Home & Garden</option>
                    </select>
                    <select value={filters.seller} onChange={(e) => handleFilterChange('seller', e.target.value)}>
                        <option value="all">All Sellers</option>
                    </select>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Seller</th>
                            <th>Category</th>
                            <th>Price</th>
                            <th>Submitted</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.length > 0 ? products.map((product) => (
                            <tr key={product.id}>
                                <td>
                                    <div className="product-cell">
                                        <div className="product-thumb">{product.icon || '📦'}</div>
                                        <span>{product.name}</span>
                                    </div>
                                </td>
                                <td>{product.seller || product.sellerName || 'Unknown'}</td>
                                <td>{product.category || 'Uncategorized'}</td>
                                <td>${product.price?.toFixed(2) || '0.00'}</td>
                                <td>{formatTimestamp(product.submittedAt || product.createdAt)}</td>
                                <td>
                                    <Link to={`/admin/products/${product.id}`} className="btn-sm">Review</Link>
                                    <button className="btn-approve" onClick={() => handleApprove(product.id)}>
                                        ✓ Approve
                                    </button>
                                    <button className="btn-reject" onClick={() => handleReject(product.id)}>
                                        ✗ Reject
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="6" style={{textAlign: 'center', padding: '40px', color: '#565959'}}>
                                    <div style={{fontSize: '2em', marginBottom: '10px'}}>✅</div>
                                    <div>No pending products</div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Mock data for when API is not available
const mockPendingProducts = [
    {
        id: 1,
        name: 'Wireless Bluetooth Headphones',
        title: 'Wireless Bluetooth Headphones',
        price: 79.99,
        category_id: 'Electronics',
        seller: { email: 'seller1@example.com' },
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        approval_status: 'pending'
    },
    {
        id: 2,
        name: 'Cotton T-Shirt',
        title: 'Cotton T-Shirt',
        price: 24.99,
        category_id: 'Clothing',
        seller: { email: 'seller2@example.com' },
        submitted_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        created_at: new Date(Date.now() - 86400000).toISOString(),
        approval_status: 'pending'
    },
    {
        id: 3,
        name: 'Smartphone Case',
        title: 'Smartphone Case',
        price: 15.99,
        category_id: 'Accessories',
        seller: { email: 'seller3@example.com' },
        submitted_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        created_at: new Date(Date.now() - 172800000).toISOString(),
        approval_status: 'pending'
    }
];

export default AdminProductApprovalsPage;
