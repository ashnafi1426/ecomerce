import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart } from '../store/slices/cartSlice';
import { toast } from 'react-hot-toast';

const ProductGrid = ({ products = [], title = "Products", showFilters = false }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const [sortBy, setSortBy] = useState('featured');
  const [priceRange, setPriceRange] = useState('all');

  const handleProductClick = (productId) => {
    navigate(`/product/${productId}`);
  };

  const handleAddToCart = (e, product) => {
    e.stopPropagation();
    
    // Redirect unauthenticated users to login
    if (!isAuthenticated) {
      toast('Please sign in to add items to cart', { icon: '🔒', duration: 3000 });
      navigate('/login');
      return;
    }

    try {
      const cartItem = {
        id: product.id,
        name: product.title || product.name,
        price: product.price,
        image: product.image_url || product.image,
        quantity: 1,
        price_at_add: product.price
      };
      
      dispatch(addToCart(cartItem));
      toast.success('✓ Added to cart!', {
        duration: 2000,
        style: {
          background: '#067D62',
          color: '#fff',
        }
      });
    } catch (err) {
      console.error('Error adding to cart:', err);
      toast.error('Failed to add to cart');
    }
  };

  const handleAddToWishlist = (e, product) => {
    e.stopPropagation();
    // Add to wishlist logic here
    console.log('Adding to wishlist:', product);
  };

  const renderStars = (rating) => {
    const fullStars = Math.floor(rating || 0);
    const hasHalfStar = (rating || 0) % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    return (
      <div className="flex items-center gap-1">
        {[...Array(fullStars)].map((_, i) => (
          <span key={i} className="text-yellow-400">★</span>
        ))}
        {hasHalfStar && <span className="text-yellow-400">☆</span>}
        {[...Array(emptyStars)].map((_, i) => (
          <span key={i} className="text-gray-300">☆</span>
        ))}
      </div>
    );
  };

  const calculateDiscount = (price, originalPrice) => {
    if (!originalPrice || originalPrice <= price) return null;
    return Math.round(((originalPrice - price) / originalPrice) * 100);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const sortOptions = [
    { value: 'featured', label: 'Featured' },
    { value: 'price-low', label: 'Price: Low to High' },
    { value: 'price-high', label: 'Price: High to Low' },
    { value: 'rating', label: 'Customer Rating' },
    { value: 'newest', label: 'Newest Arrivals' }
  ];

  const priceRanges = [
    { value: 'all', label: 'All Prices' },
    { value: '0-25', label: 'Under $25' },
    { value: '25-50', label: '$25 - $50' },
    { value: '50-100', label: '$50 - $100' },
    { value: '100-200', label: '$100 - $200' },
    { value: '200+', label: '$200 & Above' }
  ];

  return (
    <div className="w-full">
      {/* ── Product Card Animation System ── */}
      <style>{`
        @keyframes pcReveal {
          from { opacity:0; transform:translateY(22px) scale(0.96); }
          to   { opacity:1; transform:translateY(0)    scale(1);    }
        }
        .pc-card {
          position:relative; background:#fff; border-radius:10px;
          border:1px solid #E3E6E6; overflow:hidden; cursor:pointer;
          transform-style:preserve-3d;
          transition:transform 0.32s cubic-bezier(0.23,1,0.32,1), box-shadow 0.32s ease;
          animation:pcReveal 0.42s cubic-bezier(0.23,1,0.32,1) both;
        }
        .pc-card:nth-child(1)  { animation-delay:0.00s; }
        .pc-card:nth-child(2)  { animation-delay:0.05s; }
        .pc-card:nth-child(3)  { animation-delay:0.10s; }
        .pc-card:nth-child(4)  { animation-delay:0.15s; }
        .pc-card:nth-child(5)  { animation-delay:0.20s; }
        .pc-card:nth-child(6)  { animation-delay:0.25s; }
        .pc-card:nth-child(n+7){ animation-delay:0.28s; }
        .pc-card:hover {
          transform:perspective(900px) translateY(-10px) rotateX(2deg) scale(1.02);
          box-shadow:0 24px 56px rgba(0,0,0,0.20),0 8px 20px rgba(0,0,0,0.12);
          z-index:5;
        }
        .pc-card:active { transform:scale(0.97); transition-duration:0.1s; }
        .pc-img-wrap {
          position:relative; width:100%; aspect-ratio:1;
          background:#f3f4f6; overflow:hidden;
        }
        .pc-img {
          width:100%; height:100%; object-fit:contain; display:block;
          transition:transform 0.52s cubic-bezier(0.23,1,0.32,1);
        }
        .pc-card:hover .pc-img { transform:scale(1.10); }
        .pc-shine {
          position:absolute; inset:0; z-index:2; pointer-events:none;
          background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,0.65) 50%,transparent 62%);
          transform:translateX(-120%);
          transition:transform 0.6s ease;
        }
        .pc-card:hover .pc-shine { transform:translateX(120%); }
        .pc-badge {
          position:absolute; z-index:3;
          padding:3px 7px; border-radius:4px;
          font-size:0.65rem; font-weight:700; line-height:1.5;
        }
        .pc-quick-cart {
          position:absolute; bottom:0; left:0; right:0; z-index:4;
          background:#FFD814; color:#0F1111;
          font-size:0.72rem; font-weight:600;
          padding:8px; border:none; cursor:pointer;
          transform:translateY(100%);
          transition:transform 0.28s cubic-bezier(0.23,1,0.32,1), background 0.18s ease;
        }
        .pc-card:hover .pc-quick-cart { transform:translateY(0); }
        .pc-quick-cart:hover { background:#F7CA00; }
        .pc-wish {
          position:absolute; top:8px; right:8px; z-index:3;
          width:30px; height:30px; border-radius:50%;
          background:rgba(255,255,255,0.9); border:none; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          font-size:0.85rem;
          opacity:0; transform:scale(0.75);
          transition:opacity 0.22s ease, transform 0.22s cubic-bezier(0.23,1,0.32,1);
        }
        .pc-card:hover .pc-wish { opacity:1; transform:scale(1); }
        .pc-wish:hover { transform:scale(1.2) !important; background:#fff !important; }
        .pc-price { transition:color 0.2s ease; }
        .pc-card:hover .pc-price { color:#C45500 !important; }
        .pc-title { transition:color 0.18s ease; }
        .pc-card:hover .pc-title { color:#C7511F; }
        @media (max-width:768px) {
          .pc-card:hover { transform:translateY(-4px) scale(1.01); box-shadow:0 10px 28px rgba(0,0,0,0.14); }
        }
      `}</style>
      {/* Header with Title and Filters */}
      <div className="responsive-flex-col justify-between items-start md:items-center mb-6 responsive-gap">
        <div>
          <h2 className="responsive-heading-lg text-gray-800">{title}</h2>
          <p className="text-gray-600 mt-1 responsive-body-sm">{products.length} products found</p>
        </div>

        {showFilters && (
          <div className="flex flex-col sm:flex-row responsive-gap w-full md:w-auto">
            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="responsive-select"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* Price Range Dropdown */}
            <select
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value)}
              className="responsive-select"
            >
              {priceRanges.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No products found</h3>
          <p className="text-gray-600">Try adjusting your search or filters</p>
        </div>
      ) : (
          <div className="responsive-product-grid">
            {products.map((product) => {
            const discount = calculateDiscount(product.price, product.original_price);
            const rating = product.average_rating || product.rating || 0;
            const reviewCount = product.total_reviews || product.reviews_count || 0;
            return (
              <div
                key={product.id}
                onClick={() => handleProductClick(product.id)}
                className="pc-card"
              >
                {/* Image Zone */}
                <div className="pc-img-wrap">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.title || product.name}
                      className="pc-img"
                      loading="lazy"
                      onError={(e) => { e.target.onerror = null; e.target.style.opacity = '0'; }}
                    />
                  ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-5xl">
                      📦
                    </div>
                  )}
                  {/* Glass shine */}
                  <div className="pc-shine" />
                  {/* Discount badge */}
                  {discount && (
                    <div className="pc-badge bg-[#CC0C39] text-white" style={{ top: '8px', left: '8px' }}>-{discount}%</div>
                  )}
                  {/* Wishlist */}
                  <button className="pc-wish" onClick={(e) => handleAddToWishlist(e, product)} title="Add to wishlist">🤍</button>
                  {/* Quick cart */}
                  <button className="pc-quick-cart" onClick={(e) => handleAddToCart(e, product)}>🛒 Add to Cart</button>
                </div>

                {/* Info */}
                <div className="p-3">
                  <h3 className="pc-title text-sm leading-tight mb-2 line-clamp-2 text-[#0F1111] font-medium">
                    {product.title || product.name}
                  </h3>
                  <div className="flex items-center gap-1 mb-1.5">
                    <span className="text-[#FF9900] text-xs">{renderStars(rating)}</span>
                    <span className="text-xs text-[#007185]">({reviewCount})</span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="pc-price text-sm font-bold text-[#B12704]">{formatPrice(product.price)}</span>
                    {product.original_price && product.original_price > product.price && (
                      <span className="text-xs text-[#565959] line-through">{formatPrice(product.original_price)}</span>
                    )}
                  </div>
                  {(product.seller_name || product.seller?.display_name) && (
                    <p className="text-xs text-[#565959] mb-1">by {product.seller_name || product.seller?.display_name}</p>
                  )}
                  <div className="text-[11px] text-[#067D62] font-medium">✓ FREE Delivery</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More Button */}
      {products.length > 0 && (
        <div className="text-center mt-8">
          <button className="responsive-btn bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors">
            Load More Products
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductGrid;