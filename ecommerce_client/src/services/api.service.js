import axios from 'axios';
import { toast } from 'react-toastify';

const API_BASE_URL = import.meta.env.VITE_API_URL;

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000, // 30 seconds
  validateStatus: function (status) {
    // Accept all status codes to handle them in interceptor
    return status >= 200 && status < 600;
  }
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors globally
apiClient.interceptors.response.use(
  (response) => {
    console.log('✅ API Response received:', {
      status: response.status,
      url: response.config?.url,
      hasData: !!response.data
    });

    // validateStatus accepts 200-599 so 4xx/5xx land here — reject them explicitly
    if (response.status >= 400) {
      const errorMessage =
        response.data?.message ||
        response.data?.error ||
        `Request failed with status ${response.status}`;

      // Check if this is a 404 for commission or analytics endpoints (handle quietly)
      const isCommissionOrAnalytics = response.config?.url?.includes('/commission') || 
                                     response.config?.url?.includes('/analytics');

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        toast.error('Session expired. Please login again.');
      } else if (response.status === 403) {
        toast.error('You do not have permission to perform this action');
      } else if (response.status === 404) {
        // Handle 404s quietly for commission/analytics endpoints
        if (isCommissionOrAnalytics) {
          console.log(`ℹ️ Endpoint not available (404): ${response.config?.url}`);
        } else {
          toast.error('Resource not found');
        }
      } else if (response.status >= 500) {
        toast.error('Server error. Please try again later.');
        console.error(`🔥 Server error ${response.status}:`, response.data);
      } else {
        // Don't show toast for 404s on commission/analytics endpoints
        if (!(response.status === 404 && isCommissionOrAnalytics)) {
          toast.error(errorMessage);
        }
      }

      return Promise.reject(new Error(errorMessage));
    }

    // Simply return the response data
    return response.data;
  },
  (error) => {
    console.error('🚨 API Error Details:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method,
      baseURL: error.config?.baseURL
    });
    
    // This interceptor only runs for network-level errors (no response at all)
    // HTTP 4xx/5xx are handled in the success interceptor above via validateStatus
    if (error.code === 'ECONNABORTED') {
      console.error('❌ Request timeout');
      toast.error('Request timeout. Please check your connection.');
      return Promise.reject(new Error('Request timeout. Please check your connection.'));
    } else if (error.code === 'ERR_NETWORK') {
      console.error('❌ Network error - Cannot reach server');
      toast.error('Cannot connect to server. Please check if the backend is running.');
      return Promise.reject(new Error('No response from server. Please check your connection.'));
    }

    const errorMessage = error.message || 'An error occurred';
    
    console.error('🔥 Rejecting with error message:', errorMessage);
    
    // Return a rejected promise with just the error message
    return Promise.reject(new Error(errorMessage));
  }
);

// API service object
const api = {
  // GET request
  get: async (url, params = {}) => {
    return await apiClient.get(url, { params });
  },
  
  // POST request
  post: async (url, data = {}) => {
    return await apiClient.post(url, data);
  },
  
  // PUT request
  put: async (url, data = {}) => {
    return await apiClient.put(url, data);
  },
  
  // PATCH request
  patch: async (url, data = {}) => {
    return await apiClient.patch(url, data);
  },
  
  // DELETE request
  delete: async (url) => {
    return await apiClient.delete(url);
  },
  
  // Upload file (multipart/form-data)
  upload: async (url, formData, onUploadProgress = null) => {
    return await apiClient.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress
    });
  },
  
  // Download file
  download: async (url, filename) => {
    const response = await apiClient.get(url, {
      responseType: 'blob'
    });
    
    // Create download link
    const downloadUrl = window.URL.createObjectURL(new Blob([response]));
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    return response;
  }
};

// Enhanced caching system for better performance
const CACHE_KEY = 'kiro_endpoint_cache';
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes
const DATA_CACHE_KEY = 'kiro_data_cache';
const DATA_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes for data caching

// Get cached endpoint status from localStorage
const getEndpointCache = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return {};
    
    const parsed = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is expired
    if (parsed.timestamp && (now - parsed.timestamp) > CACHE_EXPIRY) {
      localStorage.removeItem(CACHE_KEY);
      return {};
    }
    
    return parsed.endpoints || {};
  } catch (error) {
    return {};
  }
};

// Get cached data from localStorage
const getDataCache = (key) => {
  try {
    const cached = localStorage.getItem(`${DATA_CACHE_KEY}_${key}`);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is expired
    if (parsed.timestamp && (now - parsed.timestamp) > DATA_CACHE_EXPIRY) {
      localStorage.removeItem(`${DATA_CACHE_KEY}_${key}`);
      return null;
    }
    
    return parsed.data;
  } catch (error) {
    return null;
  }
};

// Set cached data in localStorage
const setDataCache = (key, data) => {
  try {
    localStorage.setItem(`${DATA_CACHE_KEY}_${key}`, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (error) {
    // Ignore localStorage errors
  }
};

// Save endpoint status to localStorage
const setEndpointCache = (endpointName, isAvailable) => {
  try {
    const cache = getEndpointCache();
    cache[endpointName] = isAvailable;
    
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      endpoints: cache,
      timestamp: Date.now()
    }));
  } catch (error) {
    // Ignore localStorage errors
  }
};

// Check if we should skip endpoint calls based on persistent cache
const shouldSkipEndpoint = (endpointName) => {
  const cache = getEndpointCache();
  return cache[endpointName] === false;
};

