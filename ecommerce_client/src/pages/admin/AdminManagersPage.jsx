import { useState, useEffect, useCallback, useMemo } from 'react';
import { adminAPI } from '../../services/api.service';
import { toast } from 'react-hot-toast';

const AdminManagersPage = () => {
    const [managers, setManagers] = useState([]);
    const [stats, setStats] = useState({
        totalManagers: 0,
        activeManagers: 0,
        pendingApproval: 0,
        suspendedManagers: 0
    });
    const [filters, setFilters] = useState({
        search: '',
        status: 'all',
        department: 'all'
    });
    const [pagination, setPagination] = useState({
        limit: 20,
        offset: 0,
        totalPages: 1,
        currentPage: 1,
        hasNext: false,
        hasPrev: false
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedManager, setSelectedManager] = useState(null);
    const [formLoading, setFormLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        displayName: '',
        phone: '',
        department: '',
        permissions: []
    });

    // Debounced search to prevent excessive API calls
    const [searchTimeout, setSearchTimeout] = useState(null);

    // Memoized filter parameters to prevent unnecessary API calls
const apiParams = useMemo(() => ({
        search: filters.search || undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        department: filters.department !== 'all' ? filters.department : undefined,
        limit: pagination.limit,
        offset: pagination.offset
    }), [filters, pagination.limit, pagination.offset]);

    // Optimized fetch function with timeout and caching
    const fetchManagers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            console.log('🔍 Fetching managers with params:', apiParams);
            
            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), 8000)
            );
            
            const response = await Promise.race([
                adminAPI.getManagers(apiParams),
                timeoutPromise
            ]);
            
            console.log('✅ Managers response:', response);
            
            // Handle response data structure
            const apiResponse = response;
            const managersData = apiResponse.managers || apiResponse.data || [];
            setManagers(managersData);
            
            // Update stats from response
            if (apiResponse.stats) {
                setStats(apiResponse.stats);
            } else {
                // Calculate stats from data if not provided
                setStats({
                    totalManagers: apiResponse.totalCount || managersData.length,
                    activeManagers: managersData.filter(m => m.status === 'active').length,
                    pendingApproval: 0,
                    suspendedManagers: managersData.filter(m => m.status === 'blocked' || m.status === 'deleted').length
                });
            }
            
            // Update pagination
            if (apiResponse.pagination) {
                setPagination(prev => ({
                    ...prev,
                    ...apiResponse.pagination
                }));
            }
            
        } catch (error) {
            console.error('Error fetching managers:', error);
            const errorMessage = error.message || 'Failed to load managers';
            setError(errorMessage);
            
            // Only show toast for non-timeout errors
            if (!error.message?.includes('timeout')) {
                toast.error(errorMessage);
            } else {
                toast.error('Request timed out. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }, [apiParams]);

    // Initial load with reduced frequency
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchManagers();
        }, 100); // Small delay to prevent immediate API call

        return () => clearTimeout(timer);
    }, [fetchManagers]);

    // Debounced search handler
    const handleFilterChange = useCallback((key, value) => {
        if (key === 'search') {
            // Clear existing timeout
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            
            // Update UI immediately for better UX
            setFilters(prev => ({ ...prev, [key]: value }));
            
            // Set new timeout for API call
            const newTimeout = setTimeout(() => {
                setPagination(prev => ({ ...prev, offset: 0, currentPage: 1 }));
            }, 500); // 500ms debounce
            
            setSearchTimeout(newTimeout);
        } else {
            setFilters(prev => ({ ...prev, [key]: value }));
            setPagination(prev => ({ ...prev, offset: 0, currentPage: 1 }));
        }
    }, [searchTimeout]);

    // Optimized form handlers with better error handling
    const handleCreateManager = useCallback(async (e) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            // Validate required fields
            if (!formData.email || !formData.password || !formData.displayName) {
                toast.error('Please fill in all required fields');
                return;
            }
            
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email)) {
                toast.error('Please enter a valid email address');
                return;
            }
            
            // Validate password strength
            if (formData.password.length < 6) {
                toast.error('Password must be at least 6 characters long');
                return;
            }
            
            await adminAPI.createManager(formData);
            toast.success('Manager created successfully');
            setShowCreateModal(false);
            resetForm();
            fetchManagers(); // Refresh data
        } catch (error) {
            console.error('Create manager error:', error);
            toast.error(error.message || 'Failed to create manager');
        } finally {
            setFormLoading(false);
        }
    }, [formData, fetchManagers]);

    const handleUpdateManager = useCallback(async (e) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            // Validate required fields (excluding password for updates)
            if (!formData.displayName) {
                toast.error('Display name is required');
                return;
            }
            
            // Remove empty password field for updates
            const updateData = { ...formData };
            if (!updateData.password) {
                delete updateData.password;
            }
            
            await adminAPI.updateManager(selectedManager.id, updateData);
            toast.success('Manager updated successfully');
            setShowEditModal(false);
            resetForm();
            fetchManagers(); // Refresh data
        } catch (error) {
            console.error('Update manager error:', error);
            toast.error(error.message || 'Failed to update manager');
        } finally {
            setFormLoading(false);
        }
    }, [formData, selectedManager, fetchManagers]);

    const handleDeleteManager = useCallback(async (manager) => {
        const confirmMessage = `Are you sure you want to delete manager "${manager.display_name || manager.displayName}"?`;
        
        if (window.confirm(confirmMessage)) {
            try {
                await adminAPI.deleteManager(manager.id);
                toast.success('Manager deleted successfully');
                fetchManagers(); // Refresh data
            } catch (error) {
                toast.error(error.message || 'Failed to delete manager');
            }
        }
    }, [fetchManagers]);

    const handleUpdateStatus = useCallback(async (manager, newStatus) => {
        try {
            await adminAPI.updateManagerStatus(manager.id, { status: newStatus });
            toast.success(`Manager status updated to ${newStatus}`);
            fetchManagers(); // Refresh data
        } catch (error) {
            toast.error(error.message || 'Failed to update manager status');
        }
    }, [fetchManagers]);

    const openCreateModal = useCallback(() => {
        resetForm();
        setShowCreateModal(true);
    }, []);

    const openEditModal = useCallback((manager) => {
        setSelectedManager(manager);
        setFormData({
            email: manager.email || '',
            password: '', // Don't populate password for security
            displayName: manager.display_name || manager.displayName || '',
            phone: manager.phone || '',
            department: manager.manager_department || manager.department || '',
            permissions: manager.manager_permissions || manager.permissions || []
        });
        setShowEditModal(true);
    }, []);

    const openViewModal = useCallback((manager) => {
        setSelectedManager(manager);
        setShowViewModal(true);
    }, []);

    const handleExportManagers = useCallback(async () => {
        try {
            const exportData = managers.map(manager => ({
                'Manager ID': manager.id,
                'Name': manager.display_name || manager.displayName || 'N/A',
                'Email': manager.email,
                'Phone': manager.phone || '',
                'Department': manager.manager_department || manager.department || '',
                'Permissions': Array.isArray(manager.manager_permissions) ? manager.manager_permissions.join(', ') : Array.isArray(manager.permissions) ? manager.permissions.join(', ') : '',
                'Status': manager.status || 'active',
                'Created Date': new Date(manager.created_at).toLocaleDateString()
            }));
            
            // Convert to CSV
            const headers = Object.keys(exportData[0]);
            const csvContent = [
                headers.join(','),
                ...exportData.map(row => headers.map(header => `"${row[header]}"`).join(','))
            ].join('\n');
            
            // Download CSV
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `managers-export-${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast.success('Managers data exported successfully');
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export managers data');
        }
    }, [managers]);

    const resetForm = useCallback(() => {
        setFormData({
            email: '',
            password: '',
            displayName: '',
            phone: '',
            department: '',
            permissions: []
        });
        setSelectedManager(null);
    }, []);

    const getStatusBadge = useCallback((status) => {
        const statusLower = status?.toLowerCase();
        if (statusLower === 'active') return 'badge-active';
        if (statusLower === 'blocked') return 'badge-suspended';
        if (statusLower === 'deleted') return 'badge-suspended';
        return 'badge-pending';
    }, []);

    const handlePageChange = useCallback((newPage) => {
        const newOffset = (newPage - 1) * pagination.limit;
        setPagination(prev => ({
            ...prev,
            offset: newOffset,
            currentPage: newPage
        }));
    }, [pagination.limit]);

    // Fast loading state with skeleton
    if (loading && managers.length === 0) {
        return (
            <div style={{textAlign: 'center', padding: '40px 20px'}}>
                <div style={{fontSize: '2em', marginBottom: '20px'}}>⏳</div>
                <div style={{fontSize: '1.1em', color: '#565959'}}>Loading managers...</div>
                <div style={{marginTop: '20px', color: '#999'}}>This should only take a moment</div>
            </div>
        );
    }

    if (error && managers.length === 0) {
        return (
            <div style={{textAlign: 'center', padding: '60px 20px'}}>
                <div style={{fontSize: '2.5em', marginBottom: '20px'}}>❌</div>
                <div style={{fontSize: '1.1em', color: '#C7511F', marginBottom: '20px'}}>{error}</div>
                <button 
                    onClick={fetchManagers} 
                    style={{background: '#FF9900', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'}}
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="admin-managers-page">
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
                .btn-primary { background: #FF9900; color: #FFFFFF; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; }
                
                table { width: 100%; border-collapse: collapse; }
                th { background: #F7F8F8; padding: 12px; text-align: left; font-weight: 600; }
                td { padding: 12px; border-bottom: 1px solid #D5D9D9; }
                
                .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.85em; font-weight: bold; margin-right: 5px; }
                .badge-active { background: #E6F4F1; color: #067D62; }
                .badge-pending { background: #FFF4E5; color: #F08804; }
                .badge-suspended { background: #FFE5E5; color: #C7511F; }
                
                .permissions-list { display: flex; flex-wrap: wrap; gap: 5px; }
                .permission-tag { padding: 3px 8px; background: #E7F3FF; color: #146EB4; border-radius: 4px; font-size: 0.75em; }
                
                .btn-sm { padding: 6px 12px; border: 1px solid #D5D9D9; background: #FFFFFF; border-radius: 4px; cursor: pointer; text-decoration: none; color: #0F1111; margin-right: 5px; }
                .btn-sm:hover { background: #F7F8F8; }
                
                .pagination { display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 20px; }
                .pagination button { padding: 8px 12px; border: 1px solid #D5D9D9; background: #FFFFFF; border-radius: 4px; cursor: pointer; }
                .pagination button:hover { background: #F7F8F8; }
                .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
                .pagination .active { background: #FF9900; color: white; border-color: #FF9900; }
            `}</style>

            <h1>Manager Management</h1>
            <p className="subtitle">Manage platform managers and their permissions</p>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{stats.totalManagers.toLocaleString()}</div>
                    <div className="stat-label">Total Managers</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.activeManagers.toLocaleString()}</div>
                    <div className="stat-label">Active</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.pendingApproval}</div>
                    <div className="stat-label">Pending Approval</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.suspendedManagers}</div>
                    <div className="stat-label">Blocked/Deleted</div>
                </div>
            </div>

            <div className="section">
                <h2 className="section-title">All Managers</h2>

                <div className="filter-bar">
                    <input
                        type="text"
                        placeholder="Search managers..."
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                    />
                    <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="blocked">Blocked</option>
                        <option value="deleted">Deleted</option>
                    </select>
                    <select value={filters.department} onChange={(e) => handleFilterChange('department', e.target.value)}>
                        <option value="all">All Departments</option>
                        <option value="product">Product Management</option>
                        <option value="customer">Customer Service</option>
                        <option value="operations">Operations</option>
                        <option value="sales">Sales</option>
                        <option value="marketing">Marketing</option>
                    </select>
                    <button className="btn-primary" onClick={openCreateModal}>Add Manager</button>
                    <button className="btn-primary" onClick={handleExportManagers}>Export</button>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Manager ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Department</th>
                            <th>Phone</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {managers.length > 0 ? managers.map((manager) => (
                            <tr key={manager.id}>
                                <td>{manager.id.substring(0, 8)}...</td>
                                <td>{manager.display_name || manager.displayName || 'N/A'}</td>
                                <td>{manager.email}</td>
                                <td>{manager.manager_department || manager.department || 'N/A'}</td>
                                <td>{manager.phone || 'N/A'}</td>
                                <td>
                                    <span className={`badge ${getStatusBadge(manager.status)}`}>
                                        {(manager.status || 'active').charAt(0).toUpperCase() + (manager.status || 'active').slice(1)}
                                    </span>
                                </td>
                                <td>
                                    <button className="btn-sm" onClick={() => openViewModal(manager)}>View</button>
                                    <button className="btn-sm" onClick={() => openEditModal(manager)}>Edit</button>
                                    <button className="btn-sm" onClick={() => handleDeleteManager(manager)} style={{background: '#C7511F', color: 'white'}}>Delete</button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="7" style={{textAlign: 'center', padding: '40px', color: '#565959'}}>
                                    <div style={{fontSize: '2em', marginBottom: '10px'}}>👔</div>
                                    <div>No managers found</div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {pagination.totalPages > 1 && (
                    <div className="pagination">
                        <button 
                            onClick={() => handlePageChange(pagination.currentPage - 1)}
                            disabled={!pagination.hasPrev}
                        >
                            Previous
                        </button>
                        
                        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                            const page = i + 1;
                            return (
                                <button
                                    key={page}
                                    onClick={() => handlePageChange(page)}
                                    className={pagination.currentPage === page ? 'active' : ''}
                                >
                                    {page}
                                </button>
                            );
                        })}
                        
                        <button 
                            onClick={() => handlePageChange(pagination.currentPage + 1)}
                            disabled={!pagination.hasNext}
                        >
                            Next
                        </button>
                        
                        <span style={{marginLeft: '20px', color: '#565959'}}>
                            Page {pagination.currentPage} of {pagination.totalPages}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminManagersPage;