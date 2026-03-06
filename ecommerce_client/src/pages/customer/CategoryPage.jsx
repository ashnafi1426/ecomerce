import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { customerAPI } from '../../services/api.service'

const CategoryPage = () => {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [category, setCategory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('featured')
  const [selectedPricePreset, setSelectedPricePreset] = useState('')
  const [priceRange, setPriceRange] = useState({ min: '', max: '' })
  const [minRating, setMinRating] = useState(0)

  useEffect(() => {
    fetchCategoryData()
  }, [categoryId])

  // Re-apply filters when filter state changes
  useEffect(() => {
    if (allProducts.length > 0) {
      applyFilters(allProducts)
    }
  }, [selectedPricePreset, priceRange, minRating, sortBy])

  const fetchCategoryData = async () => {
    try {
      setLoading(true)

      const [categoriesRes, productsRes] = await Promise.all([
        customerAPI.getCategories(),
        customerAPI.getCategoryProducts(categoryId, { limit: 100, sort: 'featured' })
      ])

      // Find category — categoryId may be slug ("electronics") or UUID
      const categoryList = Array.isArray(categoriesRes) ? categoriesRes : categoriesRes?.data || []
      const foundCategory = categoryList.find(
        cat => cat.id === categoryId || cat.slug === categoryId || cat.name?.toLowerCase() === categoryId?.toLowerCase()
      )
      setCategory(foundCategory || productsRes?.category || { id: categoryId, name: categoryId })

      // Backend returns { products: [...] }
      const productList = productsRes?.products || (Array.isArray(productsRes) ? productsRes : [])
      setAllProducts(productList)
      applyFilters(productList)
    } catch (error) {
      console.error('❌ Failed to load category data:', error)
      toast.error('Failed to load category products')
      setCategory({ id: categoryId, name: categoryId })
      setAllProducts([])
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = (source) => {
    let filtered = [...source]

    // Price filter
    let minPrice, maxPrice
    if (selectedPricePreset) {
      const [pMin, pMax] = selectedPricePreset.split('-')
      minPrice = pMin !== '' ? parseFloat(pMin) : undefined
      maxPrice = pMax !== '' ? parseFloat(pMax) : undefined
    } else {
      minPrice = priceRange.min !== '' ? parseFloat(priceRange.min) : undefined
      maxPrice = priceRange.max !== '' ? parseFloat(priceRange.max) : undefined
    }
    if (minPrice !== undefined) filtered = filtered.filter(p => Number(p.price) >= minPrice)
    if (maxPrice !== undefined) filtered = filtered.filter(p => Number(p.price) <= maxPrice)

    // Rating filter
    if (minRating > 0) {
      filtered = filtered.filter(p => (p.average_rating || 0) >= minRating)
    }

    // Sort
    switch (sortBy) {
      case 'price_asc':
        filtered.sort((a, b) => Number(a.price) - Number(b.price))
        break
      case 'price_desc':
        filtered.sort((a, b) => Number(b.price) - Number(a.price))
        break
      case 'rating':
        filtered.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0))
        break
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        break
      default:
        break
    }

    setProducts(filtered)
  }

  const handleProductClick = (productId) => {
    navigate(`/product/${productId}`)
  }

  const renderStars = (rating) => {
    const fullStars = Math.floor(rating || 0)
    const emptyStars = 5 - fullStars
    return '★'.repeat(fullStars) + '☆'.repeat(emptyStars)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-5">
        <div className="bg-gray-100 px-5 py-4 mb-5 text-sm animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-48"></div>
        </div>
        <div className="flex gap-5">
          <aside className="w-64 flex-shrink-0">
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-16 mb-4"></div>
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </aside>
          <main className="flex-1">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-gray-200">
              <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
              <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
                  <div className="w-full h-48 bg-gray-200 rounded mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-5">
      {/* Breadcrumb */}
      <div className="bg-gray-100 px-5 py-4 mb-5 text-sm">
        <button 
          onClick={() => navigate('/')}
          className="text-blue-600 hover:underline"
        >
          Home
        </button>
        <span className="text-gray-600 mx-2">›</span>
        <span className="text-gray-600">{category?.name || 'Category'}</span>
      </div>

      <div className="flex gap-5">
        {/* Sidebar Filters */}
        <aside className="w-64 flex-shrink-0">
          {/* Price Filter */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-bold mb-4">Price</h3>
            <div className="space-y-2 mb-3">
              {[
                { label: 'Under $25', value: '0-25' },
                { label: '$25 to $50', value: '25-50' },
                { label: '$50 to $100', value: '50-100' },
                { label: '$100 to $200', value: '100-200' },
                { label: '$200 & Above', value: '200-' },
              ].map((preset) => (
                <label key={preset.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="price"
                    checked={selectedPricePreset === preset.value}
                    onChange={() => { setSelectedPricePreset(preset.value); setPriceRange({ min: '', max: '' }) }}
                    className="cursor-pointer"
                  />
                  <span className="text-sm">{preset.label}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="price"
                  checked={!selectedPricePreset}
                  onChange={() => setSelectedPricePreset('')}
                  className="cursor-pointer"
                />
                <span className="text-sm">Any Price</span>
              </label>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                placeholder="Min"
                value={priceRange.min}
                onChange={(e) => { setPriceRange(p => ({ ...p, min: e.target.value })); setSelectedPricePreset('') }}
                className="w-20 text-sm border border-gray-300 rounded px-2 py-1"
                min="0"
              />
              <span className="text-gray-400">-</span>
              <input
                type="number"
                placeholder="Max"
                value={priceRange.max}
                onChange={(e) => { setPriceRange(p => ({ ...p, max: e.target.value })); setSelectedPricePreset('') }}
                className="w-20 text-sm border border-gray-300 rounded px-2 py-1"
                min="0"
              />
              <button
                onClick={() => applyFilters(allProducts)}
                className="text-sm bg-orange-400 text-white px-2 py-1 rounded hover:bg-orange-500"
              >
                Go
              </button>
            </div>
          </div>

          {/* Customer Review Filter */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-bold mb-4">Customer Review</h3>
            <div className="space-y-2">
              {[4, 3, 2, 1].map((stars) => (
                <label key={stars} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="rating"
                    checked={minRating === stars}
                    onChange={() => setMinRating(stars)}
                    className="cursor-pointer"
                  />
                  <span className="text-sm text-yellow-500">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
                  <span className="text-sm">& Up</span>
                </label>
              ))}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="rating"
                  checked={minRating === 0}
                  onChange={() => setMinRating(0)}
                  className="cursor-pointer"
                />
                <span className="text-sm">All Ratings</span>
              </label>
            </div>
          </div>

          {/* Clear All Filters */}
          {(selectedPricePreset || priceRange.min || priceRange.max || minRating > 0) && (
            <button
              onClick={() => { setSelectedPricePreset(''); setPriceRange({ min: '', max: '' }); setMinRating(0) }}
              className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              Clear All Filters
            </button>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div className="flex justify-between items-center mb-5 pb-4 border-b border-gray-200">
            <div>
              <h1 className="text-2xl font-bold mb-1">{category?.name || 'Products'}</h1>
              <div className="text-sm text-gray-600">
                {products.length > 0 ? `1-${products.length} of ${products.length} results` : 'No results'}
              </div>
            </div>
            <select
              className="p-2 border border-gray-300 rounded cursor-pointer"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="featured">Featured</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Avg. Customer Review</option>
              <option value="newest">Newest Arrivals</option>
            </select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all cursor-pointer"
                onClick={() => handleProductClick(product.id)}
              >
                <div className="relative">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.title || product.name}
                      className="w-full h-48 object-cover rounded mb-3"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded mb-3 flex items-center justify-center text-6xl">
                      📦
                    </div>
                  )}
                </div>
                <h3 className="text-sm mb-2 h-10 overflow-hidden line-clamp-2">
                  {product.title || product.name}
                </h3>
                <div className="flex items-center gap-1 mb-2 text-sm">
                  <span className="text-yellow-500">
                    {renderStars(product.average_rating || product.rating)}
                  </span>
                  <span className="text-blue-600">
                    ({product.total_reviews || product.reviews_count || 0})
                  </span>
                </div>
                <div className="text-xl font-bold mb-1 text-blue-600">
                  ${Number(product.price).toFixed(2)}
                  {product.original_price && (
                    <span className="text-sm text-gray-500 line-through ml-2">
                      ${Number(product.original_price).toFixed(2)}
                    </span>
                  )}
                </div>
                {product.seller_name && (
                  <p className="text-xs text-gray-500 mt-1">
                    by {product.seller_name}
                  </p>
                )}
              </div>
            ))}
          </div>

          {products.length === 0 && !loading && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📦</div>
              <h3 className="text-xl font-semibold mb-2">No products found</h3>
              <p className="text-gray-600">
                {selectedPricePreset || priceRange.min || priceRange.max || minRating > 0
                  ? 'No products match your filters. Try clearing the filters.'
                  : 'No products available in this category yet. Check back soon!'}
              </p>
              <button
                onClick={() => navigate('/')}
                className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Browse All Products
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default CategoryPage
