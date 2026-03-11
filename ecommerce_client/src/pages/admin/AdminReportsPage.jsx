import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api.service';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const AdminReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [error, setError] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  const [realTimeStats, setRealTimeStats] = useState({
    reportsGenerated: 0,
    lastReportTime: 'Never',
    lastReportType: 'None',
    scheduledReports: 0
  });
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Only run once on mount
    let mounted = true;
    
    const initializeReports = async () => {
      if (mounted) {
        await fetchReports();
      }
    };
    initializeReports();
    
    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array - only run once

  const fetchReports = async () => {
    // Prevent multiple simultaneous calls
    if (isGenerating) {
      console.log('⏸️ fetchReports already running, skipping...');
      return;
    }
    
    try {
      setIsGenerating(true);
      setLoading(true);
      setError(null);
      
      // Always generate reports from real backend data instead of using mock API
      console.log('📊 Generating reports from real platform data');
      
      try {
        // Fetch real data from existing endpoints with reduced limits and shorter timeouts
        const fetchWithTimeout = (promise, timeout = 10000) => {
          return Promise.race([
            promise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
          ]);
        };

        const [paymentsData, usersData, ordersData, productsData] = await Promise.allSettled([
          fetchWithTimeout(adminAPI.getStripePayments({ dateRange: '30days', limit: 100 }), 8000),
          fetchWithTimeout(adminAPI.getUsers({ limit: 100 }), 8000),
          fetchWithTimeout(adminAPI.getOrders({ limit: 100 }), 8000),
          fetchWithTimeout(adminAPI.getProducts({ limit: 100 }), 8000)
        ]);
        
        // Extract data from settled promises, using empty arrays for failed requests
        const payments = paymentsData.status === 'fulfilled' ? 
          (paymentsData.value?.payments || paymentsData.value?.data || []) : [];
        const users = usersData.status === 'fulfilled' ? 
          (usersData.value?.users || usersData.value?.data || []) : [];
        const orders = ordersData.status === 'fulfilled' ? 
          (ordersData.value?.orders || ordersData.value?.data || []) : [];
        const products = productsData.status === 'fulfilled' ? 
          (productsData.value?.products || productsData.value?.data || []) : [];
        
        // Log what data we successfully retrieved
        console.log('📊 Data retrieved:', {
          payments: payments.length,
          users: users.length,
          orders: orders.length,
          products: products.length
        });
        
        // Generate comprehensive reports from actual data
        const generatedReports = generateReportsFromRealData(payments, users, orders, products);
        
        setRecentReports(generatedReports);
        
        // Update real-time stats
        setRealTimeStats({
          reportsGenerated: generatedReports.length,
          lastReportTime: generatedReports.length > 0 ? 'Just now' : 'Never',
          lastReportType: generatedReports.length > 0 ? 'Real Data Report' : 'None',
          scheduledReports: 8 // Number of available report types
        });
        
        // Show appropriate success message
        const failedRequests = [paymentsData, usersData, ordersData, productsData]
          .filter(result => result.status === 'rejected').length;
        
        if (failedRequests === 0) {
          toast.success('Reports generated from complete platform data');
        } else if (failedRequests < 4) {
          toast.success(`Reports generated from available data (${4 - failedRequests}/4 sources)`);
        } else {
          toast.success('Reports generated with sample data (backend unavailable)');
        }
        
      } catch (dataError) {
        console.error('Error fetching real data for reports:', dataError);
        
        // Generate sample reports when no backend data is available
        const sampleReports = generateSampleReports();
        setRecentReports(sampleReports);
        
        setRealTimeStats({
          reportsGenerated: sampleReports.length,
          lastReportTime: 'Just now',
          lastReportType: 'Sample Data Report',
          scheduledReports: 8
        });
        
        toast.success('Reports generated with sample data (backend unavailable)');
      }
    } catch (error) {
      console.error('Error generating reports:', error);
      const errorMessage = error.message || 'Failed to generate reports';
      setError(errorMessage);
      toast.error(errorMessage);
      setRecentReports([]);
    } finally {
      setLoading(false);
      setIsGenerating(false);
    }
  };

  const generateReportsFromRealData = (payments, users, orders, products) => {
    const now = new Date();
    const reports = [];

    // Ensure we have arrays to work with
    const safePayments = Array.isArray(payments) ? payments : [];
    const safeUsers = Array.isArray(users) ? users : [];
    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeProducts = Array.isArray(products) ? products : [];

    // Calculate date ranges for better analytics
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    // Pre-calculate common metrics to avoid scope issues
    const newUsersThisMonth = safeUsers.filter(u => {
      try {
        const createdDate = new Date(u.created_at || u.createdAt);
        return createdDate >= thirtyDaysAgo;
      } catch (error) {
        return false;
      }
    }).length;
    
    const newUsersThisWeek = safeUsers.filter(u => {
      try {
        const createdDate = new Date(u.created_at || u.createdAt);
        return createdDate >= sevenDaysAgo;
      } catch (error) {
        return false;
      }
    }).length;

    // Revenue Report from real payment data
    if (safePayments.length > 0) {
      const totalRevenue = safePayments.reduce((sum, p) => sum + ((p.amount || 0) / 100), 0);
      const recentPayments = safePayments.filter(p => {
        try {
          return new Date(p.created_at || p.createdAt) >= thirtyDaysAgo;
        } catch (error) {
          return false;
        }
      });
      const weeklyRevenue = safePayments
        .filter(p => {
          try {
            return new Date(p.created_at || p.createdAt) >= sevenDaysAgo;
          } catch (error) {
            return false;
          }
        })
        .reduce((sum, p) => sum + ((p.amount || 0) / 100), 0);
      
      reports.push({
        id: 1,
        name: `Revenue Report - ${now.toLocaleDateString()}`,
        generated: now.toLocaleString(),
        period: 'Last 30 Days',
        format: 'PDF',
        status: 'Ready',
        data: {
          totalRevenue: totalRevenue.toFixed(2),
          monthlyRevenue: recentPayments.reduce((sum, p) => sum + ((p.amount || 0) / 100), 0).toFixed(2),
          weeklyRevenue: weeklyRevenue.toFixed(2),
          transactionCount: safePayments.length,
          averageOrderValue: (totalRevenue / Math.max(safePayments.length, 1)).toFixed(2),
          currency: safePayments[0]?.currency || 'USD'
        }
      });
    }

    // User Activity Report from real user data
    if (safeUsers.length > 0) {
      const activeUsers = safeUsers.filter(u => u.status === 'active' || !u.status).length;
      
      reports.push({
        id: 2,
        name: `User Activity Report - ${now.toLocaleDateString()}`,
        generated: now.toLocaleString(),
        period: 'Real-time',
        format: 'Excel',
        status: 'Ready',
        data: {
          totalUsers: safeUsers.length,
          activeUsers,
          newUsersThisMonth,
          newUsersThisWeek,
          userGrowthRate: ((newUsersThisMonth / Math.max(safeUsers.length - newUsersThisMonth, 1)) * 100).toFixed(1)
        }
      });
    }

    // Order Analytics from real order data
    if (safeOrders.length > 0) {
      const completedOrders = safeOrders.filter(o => ['delivered', 'completed'].includes(o.status)).length;
      const pendingOrders = safeOrders.filter(o => ['pending', 'processing', 'shipped'].includes(o.status)).length;
      const cancelledOrders = safeOrders.filter(o => ['cancelled', 'refunded'].includes(o.status)).length;
      const recentOrders = safeOrders.filter(o => {
        try {
          return new Date(o.created_at || o.createdAt) >= thirtyDaysAgo;
        } catch (error) {
          return false;
        }
      });
      
      reports.push({
        id: 3,
        name: `Order Analytics - ${now.toLocaleDateString()}`,
        generated: now.toLocaleString(),
        period: 'Last 30 Days',
        format: 'CSV',
        status: 'Ready',
        data: {
          totalOrders: safeOrders.length,
          completedOrders,
          pendingOrders,
          cancelledOrders,
          recentOrders: recentOrders.length,
          completionRate: (completedOrders / Math.max(safeOrders.length, 1) * 100).toFixed(1),
          cancellationRate: (cancelledOrders / Math.max(safeOrders.length, 1) * 100).toFixed(1)
        }
      });
    }

    // Product Performance from payment and product data
    if (safePayments.length > 0 || safeProducts.length > 0) {
      const productSales = {};
      safePayments.forEach(p => {
        if (p.product_name || p.description) {
          const productName = p.product_name || p.description;
          productSales[productName] = (productSales[productName] || 0) + 1;
        }
      });
      
      const topProducts = Object.entries(productSales)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
      
      reports.push({
        id: 4,
        name: `Product Performance - ${now.toLocaleDateString()}`,
        generated: now.toLocaleString(),
        period: 'Last 30 Days',
        format: 'PDF',
        status: 'Ready',
        data: {
          totalProducts: safeProducts.length || Object.keys(productSales).length,
          productsWithSales: Object.keys(productSales).length,
          topProducts: topProducts.map(([name, sales]) => ({ name, sales })),
          averageSalesPerProduct: (safePayments.length / Math.max(Object.keys(productSales).length, 1)).toFixed(1)
        }
      });
    }

    // Financial Summary from all data
    if (safePayments.length > 0 || safeOrders.length > 0) {
      const totalRevenue = safePayments.reduce((sum, p) => sum + ((p.amount || 0) / 100), 0);
      const commission = totalRevenue * 0.15; // 15% commission
      const netRevenue = totalRevenue - commission;
      const refunds = safePayments.filter(p => p.status === 'refunded').reduce((sum, p) => sum + ((p.amount || 0) / 100), 0);
      
      reports.push({
        id: 5,
        name: `Financial Summary - ${now.toLocaleDateString()}`,
        generated: now.toLocaleString(),
        period: 'All Time',
        format: 'Excel',
        status: 'Ready',
        data: {
          totalRevenue: totalRevenue.toFixed(2),
          commission: commission.toFixed(2),
          netRevenue: netRevenue.toFixed(2),
          refunds: refunds.toFixed(2),
          transactionCount: safePayments.length,
          averageTransactionValue: (totalRevenue / Math.max(safePayments.length, 1)).toFixed(2)
        }
      });
    }

    // Seller Performance (if we have seller data in payments)
    const sellerPerformance = {};
    safePayments.forEach(p => {
      if (p.seller_id || p.sellerId) {
        const sellerId = p.seller_id || p.sellerId;
        if (!sellerPerformance[sellerId]) {
          sellerPerformance[sellerId] = { sales: 0, revenue: 0 };
        }
        sellerPerformance[sellerId].sales += 1;
        sellerPerformance[sellerId].revenue += (p.amount || 0) / 100;
      }
    });

    if (Object.keys(sellerPerformance).length > 0) {
      const topSellers = Object.entries(sellerPerformance)
        .sort(([,a], [,b]) => b.revenue - a.revenue)
        .slice(0, 10);

      reports.push({
        id: 6,
        name: `Seller Performance - ${now.toLocaleDateString()}`,
        generated: now.toLocaleString(),
        period: 'Last 30 Days',
        format: 'CSV',
        status: 'Ready',
        data: {
          totalSellers: Object.keys(sellerPerformance).length,
          topSellers: topSellers.map(([id, data]) => ({ 
            sellerId: id, 
            sales: data.sales, 
            revenue: data.revenue.toFixed(2) 
          })),
          averageRevenuePerSeller: (Object.values(sellerPerformance).reduce((sum, s) => sum + s.revenue, 0) / Object.keys(sellerPerformance).length).toFixed(2)
        }
      });
    }

    // Growth Analytics
    if (safeUsers.length > 0 && safePayments.length > 0) {
      const monthlyGrowth = {
        users: newUsersThisMonth,
        revenue: safePayments.filter(p => {
          try {
            return new Date(p.created_at || p.createdAt) >= thirtyDaysAgo;
          } catch (error) {
            return false;
          }
        }).reduce((sum, p) => sum + ((p.amount || 0) / 100), 0),
        orders: safeOrders.filter(o => {
          try {
            return new Date(o.created_at || o.createdAt) >= thirtyDaysAgo;
          } catch (error) {
            return false;
          }
        }).length
      };

      reports.push({
        id: 7,
        name: `Growth Analytics - ${now.toLocaleDateString()}`,
        generated: now.toLocaleString(),
        period: 'Monthly Trends',
        format: 'PDF',
        status: 'Ready',
        data: {
          userGrowth: monthlyGrowth.users,
          revenueGrowth: monthlyGrowth.revenue.toFixed(2),
          orderGrowth: monthlyGrowth.orders,
          retentionRate: ((safeUsers.length - newUsersThisMonth) / Math.max(safeUsers.length, 1) * 100).toFixed(1)
        }
      });
    }

    // Payment Methods Report
    if (safePayments.length > 0) {
      const paymentMethods = {};
      safePayments.forEach(p => {
        const method = p.payment_method || p.paymentMethod || 'Unknown';
        paymentMethods[method] = (paymentMethods[method] || 0) + 1;
      });

      reports.push({
        id: 8,
        name: `Payment Methods Report - ${now.toLocaleDateString()}`,
        generated: now.toLocaleString(),
        period: 'All Time',
        format: 'CSV',
        status: 'Ready',
        data: {
          totalTransactions: safePayments.length,
          paymentMethods: Object.entries(paymentMethods).map(([method, count]) => ({
            method,
            count,
            percentage: ((count / safePayments.length) * 100).toFixed(1)
          })),
          successRate: ((safePayments.filter(p => p.status === 'succeeded' || p.status === 'completed').length / safePayments.length) * 100).toFixed(1)
        }
      });
    }

    // If no data is available, create a placeholder report
    if (reports.length === 0) {
      reports.push({
        id: 1,
        name: `No Data Report - ${now.toLocaleDateString()}`,
        generated: now.toLocaleString(),
        period: 'Current',
        format: 'PDF',
        status: 'Ready',
        data: {
          message: 'No data available from backend',
          totalPayments: safePayments.length,
          totalUsers: safeUsers.length,
          totalOrders: safeOrders.length,
          totalProducts: safeProducts.length
        }
      });
    }

    return reports;
  };

  const generateSamplePayments = () => [
    { amount: 7500, currency: 'USD', status: 'succeeded', created_at: new Date().toISOString(), product_name: 'Sample Product A' },
    { amount: 12000, currency: 'USD', status: 'succeeded', created_at: new Date().toISOString(), product_name: 'Sample Product B' },
    { amount: 4500, currency: 'USD', status: 'succeeded', created_at: new Date().toISOString(), product_name: 'Sample Product C' }
  ];

  const generateSampleUsers = () => [
    { id: 1, status: 'active', role: 'customer', created_at: new Date().toISOString() },
    { id: 2, status: 'active', role: 'customer', created_at: new Date().toISOString() },
    { id: 3, status: 'active', role: 'seller', created_at: new Date().toISOString() }
  ];

  const generateSampleOrders = () => [
    { id: 1, status: 'completed', created_at: new Date().toISOString() },
    { id: 2, status: 'pending', created_at: new Date().toISOString() },
    { id: 3, status: 'delivered', created_at: new Date().toISOString() }
  ];

  const generateSampleProducts = () => [
    { id: 1, name: 'Sample Product A', status: 'active' },
    { id: 2, name: 'Sample Product B', status: 'active' },
    { id: 3, name: 'Sample Product C', status: 'active' }
  ];

  const generateSampleReports = () => {
    const now = new Date();
    const reports = [];

    // Sample Revenue Report
    reports.push({
      id: 1,
      name: `Revenue Report - ${now.toLocaleDateString()}`,
      generated: now.toLocaleString(),
      period: 'Sample Data',
      format: 'PDF',
      status: 'Ready',
      data: {
        totalRevenue: '12,450.00',
        monthlyRevenue: '8,320.00',
        weeklyRevenue: '2,150.00',
        transactionCount: 156,
        averageOrderValue: '79.81',
        currency: 'USD',
        message: 'Sample data - backend unavailable'
      }
    });

    // Sample User Activity Report
    reports.push({
      id: 2,
      name: `User Activity Report - ${now.toLocaleDateString()}`,
      generated: now.toLocaleString(),
      period: 'Sample Data',
      format: 'Excel',
      status: 'Ready',
      data: {
        totalUsers: 1250,
        activeUsers: 890,
        newUsersThisMonth: 45,
        newUsersThisWeek: 12,
        userGrowthRate: '3.7',
        message: 'Sample data - backend unavailable'
      }
    });

    // Sample Order Analytics
    reports.push({
      id: 3,
      name: `Order Analytics - ${now.toLocaleDateString()}`,
      generated: now.toLocaleString(),
      period: 'Sample Data',
      format: 'CSV',
      status: 'Ready',
      data: {
        totalOrders: 234,
        completedOrders: 198,
        pendingOrders: 28,
        cancelledOrders: 8,
        recentOrders: 67,
        completionRate: '84.6',
        cancellationRate: '3.4',
        message: 'Sample data - backend unavailable'
      }
    });

    // Sample Product Performance
    reports.push({
      id: 4,
      name: `Product Performance - ${now.toLocaleDateString()}`,
      generated: now.toLocaleString(),
      period: 'Sample Data',
      format: 'PDF',
      status: 'Ready',
      data: {
        totalProducts: 89,
        productsWithSales: 67,
        topProducts: [
          { name: 'Sample Product A', sales: 45 },
          { name: 'Sample Product B', sales: 32 },
          { name: 'Sample Product C', sales: 28 }
        ],
        averageSalesPerProduct: '2.3',
        message: 'Sample data - backend unavailable'
      }
    });

    // Sample Financial Summary
    reports.push({
      id: 5,
      name: `Financial Summary - ${now.toLocaleDateString()}`,
      generated: now.toLocaleString(),
      period: 'Sample Data',
      format: 'Excel',
      status: 'Ready',
      data: {
        totalRevenue: '12,450.00',
        commission: '1,867.50',
        netRevenue: '10,582.50',
        refunds: '245.00',
        transactionCount: 156,
        averageTransactionValue: '79.81',
        message: 'Sample data - backend unavailable'
      }
    });

    return reports;
  };

  const handleGenerate = async (reportType) => {
    try {
      setError(null);
      toast.loading(`Generating ${reportType} from real data...`);
      
      // Always generate from real data instead of using API
      console.log('📊 Generating report from real platform data:', reportType);
      
      // Simulate processing time for better UX
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fetch fresh data for the specific report with timeout protection
      try {
        const fetchWithTimeout = (promise, timeout = 8000) => {
          return Promise.race([
            promise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
          ]);
        };

        const [paymentsData, usersData, ordersData, productsData] = await Promise.allSettled([
          fetchWithTimeout(adminAPI.getStripePayments({ dateRange: selectedPeriod, limit: 50 })),
          fetchWithTimeout(adminAPI.getUsers({ limit: 50 })),
          fetchWithTimeout(adminAPI.getOrders({ limit: 50 })),
          fetchWithTimeout(adminAPI.getProducts({ limit: 50 }))
        ]);
        
        // Extract data from settled promises
        const payments = paymentsData.status === 'fulfilled' ? 
          (paymentsData.value?.payments || paymentsData.value?.data || []) : [];
        const users = usersData.status === 'fulfilled' ? 
          (usersData.value?.users || usersData.value?.data || []) : [];
        const orders = ordersData.status === 'fulfilled' ? 
          (ordersData.value?.orders || ordersData.value?.data || []) : [];
        const products = productsData.status === 'fulfilled' ? 
          (productsData.value?.products || productsData.value?.data || []) : [];
        
        toast.dismiss();
        
        const failedRequests = [paymentsData, usersData, ordersData, productsData]
          .filter(result => result.status === 'rejected').length;
        
        if (failedRequests < 4) {
          toast.success(`${reportType} generated successfully from available data!`);
        } else {
          toast.success(`${reportType} generated with sample data (backend slow)!`);
        }
        
        // Create a new report entry with real data
        const newReport = {
          id: Date.now(),
          name: `${reportType} - ${new Date().toLocaleDateString()}`,
          generated: new Date().toLocaleString(),
          period: selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1),
          format: 'PDF',
          status: 'Ready',
          data: {
            source: failedRequests < 4 ? 'Real Platform Data' : 'Sample Data (Backend Slow)',
            payments: payments.length,
            users: users.length,
            orders: orders.length,
            products: products.length,
            dataQuality: failedRequests === 0 ? 'Complete' : 
                        failedRequests < 2 ? 'Good' : 
                        failedRequests < 4 ? 'Partial' : 'Sample'
          }
        };
        
        setRecentReports(prev => [newReport, ...prev]);
        
        // Update stats without refetching all reports
        setRealTimeStats(prevStats => ({
          ...prevStats,
          reportsGenerated: prevStats.reportsGenerated + 1,
          lastReportTime: 'Just now',
          lastReportType: reportType
        }));
      } catch (dataError) {
        toast.dismiss();
        console.error('Error generating report from real data:', dataError);
        
        // Generate with sample data as fallback
        const sampleReport = {
          id: Date.now(),
          name: `${reportType} - ${new Date().toLocaleDateString()}`,
          generated: new Date().toLocaleString(),
          period: selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1),
          format: 'PDF',
          status: 'Ready',
          data: {
            source: 'Sample Data (Backend Unavailable)',
            message: 'Generated with sample data due to backend timeout',
            dataQuality: 'Sample'
          }
        };
        
        setRecentReports(prev => [sampleReport, ...prev]);
        toast.success(`${reportType} generated with sample data (backend unavailable)`);
      }
    } catch (error) {
      toast.dismiss();
      const errorMessage = error.message || 'Failed to generate report';
      console.error('Error generating report:', error);
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleExport = (format) => {
    toast.success(`Exporting report as ${format.toUpperCase()}...`);
  };

  const generateSimplePDF = (reportData) => {
    try {
      console.log('🔄 Starting PDF generation...');
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      let yPosition = 30;
      
      // Helper function to add new page if needed
      const checkNewPage = () => {
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = 30;
        }
      };
      
      // Header
      doc.setFontSize(24);
      doc.setTextColor(0, 0, 0);
      doc.text('FastShop Business Report', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 20;
      
      // Report Title
      doc.setFontSize(16);
      doc.setTextColor(255, 153, 0);
      doc.text(reportData.name || 'Business Report', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;
      
      // Report Info
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${reportData.generated || new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;
      doc.text(`Period: ${reportData.period || 'Current'}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 20;
      
      // Data Section
      if (reportData.data) {
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text('Report Data', margin, yPosition);
        yPosition += 15;
        
        doc.setFontSize(11);
        Object.entries(reportData.data).forEach(([key, value]) => {
          checkNewPage();
          
          const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          let formattedValue = value;
          
          if (Array.isArray(value)) {
            // Handle arrays (like topProducts)
            doc.text(`${formattedKey}:`, margin, yPosition);
            yPosition += 10;
            value.slice(0, 5).forEach((item, index) => {
              checkNewPage();
              if (typeof item === 'object') {
                doc.text(`  ${index + 1}. ${item.name || item.method || 'Item'}: ${item.sales || item.count || item.revenue || 'N/A'}`, margin + 10, yPosition);
              } else {
                doc.text(`  ${index + 1}. ${item}`, margin + 10, yPosition);
              }
              yPosition += 8;
            });
          } else if (typeof value === 'object' && value !== null) {
            doc.text(`${formattedKey}: ${JSON.stringify(value).substring(0, 50)}...`, margin, yPosition);
            yPosition += 10;
          } else {
            // Format currency values
            if (key.includes('Revenue') || key.includes('commission') || key.includes('refunds')) {
              formattedValue = `$${value}`;
            } else if (key.includes('Rate') || key.includes('percentage')) {
              formattedValue = `${value}%`;
            }
            
            doc.text(`${formattedKey}: ${formattedValue}`, margin, yPosition);
            yPosition += 10;
          }
        });
      }
      
      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(
          `Page ${i} of ${pageCount} | FastShop Admin Panel | ${new Date().toLocaleDateString()}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }
      
      // Save the PDF
      const fileName = `${(reportData.name || 'Report').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
      console.log('💾 Saving PDF:', fileName);
      
      doc.save(fileName);
      
      console.log('✅ PDF generated successfully!');
      toast.success(`PDF report "${fileName}" downloaded successfully!`);
      
      return true;
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      toast.error(`Failed to generate PDF: ${error.message}`);
      return false;
    }
  };
  const testPDFGeneration = () => {
    try {
      console.log('🧪 Testing PDF generation...');
      toast.loading('Testing PDF generation...');
      
      const doc = new jsPDF();
      
      // Simple test content
      doc.setFontSize(20);
      doc.text('FastShop PDF Test', 20, 30);
      
      doc.setFontSize(12);
      doc.text('This is a test PDF to verify functionality.', 20, 50);
      doc.text(`Generated at: ${new Date().toLocaleString()}`, 20, 70);
      doc.text('If you can see this, PDF generation is working!', 20, 90);
      
      // Test autoTable functionality
      const testData = [
        ['Test Item 1', 'Value 1'],
        ['Test Item 2', 'Value 2'],
        ['Test Item 3', 'Value 3']
      ];

      doc.autoTable({
        startY: 110,
        head: [['Item', 'Value']],
        body: testData,
        theme: 'grid',
        headStyles: { fillColor: [255, 153, 0] }
      });
      
      // Save with timestamp to avoid conflicts
      const fileName = `FastShop_PDF_Test_${Date.now()}.pdf`;
      doc.save(fileName);
      
      toast.dismiss();
      console.log('✅ PDF test successful!');
      toast.success(`PDF test successful! File: ${fileName}`);
      
      return true;
    } catch (error) {
      toast.dismiss();
      console.error('❌ PDF test failed:', error);
      toast.error(`PDF test failed: ${error.message}`);
      return false;
    }
  };

  const generateTestPDF = () => {
    try {
      console.log('🧪 Testing basic PDF generation...');
      
      const doc = new jsPDF();
      
      // Simple test content
      doc.setFontSize(20);
      doc.text('FastShop Test Report', 20, 30);
      
      doc.setFontSize(12);
      doc.text('This is a test PDF to verify functionality.', 20, 50);
      doc.text(`Generated at: ${new Date().toLocaleString()}`, 20, 70);
      doc.text('If you can see this, PDF generation is working!', 20, 90);
      
      // Save with timestamp to avoid conflicts
      const fileName = `FastShop_Test_${Date.now()}.pdf`;
      doc.save(fileName);
      
      console.log('✅ Test PDF generated successfully!');
      toast.success(`Test PDF "${fileName}" downloaded successfully!`);
      
      return true;
    } catch (error) {
      console.error('❌ Test PDF failed:', error);
      toast.error(`Test PDF failed: ${error.message}`);
      return false;
    }
  };

  const generatePDFReport = (report) => {
    console.log('📄 Generating PDF for report:', report.name);
    
    // Try simple PDF generation
    const success = generateSimplePDF(report);
    
    if (!success) {
      console.log('🧪 Falling back to test PDF...');
      generateTestPDF();
    }
  };

  const generateComprehensivePDF = async () => {
      try {
        console.log('🔄 Starting comprehensive PDF generation...');
        toast.loading('Generating comprehensive PDF report...');

        // Fetch real data with timeout protection
        const fetchWithTimeout = (promise, timeout = 8000) => {
          return Promise.race([
            promise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
          ]);
        };

        let payments = [];
        let users = [];
        let orders = [];
        let products = [];

        try {
          const [paymentsData, usersData, ordersData, productsData] = await Promise.allSettled([
            fetchWithTimeout(adminAPI.getStripePayments({ dateRange: selectedPeriod, limit: 100 })),
            fetchWithTimeout(adminAPI.getUsers({ limit: 100 })),
            fetchWithTimeout(adminAPI.getOrders({ limit: 100 })),
            fetchWithTimeout(adminAPI.getProducts({ limit: 100 }))
          ]);

          payments = paymentsData.status === 'fulfilled' ? 
            (paymentsData.value?.payments || paymentsData.value?.data || []) : [];
          users = usersData.status === 'fulfilled' ? 
            (usersData.value?.users || usersData.value?.data || []) : [];
          orders = ordersData.status === 'fulfilled' ? 
            (ordersData.value?.orders || ordersData.value?.data || []) : [];
          products = productsData.status === 'fulfilled' ? 
            (productsData.value?.products || productsData.value?.data || []) : [];

          console.log('📊 Real data retrieved:', {
            payments: payments.length,
            users: users.length,
            orders: orders.length,
            products: products.length
          });
        } catch (dataError) {
          console.log('⚠️ Using sample data due to backend issues');
          // Use sample data if backend is unavailable
          payments = generateSamplePayments();
          users = generateSampleUsers();
          orders = generateSampleOrders();
          products = generateSampleProducts();
        }

        // Calculate comprehensive metrics
        const totalRevenue = payments.reduce((sum, p) => sum + ((p.amount || 0) / 100), 0);
        const commission = totalRevenue * 0.15;
        const netRevenue = totalRevenue - commission;
        const activeUsers = users.filter(u => u.status === 'active' || !u.status).length;
        const completedOrders = orders.filter(o => ['delivered', 'completed'].includes(o.status)).length;
        const completionRate = orders.length > 0 ? (completedOrders / orders.length * 100).toFixed(1) : 0;

        // Create PDF
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;
        let yPos = 30;

        // Helper function for new page
        const checkNewPage = () => {
          if (yPos > pageHeight - 40) {
            doc.addPage();
            yPos = 30;
          }
        };

        // Title Page
        doc.setFontSize(28);
        doc.setTextColor(0, 0, 0);
        doc.text('FastShop', pageWidth / 2, 80, { align: 'center' });

        doc.setFontSize(20);
        doc.setTextColor(255, 153, 0);
        doc.text('Comprehensive Business Report', pageWidth / 2, 110, { align: 'center' });

        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 140, { align: 'center' });
        doc.text(`Period: ${selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}`, pageWidth / 2, 155, { align: 'center' });
        doc.text(`Data Source: ${payments.length > 0 ? 'Real Platform Data' : 'Sample Data'}`, pageWidth / 2, 170, { align: 'center' });

        // Executive Summary
        doc.addPage();
        yPos = 30;

        doc.setFontSize(18);
        doc.setTextColor(0, 0, 0);
        doc.text('Executive Summary', margin, yPos);
        yPos += 20;

        doc.setFontSize(12);
        doc.text(`Total Revenue: $${totalRevenue.toLocaleString()}`, margin, yPos);
        yPos += 12;
        doc.text(`Total Users: ${users.length.toLocaleString()}`, margin, yPos);
        yPos += 12;
        doc.text(`Active Users: ${activeUsers.toLocaleString()}`, margin, yPos);
        yPos += 12;
        doc.text(`Total Orders: ${orders.length.toLocaleString()}`, margin, yPos);
        yPos += 12;
        doc.text(`Completed Orders: ${completedOrders.toLocaleString()}`, margin, yPos);
        yPos += 12;
        doc.text(`Order Completion Rate: ${completionRate}%`, margin, yPos);
        yPos += 12;
        doc.text(`Total Products: ${products.length.toLocaleString()}`, margin, yPos);
        yPos += 12;
        doc.text(`Platform Commission: $${commission.toLocaleString()}`, margin, yPos);
        yPos += 12;
        doc.text(`Net Revenue: $${netRevenue.toLocaleString()}`, margin, yPos);

        // Revenue Analysis with Table
        doc.addPage();
        yPos = 30;

        doc.setFontSize(18);
        doc.text('Revenue Analysis', margin, yPos);
        yPos += 20;

        // Use autoTable for revenue breakdown
        const revenueData = [
          ['Total Revenue', `$${totalRevenue.toFixed(2)}`],
          ['Platform Commission (15%)', `$${commission.toFixed(2)}`],
          ['Net Revenue', `$${netRevenue.toFixed(2)}`],
          ['Total Transactions', payments.length.toString()],
          ['Average Transaction', `$${(totalRevenue / Math.max(payments.length, 1)).toFixed(2)}`]
        ];

        doc.autoTable({
          startY: yPos,
          head: [['Metric', 'Value']],
          body: revenueData,
          theme: 'grid',
          headStyles: { fillColor: [255, 153, 0] },
          margin: { left: margin, right: margin }
        });

        // User Analytics
        yPos = doc.lastAutoTable.finalY + 30;
        checkNewPage();

        doc.setFontSize(18);
        doc.text('User Analytics', margin, yPos);
        yPos += 20;

        const userData = [
          ['Total Users', users.length.toString()],
          ['Active Users', activeUsers.toString()],
          ['Customers', users.filter(u => u.role === 'customer' || !u.role).length.toString()],
          ['Sellers', users.filter(u => u.role === 'seller').length.toString()],
          ['User Activity Rate', `${((activeUsers / Math.max(users.length, 1)) * 100).toFixed(1)}%`]
        ];

        doc.autoTable({
          startY: yPos,
          head: [['Metric', 'Value']],
          body: userData,
          theme: 'grid',
          headStyles: { fillColor: [255, 153, 0] },
          margin: { left: margin, right: margin }
        });

        // Order Analytics
        yPos = doc.lastAutoTable.finalY + 30;
        checkNewPage();

        doc.setFontSize(18);
        doc.text('Order Analytics', margin, yPos);
        yPos += 20;

        const pendingOrders = orders.filter(o => ['pending', 'processing', 'shipped'].includes(o.status)).length;
        const cancelledOrders = orders.filter(o => ['cancelled', 'refunded'].includes(o.status)).length;

        const orderData = [
          ['Total Orders', orders.length.toString()],
          ['Completed Orders', completedOrders.toString()],
          ['Pending Orders', pendingOrders.toString()],
          ['Cancelled Orders', cancelledOrders.toString()],
          ['Completion Rate', `${completionRate}%`],
          ['Cancellation Rate', `${(cancelledOrders / Math.max(orders.length, 1) * 100).toFixed(1)}%`]
        ];

        doc.autoTable({
          startY: yPos,
          head: [['Metric', 'Value']],
          body: orderData,
          theme: 'grid',
          headStyles: { fillColor: [255, 153, 0] },
          margin: { left: margin, right: margin }
        });

        // Product Performance
        if (products.length > 0) {
          yPos = doc.lastAutoTable.finalY + 30;
          checkNewPage();

          doc.setFontSize(18);
          doc.text('Product Performance', margin, yPos);
          yPos += 20;

          const productData = [
            ['Total Products', products.length.toString()],
            ['Active Products', products.filter(p => p.status === 'active' || !p.status).length.toString()],
            ['Products with Sales', Math.min(products.length, payments.length).toString()],
            ['Average Sales per Product', (payments.length / Math.max(products.length, 1)).toFixed(1)]
          ];

          doc.autoTable({
            startY: yPos,
            head: [['Metric', 'Value']],
            body: productData,
            theme: 'grid',
            headStyles: { fillColor: [255, 153, 0] },
            margin: { left: margin, right: margin }
          });
        }

        // Footer on all pages
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(
            `Page ${i} of ${pageCount} | FastShop Business Report | ${new Date().toLocaleDateString()}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
          );
        }

        // Save the PDF
        const fileName = `FastShop_Comprehensive_Report_${new Date().toISOString().split('T')[0]}_${Date.now()}.pdf`;
        console.log('💾 Saving comprehensive PDF:', fileName);

        doc.save(fileName);

        toast.dismiss();
        console.log('✅ Comprehensive PDF generated successfully!');
        toast.success(`Comprehensive PDF report "${fileName}" downloaded successfully!`);

      } catch (error) {
        toast.dismiss();
        console.error('❌ Error generating comprehensive PDF:', error);
        toast.error(`Failed to generate comprehensive PDF: ${error.message}`);
      }
    }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={{fontSize: '3em', marginBottom: '20px'}}>⏳</div>
        <div style={styles.spinner}>Loading reports...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px'}}>
        <div>
          <h1 style={styles.title}>📊 Reports & Insights</h1>
          <p style={styles.subtitle}>
            Generate comprehensive business reports from real platform data
          </p>
        </div>
        <div>
          <button
            onClick={generateComprehensivePDF}
            style={{
              background: '#FF9900',
              color: '#FFFFFF',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '1em',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '10px'
            }}
          >
            📄 Generate Full PDF Report
          </button>
          <button
            onClick={() => {
              try {
                console.log('🚀 Quick PDF test starting...');
                const doc = new jsPDF();
                doc.text('FastShop PDF Test - Success!', 20, 20);
                doc.text(`Time: ${new Date().toLocaleString()}`, 20, 40);
                doc.save(`test_${Date.now()}.pdf`);
                toast.success('Quick PDF test successful!');
                console.log('✅ Quick PDF test completed!');
              } catch (error) {
                console.error('❌ Quick PDF test failed:', error);
                toast.error(`Quick test failed: ${error.message}`);
              }
            }}
            style={{
              background: '#17a2b8',
              color: '#FFFFFF',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.8em',
              marginTop: '5px',
              marginRight: '10px'
            }}
          >
            ⚡ Quick Test
          </button>
          <button
            onClick={testPDFGeneration}
            style={{
              background: '#28a745',
              color: '#FFFFFF',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.8em',
              marginTop: '5px'
            }}
          >
            🧪 Full Test
          </button>
        </div>
      </div>

      {error && (
        <div style={{background: '#FEE', border: '1px solid #C7511F', padding: '15px', borderRadius: '8px', marginBottom: '20px', color: '#C7511F'}}>
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} style={{float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2em'}}>×</button>
        </div>
      )}

      {/* Stats Grid */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Reports Generated</div>
          <div style={styles.statValue}>{realTimeStats.reportsGenerated}</div>
          <div style={styles.statChange}>From real data</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Last Report</div>
          <div style={styles.statValue}>{realTimeStats.lastReportTime}</div>
          <div style={styles.statChange}>{realTimeStats.lastReportType}</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Available Reports</div>
          <div style={styles.statValue}>{realTimeStats.scheduledReports}</div>
          <div style={styles.statChange}>Real-time generation</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Export Formats</div>
          <div style={styles.statValue}>3</div>
          <div style={styles.statChange}>PDF, Excel, CSV</div>
        </div>
      </div>

      {/* Report Period Filter */}
      <div style={styles.filterSection}>
        <label style={styles.filterLabel}>Report Period:</label>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          style={styles.select}
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
          <option value="custom">Custom Range</option>
        </select>
      </div>

      {/* Available Reports */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Available Reports</h2>
        <div style={styles.reportsGrid}>
          {reports.map((report, index) => (
            <div key={index} style={styles.reportCard}>
              <div style={styles.reportIcon}>{report.icon}</div>
              <div style={styles.reportTitle}>{report.title}</div>
              <div style={styles.reportDesc}>{report.desc}</div>
              <div style={styles.reportMeta}>
                <span style={styles.reportCategory}>{report.category}</span>
                <span style={styles.reportTime}>{report.time}</span>
              </div>
              <div style={styles.reportActions}>
                <button
                  onClick={() => handleGenerate(report.title)}
                  style={styles.primaryButton}
                >
                  Generate
                </button>
                <button
                  onClick={async () => {
                    toast.loading(`Generating ${report.title} PDF...`);
                    
                    // Fetch fresh data for the specific report
                    try {
                      const [paymentsData, usersData, ordersData, productsData] = await Promise.all([
                        adminAPI.getStripePayments({ dateRange: selectedPeriod }).catch(() => ({ payments: [] })),
                        adminAPI.getUsers({ limit: 1000 }).catch(() => ({ users: [] })),
                        adminAPI.getOrders({ limit: 1000 }).catch(() => ({ orders: [] })),
                        adminAPI.getProducts({ limit: 1000 }).catch(() => ({ products: [] }))
                      ]);
                      
                      // Generate report data
                      const generatedReports = generateReportsFromRealData(
                        paymentsData.payments || paymentsData.data || [],
                        usersData.users || usersData.data || [],
                        ordersData.orders || ordersData.data || [],
                        productsData.products || productsData.data || []
                      );
                      
                      // Find the matching report
                      const matchingReport = generatedReports.find(r => r.name.includes(report.title));
                      
                      toast.dismiss();
                      
                      if (matchingReport) {
                        generatePDFReport(matchingReport);
                      } else {
                        toast.error('No data available for this report type');
                      }
                    } catch (error) {
                      toast.dismiss();
                      console.error('Error generating PDF:', error);
                      toast.error('Failed to generate PDF');
                    }
                  }}
                  style={styles.secondaryButton}
                >
                  PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export Options */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Export Options</h2>
        <div style={styles.exportGrid}>
          <div style={styles.exportCard} onClick={() => generateComprehensivePDF()}>
            <div style={styles.exportIcon}>📄</div>
            <div style={styles.exportTitle}>Comprehensive PDF</div>
            <div style={styles.exportDesc}>Complete business report with all metrics</div>
          </div>
          <div style={styles.exportCard} onClick={async () => {
            toast.loading('Generating Revenue PDF...');
            try {
              const [paymentsData] = await Promise.all([
                adminAPI.getStripePayments({ dateRange: selectedPeriod }).catch(() => ({ payments: [] }))
              ]);
              
              const generatedReports = generateReportsFromRealData(
                paymentsData.payments || paymentsData.data || [],
                [], [], []
              );
              
              const revenueReport = generatedReports.find(r => r.name.includes('Revenue'));
              toast.dismiss();
              
              if (revenueReport) {
                generatePDFReport(revenueReport);
              } else {
                toast.error('No revenue data available');
              }
            } catch (error) {
              toast.dismiss();
              toast.error('Failed to generate revenue PDF');
            }
          }}>
            <div style={styles.exportIcon}>💰</div>
            <div style={styles.exportTitle}>Revenue PDF</div>
            <div style={styles.exportDesc}>Financial performance and revenue analysis</div>
          </div>
          <div style={styles.exportCard} onClick={async () => {
            toast.loading('Generating User Analytics PDF...');
            try {
              const [usersData] = await Promise.all([
                adminAPI.getUsers({ limit: 1000 }).catch(() => ({ users: [] }))
              ]);
              
              const generatedReports = generateReportsFromRealData(
                [], usersData.users || usersData.data || [], [], []
              );
              
              const userReport = generatedReports.find(r => r.name.includes('User Activity'));
              toast.dismiss();
              
              if (userReport) {
                generatePDFReport(userReport);
              } else {
                toast.error('No user data available');
              }
            } catch (error) {
              toast.dismiss();
              toast.error('Failed to generate user analytics PDF');
            }
          }}>
            <div style={styles.exportIcon}>👥</div>
            <div style={styles.exportTitle}>User Analytics PDF</div>
            <div style={styles.exportDesc}>User growth and engagement metrics</div>
          </div>
        </div>
      </div>

      {/* Recent Reports */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Recent Reports</h2>
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Report Name</th>
                <th style={styles.th}>Generated</th>
                <th style={styles.th}>Period</th>
                <th style={styles.th}>Format</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentReports.length > 0 ? (
                recentReports.map((report) => (
                  <tr key={report.id}>
                    <td style={styles.td}>
                      <div>{report.name}</div>
                      {report.data && (
                        <div style={{fontSize: '0.8em', color: '#565959', marginTop: '4px'}}>
                          {report.data.source && `Source: ${report.data.source}`}
                          {report.data.totalRevenue && ` • Revenue: $${report.data.totalRevenue}`}
                          {report.data.totalUsers && ` • Users: ${report.data.totalUsers}`}
                          {report.data.totalOrders && ` • Orders: ${report.data.totalOrders}`}
                        </div>
                      )}
                    </td>
                    <td style={styles.td}>{report.generated}</td>
                    <td style={styles.td}>{report.period}</td>
                    <td style={styles.td}>
                      <span style={styles.formatBadge}>{report.format}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.statusBadge,
                        background: report.status === 'Ready' ? '#D4EDDA' : '#FFF3CD',
                        color: report.status === 'Ready' ? '#155724' : '#856404'
                      }}>
                        {report.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button
                        onClick={() => {
                          if (report.data) {
                            generatePDFReport(report);
                          } else {
                            toast.info('No data available for this report');
                          }
                        }}
                        style={styles.actionButton}
                      >
                        {report.data ? 'Download PDF' : 'View Data'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{...styles.td, textAlign: 'center', color: '#565959', fontStyle: 'italic'}}>
                    No reports generated yet. Click "Generate" on any report type above to create your first report from real platform data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const reports = [
  {
    icon: '💰',
    title: 'Revenue Report',
    desc: 'Detailed revenue breakdown by category, seller, and time period',
    category: 'Financial',
    time: '~2 min'
  },
  {
    icon: '👥',
    title: 'User Activity Report',
    desc: 'User engagement, registration trends, and activity metrics',
    category: 'Analytics',
    time: '~3 min'
  },
  {
    icon: '📦',
    title: 'Product Performance',
    desc: 'Best sellers, inventory levels, and product analytics',
    category: 'Products',
    time: '~2 min'
  },
  {
    icon: '🛍️',
    title: 'Order Analytics',
    desc: 'Order volume, fulfillment rates, and delivery performance',
    category: 'Operations',
    time: '~2 min'
  },
  {
    icon: '🏪',
    title: 'Seller Performance',
    desc: 'Seller rankings, commission data, and performance metrics',
    category: 'Sellers',
    time: '~3 min'
  },
  {
    icon: '📊',
    title: 'Financial Summary',
    desc: 'Complete financial overview including payments and payouts',
    category: 'Financial',
    time: '~4 min'
  },
  {
    icon: '📈',
    title: 'Growth Analytics',
    desc: 'Platform growth trends, user acquisition, and retention',
    category: 'Analytics',
    time: '~3 min'
  },
  {
    icon: '💳',
    title: 'Payment Report',
    desc: 'Payment methods, transaction success rates, and refunds',
    category: 'Financial',
    time: '~2 min'
  }
];

const recentReports = [];

const styles = {
  container: {
    padding: '30px'
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px'
  },
  spinner: {
    fontSize: '1.2em',
    color: '#565959'
  },
  title: {
    fontSize: '2.2em',
    marginBottom: '10px',
    color: '#0F1111'
  },
  subtitle: {
    color: '#565959',
    marginBottom: '30px',
    fontSize: '1.05em'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
  },
  statCard: {
    background: '#FFFFFF',
    padding: '25px',
    borderRadius: '8px',
    border: '1px solid #D5D9D9'
  },
  statLabel: {
    fontSize: '0.9em',
    color: '#565959',
    marginBottom: '10px'
  },
  statValue: {
    fontSize: '2em',
    fontWeight: 'bold',
    color: '#FF9900'
  },
  statChange: {
    fontSize: '0.9em',
    color: '#067D62',
    marginTop: '8px'
  },
  filterSection: {
    background: '#FFFFFF',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #D5D9D9',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '15px'
  },
  filterLabel: {
    fontWeight: 600,
    color: '#0F1111'
  },
  select: {
    padding: '10px',
    border: '1px solid #D5D9D9',
    borderRadius: '4px',
    fontSize: '1em',
    background: '#FFFFFF',
    minWidth: '200px'
  },
  section: {
    background: '#FFFFFF',
    padding: '25px',
    borderRadius: '8px',
    border: '1px solid #D5D9D9',
    marginBottom: '20px'
  },
  sectionTitle: {
    fontSize: '1.4em',
    fontWeight: 600,
    marginBottom: '20px',
    color: '#0F1111'
  },
  reportsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px'
  },
  reportCard: {
    padding: '20px',
    border: '2px solid #D5D9D9',
    borderRadius: '12px',
    transition: 'all 0.3s',
    cursor: 'pointer'
  },
  reportIcon: {
    fontSize: '2.5em',
    marginBottom: '10px'
  },
  reportTitle: {
    fontSize: '1.2em',
    fontWeight: 600,
    marginBottom: '8px',
    color: '#0F1111'
  },
  reportDesc: {
    color: '#565959',
    fontSize: '0.9em',
    marginBottom: '12px',
    lineHeight: '1.5'
  },
  reportMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '15px'
  },
  reportCategory: {
    fontSize: '0.85em',
    padding: '4px 10px',
    background: '#E3F2FD',
    color: '#1565C0',
    borderRadius: '4px',
    fontWeight: 600
  },
  reportTime: {
    fontSize: '0.85em',
    color: '#565959'
  },
  reportActions: {
    display: 'flex',
    gap: '10px'
  },
  primaryButton: {
    background: '#FF9900',
    color: '#FFFFFF',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '0.9em',
    flex: 1
  },
  secondaryButton: {
    padding: '10px 20px',
    border: '1px solid #D5D9D9',
    background: '#FFFFFF',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9em',
    flex: 1,
    color: '#0F1111'
  },
  exportGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px'
  },
  exportCard: {
    padding: '25px',
    border: '2px solid #D5D9D9',
    borderRadius: '12px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s'
  },
  exportIcon: {
    fontSize: '3em',
    marginBottom: '10px'
  },
  exportTitle: {
    fontSize: '1.1em',
    fontWeight: 600,
    marginBottom: '8px',
    color: '#0F1111'
  },
  exportDesc: {
    fontSize: '0.85em',
    color: '#565959'
  },
  tableContainer: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    background: '#F7F8F8',
    padding: '12px',
    textAlign: 'left',
    fontWeight: 600,
    color: '#0F1111'
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid #D5D9D9',
    color: '#0F1111'
  },
  formatBadge: {
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '0.85em',
    background: '#FFF3CD',
    color: '#856404',
    fontWeight: 600
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '0.85em',
    fontWeight: 600
  },
  actionButton: {
    padding: '6px 14px',
    border: '1px solid #D5D9D9',
    background: '#FFFFFF',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9em',
    color: '#0F1111'
  }
};

export default AdminReportsPage;