// Mark endpoint as unavailable in persistent cache
const markEndpointUnavailable = (endpointName) => {
  setEndpointCache(endpointName, false);
};

// Mark endpoint as available in persistent cache
const markEndpointAvailable = (endpointName) => {
  setEndpointCache(endpointName, true);
};

// Admin API endpoints
export const adminAPI = {
  // Enhanced getManagers with caching and timeout
  getManagers: async (params) => {
    console.log('🔍 adminAPI.getManagers called with params:', params);
    
    // Create cache key from params
    const cacheKey = `managers_${JSON.stringify(params || {})}`;
    
    // Check cache first
    const cachedData = getDataCache(cacheKey);
    if (cachedData) {
      console.log('📦 Using cached managers data');
      return cachedData;
    }
    
    try {
      // Add timeout wrapper
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 8000)
      );
      
      const result = await Promise.race([
        api.get('/managers', params),
        timeoutPromise
      ]);
      
      console.log('✅ adminAPI.getManagers success:', result);
      
      // Cache the result
      setDataCache(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('❌ adminAPI.getManagers error:', error);
      throw error;
    }
  },

  // Enhanced getDashboardStats with caching and timeout
  getDashboardStats: async () => {
    console.log('🔍 adminAPI.getDashboardStats called');
    
    const cacheKey = 'dashboard_stats';
    
    // Check cache first
    const cachedData = getDataCache(cacheKey);
    if (cachedData) {
      console.log('📦 Using cached dashboard stats');
      return cachedData;
    }
    
    try {
      // Add timeout wrapper
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 8000)
      );
      
      const result = await Promise.race([
        api.get('/admin/dashboard'),
        timeoutPromise
      ]);
      
      console.log('✅ adminAPI.getDashboardStats success:', result);
      
      // Cache the result for shorter time (dashboard data changes frequently)
      setDataCache(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('❌ adminAPI.getDashboardStats error:', error);
      throw error;
    }
  },
  
  // Analytics - Using analytics controller endpoints
  getDashboardAnalytics: () => api.get('/admin/analytics/dashboard'),
  getSalesOverview: (params) => api.get('/admin/analytics/sales/overview', params),
  getSalesByDate: (params) => api.get('/admin/analytics/sales/by-date', params),
  getTopSellingProducts: (params) => api.get('/admin/analytics/sales/top-products', params),
  getRevenueOverview: (params) => api.get('/admin/analytics/revenue/overview', params),
  getRevenueByCategory: (params) => api.get('/admin/analytics/revenue/by-category', params),
  getRevenueTrends: (params) => api.get('/admin/analytics/revenue/trends', params),
  getCustomerStatistics: (params) => api.get('/admin/analytics/customers/statistics', params),
  getCustomerSegmentation: (params) => api.get('/admin/analytics/customers/segmentation', params),
  getCustomerRetention: (params) => api.get('/admin/analytics/customers/retention', params),
  getInventoryOverview: (params) => api.get('/admin/analytics/inventory/overview', params),
  getLowStockProducts: (params) => api.get('/admin/analytics/inventory/low-stock', params),
  getInventoryTurnover: (params) => api.get('/admin/analytics/inventory/turnover', params),
  
  // Legacy analytics endpoints (for backward compatibility)
  getRevenueAnalytics: (params) => api.get('/admin/analytics/revenue', params),
  getOrderAnalytics: (params) => api.get('/admin/analytics/orders', params),
  
  // Products
  getProducts: async (params) => {
    console.log('🔍 adminAPI.getProducts called with params:', params);
    try {
      const result = await api.get('/admin/products', params);
      console.log('✅ adminAPI.getProducts success:', result);
      return result;
    } catch (error) {
      console.error('❌ adminAPI.getProducts error:', error);
      throw error;
    }
  },
  getProduct: (id) => api.get(`/admin/products/${id}`),
  createProduct: (data) => api.post('/admin/products', data),
  updateProduct: (id, data) => api.put(`/admin/products/${id}`, data),
  deleteProduct: (id) => api.delete(`/admin/products/${id}`),
  getPendingApprovals: () => api.get('/admin/products/approvals'),
  approveProduct: (id) => api.put(`/admin/products/${id}/approve`),
  rejectProduct: (id, reason) => api.put(`/admin/products/${id}/reject`, { reason }),
  
  // Attributes
  getAttributes: () => api.get('/admin/attributes'),
  createAttribute: (data) => api.post('/admin/attributes', data),
  updateAttribute: (id, data) => api.put(`/admin/attributes/${id}`, data),
  deleteAttribute: (id) => api.delete(`/admin/attributes/${id}`),
  
  // Categories & Brands
  getCategories: () => api.get('/admin/categories'),
  createCategory: (data) => api.post('/admin/categories', data),
  updateCategory: (id, data) => api.put(`/admin/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/admin/categories/${id}`),
  getBrands: () => api.get('/admin/brands'),
  createBrand: (data) => api.post('/admin/brands', data),
  updateBrand: (id, data) => api.put(`/admin/brands/${id}`, data),
  deleteBrand: (id) => api.delete(`/admin/brands/${id}`),
  
  // Orders
  getOrders: (params) => api.get('/admin/orders', params),
  getOrder: (id) => api.get(`/admin/orders/${id}`),
  updateOrderStatus: (id, status) => api.put(`/admin/orders/${id}/status`, { status }),
  
  // Users
  getUsers: async (params) => {
    console.log('🔍 adminAPI.getUsers called with params:', params);
    try {
      const result = await api.get('/admin/users', params);
      console.log('✅ adminAPI.getUsers success:', result);
      return result;
    } catch (error) {
      console.error('❌ adminAPI.getUsers error:', error);
      throw error;
    }
  },
  getUser: (id) => api.get(`/admin/users/${id}`),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  bulkUpdateUsers: (data) => api.put('/admin/users/bulk', data),
  exportUsers: (params) => api.get('/admin/users/export', params),
  exportCustomersPDF: async (params) => {
    console.log('🔍 adminAPI.exportCustomersPDF called with params:', params);
    try {
      const response = await apiClient.get('/admin/customers/export-pdf', {
        params,
        responseType: 'blob' // Important for PDF download
      });
      console.log('✅ adminAPI.exportCustomersPDF success');
      return response;
    } catch (error) {
      console.error('❌ adminAPI.exportCustomersPDF error:', error);
      throw error;
    }
  },
  
  // Sellers - Using seller controller endpoints
  getSellers: (params) => api.get('/sellers', params),
  getSeller: (id) => api.get(`/sellers/${id}`),
  createSeller: (data) => api.post('/sellers', data),
  updateSeller: (id, data) => api.put(`/sellers/${id}`, data),
  deleteSeller: (id) => api.delete(`/sellers/${id}`),
  updateSellerStatus: (id, data) => api.put(`/sellers/${id}/status`, data),
  verifySeller: (id, data) => api.post(`/sellers/${id}/verify`, data),
  
  // Managers - Using manager controller endpoints
  getManagers: (params) => api.get('/managers', params),
  getManager: (id) => api.get(`/managers/${id}`),
  createManager: (data) => api.post('/managers', data),
  updateManager: (id, data) => api.put(`/managers/${id}`, data),
  deleteManager: (id) => api.delete(`/managers/${id}`),
  updateManagerStatus: (id, data) => api.put(`/managers/${id}/status`, data),
  
  getCustomers: (params) => api.get('/admin/customers', params),
  
  // Financial
  getPayments: (params) => api.get('/admin/payments', params),
  getPayouts: (params) => api.get('/admin/payouts', params),
  processPayout: (data) => api.post('/admin/payouts', data),
  getReturns: (params) => api.get('/returns', params),
  getReturnStats: () => api.get('/returns/stats'),
  approveReturn: (id, refundAmount) => api.post(`/returns/${id}/approve`, { refundAmount }),
  rejectReturn: (id, rejectionReason) => api.post(`/returns/${id}/reject`, { rejectionReason }),
  markReturnReceived: (id) => api.post(`/returns/${id}/mark-received`),
  markReturnInspecting: (id) => api.post(`/returns/${id}/mark-inspecting`),
  markReturnInspected: (id, data) => api.post(`/returns/${id}/mark-inspected`, data),
  completeReturn: (id, refundTransactionId) => api.post(`/returns/${id}/complete`, { refundTransactionId }),
  updateReturnStatus: (id, status) => api.patch(`/returns/${id}/status`, { status }),
  processRefund: (id, data) => api.post(`/admin/payments/${id}/refund`, data),
  
  // Stripe Admin Payment System
  getStripePayments: async (params) => {
    console.log('🔍 adminAPI.getStripePayments called with params:', params);
    try {
      const result = await api.get('/stripe/admin/payments', params);
      console.log('✅ adminAPI.getStripePayments success:', result);
      return result;
    } catch (error) {
      console.error('❌ adminAPI.getStripePayments error:', error);
      throw error;
    }
  },
  getStripeStatistics: async () => {
    console.log('🔍 adminAPI.getStripeStatistics called');
    try {
      const result = await api.get('/stripe/admin/statistics');
      console.log('✅ adminAPI.getStripeStatistics success:', result);
      return result;
    } catch (error) {
      console.error('❌ adminAPI.getStripeStatistics error:', error);
      throw error;
    }
  },
  getStripeSellers: async () => {
    console.log('🔍 adminAPI.getStripeSellers called');
    try {
      const result = await api.get('/stripe/admin/sellers');
      console.log('✅ adminAPI.getStripeSellers success:', result);
      return result;
    } catch (error) {
      console.error('❌ adminAPI.getStripeSellers error:', error);
      throw error;
    }
  },
  processStripeRefund: async (paymentId, data) => {
    console.log('🔍 adminAPI.processStripeRefund called:', { paymentId, data });
    try {
      const result = await api.post(`/stripe/admin/refund/${paymentId}`, data);
      console.log('✅ adminAPI.processStripeRefund success:', result);
      return result;
    } catch (error) {
      console.error('❌ adminAPI.processStripeRefund error:', error);
      throw error;
    }
  },
  processStripePayout: async (data) => {
    console.log('🔍 adminAPI.processStripePayout called:', data);
    try {
      const result = await api.post('/stripe/admin/payout', data);
      console.log('✅ adminAPI.processStripePayout success:', result);
      return result;
    } catch (error) {
      console.error('❌ adminAPI.processStripePayout error:', error);
      throw error;
    }
  },
  
  // System
  getRoles: () => api.get('/admin/roles'),
  createRole: (data) => api.post('/admin/roles', data),
  getCommissions: () => api.get('/admin/commissions'),
  updateCommissions: (data) => api.put('/admin/commissions', data),
  getTaxes: () => api.get('/admin/taxes'),
  createTaxRate: (data) => api.post('/admin/taxes', data),
  updateTaxRate: (id, data) => api.put(`/admin/taxes/${id}`, data),
  deleteTaxRate: (id) => api.delete(`/admin/taxes/${id}`),
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data) => api.put('/admin/settings', data),
  getLogs: (params) => api.get('/admin/logs', params),
  getReports: async (params) => {
    console.log('🔍 adminAPI.getReports called');
    
    // Check if we should skip this endpoint based on previous failures
    if (shouldSkipEndpoint('reports')) {
      console.log('ℹ️ Reports endpoint skipped (known to be unavailable)');
      throw new Error('Reports endpoint not available');
    }
    
    try {
      // Use fetch with AbortController to handle errors more gracefully
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      let response;
      try {
        const token = localStorage.getItem('token');
        response = await fetch(`${API_BASE_URL}/admin/reports`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        // Mark endpoint as unavailable and handle quietly
        markEndpointUnavailable('reports');
        console.log('ℹ️ Reports endpoint not available (network error)');
        throw new Error('Reports endpoint not available');
      }
      
      // Handle 404 quietly
      if (response.status === 404) {
        markEndpointUnavailable('reports');
        console.log('ℹ️ Reports endpoint not available (404)');
        throw new Error('Reports endpoint not available');
      }
      
      // Handle other errors
      if (!response.ok) {
        markEndpointUnavailable('reports');
        console.log(`ℹ️ Reports endpoint returned ${response.status}`);
        throw new Error('Reports endpoint not available');
      }
      
      // Mark as available for future use
      markEndpointAvailable('reports');
      
      const result = await response.json();
      console.log('✅ adminAPI.getReports success:', result);
      return result;
    } catch (error) {
      // Handle all errors quietly
      if (error.message.includes('not available') || error.name === 'TypeError' || error.name === 'AbortError') {
        console.log('ℹ️ Reports endpoint not available');
        throw new Error('Reports endpoint not available');
      }
      markEndpointUnavailable('reports');
      console.log('ℹ️ Reports endpoint not available (unknown error)');
      throw new Error('Reports endpoint not available');
    }
  },
  generateReport: async (type, params) => {
    console.log('🔍 adminAPI.generateReport called');
    
    // Check if we should skip this endpoint based on previous failures
    if (shouldSkipEndpoint('generateReport')) {
      console.log('ℹ️ Generate report endpoint skipped (known to be unavailable)');
      throw new Error('Generate report endpoint not available');
    }
    
    try {
      // Use fetch with AbortController to handle errors more gracefully
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for generation
      
      let response;
      try {
        const token = localStorage.getItem('token');
        const queryParams = new URLSearchParams(params).toString();
        const url = `${API_BASE_URL}/admin/reports/${type}${queryParams ? `?${queryParams}` : ''}`;
        
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        // Mark endpoint as unavailable and handle quietly
        markEndpointUnavailable('generateReport');
        console.log('ℹ️ Generate report endpoint not available (network error)');
        throw new Error('Generate report endpoint not available');
      }
      
      // Handle 404 quietly
      if (response.status === 404) {
        markEndpointUnavailable('generateReport');
        console.log('ℹ️ Generate report endpoint not available (404)');
        throw new Error('Generate report endpoint not available');
      }
      
      // Handle other errors
      if (!response.ok) {
        markEndpointUnavailable('generateReport');
        console.log(`ℹ️ Generate report endpoint returned ${response.status}`);
        throw new Error('Generate report endpoint not available');
      }
      
      // Mark as available for future use
      markEndpointAvailable('generateReport');
      
      const result = await response.json();
      console.log('✅ adminAPI.generateReport success:', result);
      return result;
    } catch (error) {
      // Handle all errors quietly
      if (error.message.includes('not available') || error.name === 'TypeError' || error.name === 'AbortError') {
        console.log('ℹ️ Generate report endpoint not available');
        throw new Error('Generate report endpoint not available');
      }
      markEndpointUnavailable('generateReport');
      console.log('ℹ️ Generate report endpoint not available (unknown error)');
      throw new Error('Generate report endpoint not available');
    }
  },
  
  // PDF Export
  exportAnalyticsReport: async (params) => {
    console.log('🔍 adminAPI.exportAnalyticsReport called with params:', params);
    try {
      const response = await apiClient.get('/admin/analytics/export', {
        params,
        responseType: 'blob' // Important for PDF download
      });
      console.log('✅ adminAPI.exportAnalyticsReport success');
      return response;
    } catch (error) {
      console.error('❌ adminAPI.exportAnalyticsReport error:', error);
      throw error;
    }
  },
  
  // Commission Settings
  getCommissionSettings: async () => {
    console.log('🔍 adminAPI.getCommissionSettings called');
    
    // Check if we should skip this endpoint based on previous failures
    if (shouldSkipEndpoint('commissionSettings')) {
      console.log('ℹ️ Commission settings endpoint skipped (known to be unavailable)');
      throw new Error('Commission settings endpoint not available');
    }
    
    try {
      // Commission routes are mounted directly, not under /api
      const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
      
      // Use fetch with AbortController to handle errors more gracefully
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      let response;
      try {
        response = await fetch(`${BASE_URL}/admin/commission-settings`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        // Mark endpoint as unavailable and handle quietly
        markEndpointUnavailable('commissionSettings');
        console.log('ℹ️ Commission settings endpoint not available (network error)');
        throw new Error('Commission settings endpoint not available');
      }
      
      // Handle 404 quietly
      if (response.status === 404) {
        markEndpointUnavailable('commissionSettings');
        console.log('ℹ️ Commission settings endpoint not available (404)');
        throw new Error('Commission settings endpoint not available');
      }
      
      // Handle other errors
      if (!response.ok) {
        markEndpointUnavailable('commissionSettings');
        console.log(`ℹ️ Commission settings endpoint returned ${response.status}`);
        throw new Error('Commission settings endpoint not available');
      }
      
      // Mark as available for future use
      markEndpointAvailable('commissionSettings');
      
      const result = await response.json();
      console.log('✅ adminAPI.getCommissionSettings success:', result);
      return result;
    } catch (error) {
      // Handle all errors quietly
      if (error.message.includes('not available') || error.name === 'TypeError' || error.name === 'AbortError') {
        console.log('ℹ️ Commission settings endpoint not available');
        throw new Error('Commission settings endpoint not available');
      }
      markEndpointUnavailable('commissionSettings');
      console.log('ℹ️ Commission settings endpoint not available (unknown error)');
      throw new Error('Commission settings endpoint not available');
    }
  },
  updateCommissionSettings: async (data) => {
    console.log('🔍 adminAPI.updateCommissionSettings called:', data);
    
    // Check if we should skip this endpoint based on previous failures
    if (shouldSkipEndpoint('commissionSettings')) {
      console.log('ℹ️ Commission settings update endpoint skipped (known to be unavailable)');
      throw new Error('Commission settings update endpoint not available');
    }
    
    try {
      // Commission routes are mounted directly, not under /api
      const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
      
      // Use fetch with AbortController to handle errors more gracefully
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for PUT
      
      let response;
      try {
        response = await fetch(`${BASE_URL}/admin/commission-settings`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        // Mark endpoint as unavailable and handle quietly
        markEndpointUnavailable('commissionSettings');
        console.log('ℹ️ Commission settings update endpoint not available (network error)');
        throw new Error('Commission settings update endpoint not available');
      }
      
      // Handle 404 quietly
      if (response.status === 404) {
        markEndpointUnavailable('commissionSettings');
        console.log('ℹ️ Commission settings update endpoint not available (404)');
        throw new Error('Commission settings update endpoint not available');
      }
      
      // Handle other errors
      if (!response.ok) {
        markEndpointUnavailable('commissionSettings');
        console.log(`ℹ️ Commission settings update endpoint returned ${response.status}`);
        throw new Error('Commission settings update endpoint not available');
      }
      
      // Mark as available for future use
      markEndpointAvailable('commissionSettings');
      
      const result = await response.json();
      console.log('✅ adminAPI.updateCommissionSettings success:', result);
      return result;
    } catch (error) {
      // Handle all errors quietly
      if (error.message.includes('not available') || error.name === 'TypeError' || error.name === 'AbortError') {
        console.log('ℹ️ Commission settings update endpoint not available');
        throw new Error('Commission settings update endpoint not available');
      }
      markEndpointUnavailable('commissionSettings');
      console.log('ℹ️ Commission settings update endpoint not available (unknown error)');
      throw new Error('Commission settings update endpoint not available');
    }
  },
  getCommissionAnalytics: async (period = '30days') => {
    console.log('🔍 adminAPI.getCommissionAnalytics called');
    
    // Check if we should skip this endpoint based on previous failures
    if (shouldSkipEndpoint('commissionAnalytics')) {
      console.log('ℹ️ Commission analytics endpoint skipped (known to be unavailable)');
      throw new Error('Commission analytics endpoint not available');
    }
    
    try {
      // Commission routes are mounted directly, not under /api
      const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
      
      // Use fetch with AbortController to handle errors more gracefully
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      let response;
      try {
        response = await fetch(`${BASE_URL}/admin/commission-analytics?period=${period}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        // Mark endpoint as unavailable and handle quietly
        markEndpointUnavailable('commissionAnalytics');
        console.log('ℹ️ Commission analytics endpoint not available (network error)');
        throw new Error('Commission analytics endpoint not available');
      }
      
      // Handle 404 quietly
      if (response.status === 404) {
        markEndpointUnavailable('commissionAnalytics');
        console.log('ℹ️ Commission analytics endpoint not available (404)');
        throw new Error('Commission analytics endpoint not available');
      }
      
      // Handle other errors
      if (!response.ok) {
        markEndpointUnavailable('commissionAnalytics');
        console.log(`ℹ️ Commission analytics endpoint returned ${response.status}`);
        throw new Error('Commission analytics endpoint not available');
      }
      
      // Mark as available for future use
      markEndpointAvailable('commissionAnalytics');
      
      const result = await response.json();
      console.log('✅ adminAPI.getCommissionAnalytics success:', result);
      return result;
    } catch (error) {
      // Handle all errors quietly
      if (error.message.includes('not available') || error.name === 'TypeError' || error.name === 'AbortError') {
        console.log('ℹ️ Commission analytics endpoint not available');
        throw new Error('Commission analytics endpoint not available');
      }
      markEndpointUnavailable('commissionAnalytics');
      console.log('ℹ️ Commission analytics endpoint not available (unknown error)');
      throw new Error('Commission analytics endpoint not available');
    }
  }
};

// Authentication API endpoints
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  registerSeller: (userData) => api.post('/auth/register/seller', userData),
  logout: () => api.post('/auth/logout'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
  refreshToken: () => api.post('/auth/refresh-token'),
  getCurrentUser: () => api.get('/auth/me')
};

// Manager API endpoints
export const managerAPI = {
  // Dashboard
  getDashboardStats: async () => {
    console.log('🎯 managerAPI.getDashboardStats called');
    try {
      const result = await api.get('/manager/dashboard');
      console.log('✅ Manager dashboard API success:', result);
      return result;
    } catch (error) {
      console.error('❌ Manager dashboard API error:', error);
      throw error;
    }
  },
  getOverview: () => api.get('/manager/overview'),
  
  // Product Approvals (Amazon-style workflow)
  getApprovalQueue: () => api.get('/manager/products/pending'),
  getApprovalStats: () => api.get('/manager/dashboard'),
  approveProduct: (id, data) => api.post(`/manager/products/${id}/approve`, data),
  rejectProduct: (id, data) => api.post(`/manager/products/${id}/reject`, data),
  requestChanges: (id, data) => api.post(`/manager/products/${id}/revision`, data),
  getApprovalHistory: (id) => api.get(`/manager/products/${id}/history`),
  
  // Legacy endpoints (keep for backward compatibility)
  getPendingProducts: (params) => api.get('/manager/products/pending', params),
  getProductDetails: (id) => api.get(`/manager/products/${id}`),
  
  // Seller Approvals
  getPendingSellers: (params) => api.get('/manager/sellers/pending', params),
  getSellerDetails: (id) => api.get(`/manager/sellers/${id}`),
  approveSeller: (id, data) => api.post(`/manager/sellers/${id}/approve`, data),
  rejectSeller: (id, data) => api.post(`/manager/sellers/${id}/reject`, data),
  
  // Orders
  getOrdersWithIssues: (params) => api.get('/manager/orders/issues', params),
  getOrderDetails: (id) => api.get(`/manager/orders/${id}`),
  resolveOrderIssue: (id, data) => api.post(`/manager/orders/${id}/resolve`, data),
  
  // Returns
  getPendingReturns: (params) => api.get('/manager/returns/pending', params),
  getReturnDetails: (id) => api.get(`/manager/returns/${id}`),
  approveReturn: (id, data) => api.post(`/manager/returns/${id}/approve`, data),
  rejectReturn: (id, data) => api.post(`/manager/returns/${id}/reject`, data),
  
  // Disputes
  getDisputes: (params) => api.get('/manager/disputes', params),
  getDisputeDetails: (id) => api.get(`/manager/disputes/${id}`),
  resolveDispute: (id, data) => api.post(`/manager/disputes/${id}/resolve`, data),
  escalateDispute: (id, data) => api.post(`/manager/disputes/${id}/escalate`, data),
  
  // Refunds
  getPendingRefunds: (params) => api.get('/manager/refunds/pending', params),
  getRefundDetails: (id) => api.get(`/manager/refunds/${id}`),
  processRefund: (id, data) => api.post(`/manager/refunds/${id}/process`, data),
  
  // Support Tickets
  getSupportTickets: (params) => api.get('/manager/support/tickets', params),
  getTicketDetails: (id) => api.get(`/manager/support/tickets/${id}`),
  respondToTicket: (id, data) => api.post(`/manager/support/tickets/${id}/respond`, data),
  closeTicket: (id) => api.post(`/manager/support/tickets/${id}/close`),
  
  // Escalations
  getEscalations: (params) => api.get('/manager/escalations', params),
  getEscalationDetails: (id) => api.get(`/manager/escalations/${id}`),
  assignEscalation: (id, data) => api.post(`/manager/escalations/${id}/assign`, data),
  
  // Performance
  getPerformanceMetrics: () => api.get('/manager/performance'),
  getSellerPerformance: (params) => api.get('/manager/performance/sellers', params),
  getSellerPerformanceDetails: (id) => api.get(`/manager/performance/sellers/${id}`),
  
  // Review Moderation
  getFlaggedReviews: (params) => api.get('/manager/reviews/flagged', params),
  getReviewDetails: (id) => api.get(`/manager/reviews/${id}`),
  approveReview: (id) => api.post(`/manager/reviews/${id}/approve`),
  removeReview: (id, data) => api.post(`/manager/reviews/${id}/remove`, data),
  editReview: (id, data) => api.put(`/manager/reviews/${id}`, data),
  
  // Customer Feedback
  getCustomerFeedback: (params) => api.get('/manager/feedback/customers', params),
  getFeedbackDetails: (id) => api.get(`/manager/feedback/${id}`),
  respondToFeedback: (id, data) => api.post(`/manager/feedback/${id}/respond`, data),

  // Replacements
  getReplacements: (params) => api.get('/replacements', params),
  getReplacement: (id) => api.get(`/replacements/${id}`),
  approveReplacement: (id) => api.put(`/replacements/${id}/approve`),
  rejectReplacement: (id, reason) => api.put(`/replacements/${id}/reject`, { reason }),
  getReplacementAnalytics: (params) => api.get('/replacements/analytics', params)
};

// Seller API endpoints
export const sellerAPI = {
  // Dashboard
  getDashboardStats: async () => {
    console.log('🔍 sellerAPI.getDashboardStats called');
    try {
      const result = await api.get('/seller/dashboard');
      console.log('✅ sellerAPI.getDashboardStats success:', result);
      return result;
    } catch (error) {
      console.error('❌ sellerAPI.getDashboardStats error:', error);
      throw error;
    }
  },
  getRevenueAnalytics: (params) => api.get('/seller/analytics/revenue', params),
  getSalesAnalytics: (params) => api.get('/seller/analytics/sales', params),
  getPerformanceMetrics: () => api.get('/seller/performance'),
  
  // Products
  getProducts: async (params) => {
    console.log('🔍 sellerAPI.getProducts called with params:', params);
    try {
      const result = await api.get('/seller/products', params);
      console.log('✅ sellerAPI.getProducts success:', result);
      return result;
    } catch (error) {
      console.error('❌ sellerAPI.getProducts error:', error);
      throw error;
    }
  },
  getProduct: (id) => api.get(`/seller/products/${id}`),
  createProduct: (data) => api.post('/seller/products', data),
  updateProduct: (id, data) => api.put(`/seller/products/${id}`, data),
  deleteProduct: (id) => api.delete(`/seller/products/${id}`),
  bulkUpload: (formData, onProgress) => api.upload('/seller/products/bulk-upload', formData, onProgress),
  getInventory: (params) => api.get('/seller/inventory', params),
  updateStock: (id, quantity) => api.put(`/seller/inventory/${id}`, { quantity }),
  
  // Orders (using sub-orders endpoint)
  getOrders: async (params) => {
    console.log('🔍 sellerAPI.getOrders called with params:', params);
    try {
      const result = await api.get('/seller/sub-orders', params);
      console.log('✅ sellerAPI.getOrders success:', result);
      return result;
    } catch (error) {
      console.error('❌ sellerAPI.getOrders error:', error);
      throw error;
    }
  },
  getOrder: (id) => api.get(`/sub-orders/${id}`),
  markAsShipped: (id, data) => api.patch(`/seller/sub-orders/${id}/fulfillment`, { ...data, status: 'shipped' }),
  getShippingQueue: (params) => api.get('/seller/sub-orders', { ...params, fulfillment_status: 'pending' }),
  generateLabel: (orderId) => api.post('/seller/shipping/label', { orderId }),
  getReturns: (params) => api.get('/seller/returns', params),
  getReturnStats: () => api.get('/seller/returns/stats'),
  authorizeReturn: (id, refundAmount) => api.post(`/seller/returns/${id}/authorize`, { refundAmount }),
  closeReturn: (id, rejectionReason) => api.post(`/seller/returns/${id}/close`, { rejectionReason }),
  markReturnReceived: (id) => api.post(`/seller/returns/${id}/receive`),
  inspectReturn: (id, data) => api.post(`/seller/returns/${id}/inspect`, data),
  issueRefund: (id) => api.post(`/seller/returns/${id}/issue-refund`),
  retryRefund: (id) => api.post(`/seller/returns/${id}/retry-refund`),
  
  // Financial
  getPayouts: (params) => api.get('/seller/payouts', params),
  getBalance: () => api.get('/seller/payouts/balance'),
  requestWithdrawal: (amount) => api.post('/seller/payouts/request', { amount }),
  getCommissions: () => api.get('/seller/commissions'),
  getInvoices: (params) => api.get('/seller/invoices', params),
  downloadInvoice: (id) => api.download(`/seller/invoices/${id}/download`, `invoice-${id}.pdf`),
  
  // Customer Service
  getMessages: (params) => api.get('/seller/messages', params),
  replyToMessage: (id, message) => api.post(`/seller/messages/${id}/reply`, { message }),
  getReviews: (params) => api.get('/seller/reviews', params),
  replyToReview: (id, reply) => api.post(`/seller/reviews/${id}/reply`, { reply }),
  getDisputes: (params) => api.get('/seller/disputes', params),
  respondToDispute: (id, response) => api.post(`/seller/disputes/${id}/respond`, response),

  // Replacements
  getReplacements: (params) => api.get('/replacements', params),
  getReplacement: (id) => api.get(`/replacements/${id}`),
  updateReplacementShipment: (id, data) => api.put(`/replacements/${id}/shipment`, data),
  confirmReplacementReturn: (id) => api.put(`/replacements/${id}/confirm-return`),

  // Account
  getProfile: () => api.get('/seller/profile'),
  updateProfile: (data) => api.put('/seller/profile', data),
  getSettings: () => api.get('/seller/settings'),
  updateSettings: (data) => api.put('/seller/settings', data)
};

// Customer API endpoints
export const customerAPI = {
  // Products & Browse
  getProducts: (params) => api.get('/products', params),
  getProduct: (id) => api.get(`/products/${id}`),
  searchProducts: (params) => api.get('/products/search', params),
  getCategories: () => api.get('/categories'),
  getCategoryProducts: (id, params) => api.get(`/categories/${id}/products`, params),
  
  // Cart
  getCart: () => api.get('/cart'),
  getCartSummary: () => api.get('/cart/summary'),
  getCartCount: () => api.get('/cart/count'),
  addToCart: (data) => api.post('/cart/items', data),
  updateCartItem: (productId, quantity) => api.put(`/cart/items/${productId}`, { quantity }),
  removeFromCart: (productId) => api.delete(`/cart/items/${productId}`),
  clearCart: () => api.delete('/cart'),
  validateCart: () => api.post('/cart/validate'),
  
  // Orders
  createOrder: (data) => api.post('/orders', data),
  getOrders: (params) => api.get('/orders', params),
  getOrder: (id) => api.get(`/orders/${id}`),
  cancelOrder: (id) => api.post(`/orders/${id}/cancel`),
  getInvoice: (id) => api.get(`/orders/${id}/invoice`),
  getOrderRefunds: (id) => api.get(`/orders/${id}/refunds`),
  getOrderWithRefunds: (id) => api.get(`/orders/${id}/with-refunds`),
  checkRefundEligibility: (id) => api.get(`/orders/${id}/refund-eligibility`),
  
  // Profile & Account
  getProfile: () => api.get('/users/me'),
  updateProfile: (data) => api.put('/users/me', data),
  getStatistics: () => api.get('/users/me/statistics'),
  deleteAccount: () => api.delete('/users/me'),
  
  // Addresses
  getAddresses: () => api.get('/addresses'),
  getDefaultAddress: () => api.get('/addresses/default'),
  getAddressCount: () => api.get('/addresses/count'),
  getAddress: (id) => api.get(`/addresses/${id}`),
  createAddress: (data) => api.post('/addresses', data),
  updateAddress: (id, data) => api.put(`/addresses/${id}`, data),
  setDefaultAddress: (id) => api.patch(`/addresses/${id}/default`),
  deleteAddress: (id) => api.delete(`/addresses/${id}`),
  
  // Reviews
  getMyReviews: () => api.get('/reviews/my-reviews'),
  getProductReviews: (productId, params) => api.get(`/products/${productId}/reviews`, params),
  getProductRatingStats: (productId) => api.get(`/products/${productId}/rating-stats`),
  createReview: (data) => api.post('/reviews', data),
  getReview: (id) => api.get(`/reviews/${id}`),
  updateReview: (id, data) => api.put(`/reviews/${id}`, data),
  deleteReview: (id) => api.delete(`/reviews/${id}`),
  
  // Returns
  getReturns: () => api.get('/returns/user/me'),
  getReturn: (id) => api.get(`/returns/${id}`),
  getReturnsByOrder: (orderId) => api.get(`/returns/order/${orderId}`),
  createReturn: (data) => api.post('/returns', data),
  cancelReturn: (id) => api.post(`/returns/${id}/cancel`),
  updateReturnShipping: (id, data) => api.post(`/returns/${id}/shipping`, data),
  updateReturnImages: (id, images) => api.put(`/returns/${id}/images`, { images }),

  // Replacements
  getReplacements: (params) => api.get('/replacements', params),
  getReplacement: (id) => api.get(`/replacements/${id}`),
  createReplacement: (data) => api.post('/replacements', data),
  updateReplacementReturnTracking: (id, trackingNumber) => api.put(`/replacements/${id}/return-tracking`, { return_tracking_number: trackingNumber }),

  // Wishlist
  getWishlist: () => api.get('/wishlist'),
  getWishlistCount: () => api.get('/wishlist/count'),
  addToWishlist: (productId) => api.post('/wishlist', { productId }),
  removeFromWishlist: (productId) => api.delete(`/wishlist/${productId}`),
  clearWishlist: () => api.delete('/wishlist/clear'),
  checkWishlistStatus: (productId) => api.get(`/wishlist/check/${productId}`),
  
  // Notifications (placeholder - needs backend implementation)
  getNotifications: () => api.get('/notifications'),
  markNotificationRead: (id) => api.put(`/notifications/${id}/read`),
  markAllNotificationsRead: () => api.put('/notifications/read-all')
};
// ==========================================
// GUEST API - Amazon-Style Guest Checkout
// ==========================================
export const guestAPI = {
  // Guest Cart Management (NO AUTH REQUIRED)
  createGuestCart: () => api.post('/guest/cart/create'),
  getGuestCart: (sessionId) => api.get(`/guest/cart/${sessionId}`),
  addToGuestCart: (sessionId, productId, quantity) => 
    api.post(`/guest/cart/${sessionId}/add`, { productId, quantity }),
  updateGuestCartItem: (sessionId, productId, quantity) => 
    api.patch(`/guest/cart/${sessionId}/update`, { productId, quantity }),
  removeFromGuestCart: (sessionId, productId) => 
    api.delete(`/guest/cart/${sessionId}/remove/${productId}`),
  clearGuestCart: (sessionId) => 
    api.delete(`/guest/cart/${sessionId}/clear`),

  // Guest Checkout Flow
  validateGuestEmail: (email) => 
    api.post('/guest/checkout/validate-email', { email }),
  createGuestUser: (email, fullName, phone) => 
    api.post('/guest/checkout/create-guest-user', { email, fullName, phone }),
  saveGuestAddress: (addressData) => 
    api.post('/guest/checkout/save-address', addressData),
  placeGuestOrder: (orderData) => 
    api.post('/guest/checkout/place-order', orderData),

  // Guest Order Tracking
  trackGuestOrder: (email, orderId) => 
    api.get('/guest/orders/track', { email, orderId }),
  trackOrderByToken: (token) => 
    api.get('/guest/orders/track', { token }),
  sendTrackingLink: (email, orderId) => 
    api.post('/guest/orders/send-tracking-link', { email, orderId }),

  // Guest to Registered Conversion
  convertToRegistered: (email, password, fullName) => 
    api.post('/guest/convert-to-registered', { email, password, fullName })
};
export default api;
