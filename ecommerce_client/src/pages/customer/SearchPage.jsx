import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { customerAPI } from '../../services/api.service'
import StartChatButton from '../../components/chat/StartChatButton'

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const query = searchParams.get('q') || ''
  const categoryParam = searchParams.get('category') || ''
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('featured')

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState(categoryParam)
  const [priceRange, setPriceRange] = useState({ min: '', max: '' })
  const [selectedPricePreset, setSelectedPricePreset] = useState('')
  const [minRating, setMinRating] = useState(0)

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await customerAPI.getCategories()
        const cats = response?.data || response || []
        setCategories(Array.isArray(cats) ? cats : [])
      } catch (err) {
        console.error('Failed to load categories:', err)
      }
    }
    fetchCategories()
  }, [])

  // Re-search when query, sort, or filters change
  useEffect(() => {
    if (query || selectedCategory) {
      searchProducts()
    } else {
      setLoading(false)
      setProducts([])
    }
  }, [query, sortBy, selectedCategory, selectedPricePreset, minRating])

  // Sync category from URL param
  useEffect(() => {
    setSelectedCategory(categoryParam)
  }, [categoryParam])

  const searchProducts = async () => {
    setLoading(true)
    try {
      const params = {
        sort: sortBy,
        limit: 50
      }
      if (query) params.q = query

      if (selectedCategory) {
        params.category = selectedCategory
      }

      let minPrice, maxPrice
      if (selectedPricePreset) {
        const [pMin, pMax] = selectedPricePreset.split('-')
        minPrice = pMin !== '' ? pMin : undefined
        maxPrice = pMax !== '' ? pMax : undefined
      } else {
        minPrice = priceRange.min !== '' ? priceRange.min : undefined
        maxPrice = priceRange.max !== '' ? priceRange.max : undefined
      }
      if (minPrice !== undefined) params.minPrice = minPrice
      if (maxPrice !== undefined) params.maxPrice = maxPrice

      if (minRating > 0) {
        params.minRating = minRating
      }

      console.log('🔍 Searching with params:', params)

      const response = await customerAPI.searchProducts(params)
      const productList = Array.isArray(response) ? response : response?.products || []
      setProducts(productList)
    } catch (error) {
      console.error('❌ Failed to search products:', error)
      toast.error('Failed to search products')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const handleProductClick = (productId) => {
    navigate(`/product/${productId}`)
  }

  const renderStars = (rating) => {
    const fullStars = Math.floor(rating || 0)
    const emptyStars = 5 - fullStars
    return '★'.repeat(fullStars) + '☆'.repeat(emptyStars)
  }

  return (
    <div className="max-w-7xl mx-auto p-5">
      <div className="flex gap-5">
        {/* Sidebar - always visible, never replaced by skeleton */}
        <aside className="w-64 flex-shrink-0">
          {/* Department / Category Filter */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-bold mb-4">Department</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="category"
                  checked={!selectedCategory}
                  onChange={() => setSelectedCategory('')}
                  className="cursor-pointer"
                />
                <span className="text-sm font-medium">All Departments</span>
              </label>
              {categories.map((cat) => (
                <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="category"
                    checked={selectedCategory === cat.name || selectedCategory === cat.slug || selectedCategory === cat.id}
                    onChange={() => setSelectedCategory(cat.name)}
                    className="cursor-pointer"
                  />
                  <span className="text-sm">{cat.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Price Filter */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-bold mb-4">Price</h3>
            <div className="space-y-2">
              {[
                { label: 'Under $25', value: '0-25' },
                { label: '$25 to $50', value: '25-50' },
                { label: '$50 to $100', value: '50-100' },
                { label: '$100 to $200', value: '100-200' },
                { label: '$200 & Above', value: '200-' }
              ].map((preset) => (
                <label key={preset.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="price"
                    checked={selectedPricePreset === preset.value}
                    onChange={() => {
                      setSelectedPricePreset(preset.value)
                      setPriceRange({ min: '', max: '' })
                    }}
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
            {/* Custom price range */}
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={priceRange.min}
                onChange={(e) => {
                  setPriceRange(prev => ({ ...prev, min: e.target.value }))
                  setSelectedPricePreset('')
                }}
                className="w-20 text-sm border border-gray-300 rounded px-2 py-1"
                min="0"
              />
              <span className="text-gray-400">-</span>
              <input
                type="number"
                placeholder="Max"
                value={priceRange.max}
                onChange={(e) => {
                  setPriceRange(prev => ({ ...prev, max: e.target.value }))
                  setSelectedPricePreset('')
                }}
                className="w-20 text-sm border border-gray-300 rounded px-2 py-1"
                min="0"
              />
              <button
                onClick={searchProducts}
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
          {(selectedCategory || selectedPricePreset || priceRange.min || priceRange.max || minRating > 0) && (
            <button
              onClick={() => {
                setSelectedCategory('')
                setSelectedPricePreset('')
                setPriceRange({ min: '', max: '' })
                setMinRating(0)
              }}
              className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              Clear All Filters
            </button>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div className="mb-5">
            <h1 className="text-3xl font-bold mb-3">
              {query
                ? selectedCategory
                  ? `Results for "${query}" in ${selectedCategory}`
                  : `Results for "${query}"`
                : selectedCategory
                  ? `Browsing ${selectedCategory}`
                  : 'Search Products'}
            </h1>
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-orange-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 22 6.373 22 12h-4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Searching...
                  </span>
                ) : products.length > 0 ? `1-${products.length} of ${products.length} results` : 'No results'}
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
          </div>

          {query && (
            <div className="bg-gray-100 p-4 rounded-lg mb-5">
              <h3 className="text-sm font-semibold mb-2">Related searches:</h3>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => navigate(`/search?q=${encodeURIComponent(query + ' wireless')}`)}
                  className="bg-white border border-gray-300 px-3 py-1 rounded-full text-sm hover:bg-orange-400 hover:text-white hover:border-orange-400"
                >
                  {query} wireless
                </button>
                <button 
                  onClick={() => navigate(`/search?q=${encodeURIComponent(query + ' premium')}`)}
                  className="bg-white border border-gray-300 px-3 py-1 rounded-full text-sm hover:bg-orange-400 hover:text-white hover:border-orange-400"
                >
                  {query} premium
                </button>
                <button 
                  onClick={() => navigate(`/search?q=${encodeURIComponent(query + ' best')}`)}
                  className="bg-white border border-gray-300 px-3 py-1 rounded-full text-sm hover:bg-orange-400 hover:text-white hover:border-orange-400"
                >
                  best {query}
                </button>
              </div>
            </div>
          )}

          {loading && (
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
          )}

          {!loading && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all"
                  >
                    <div
                      className="cursor-pointer"
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

                    {/* Chat Button */}
                    {product.seller_id && (
                      <div className="mt-3 pt-3 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
                        <StartChatButton
                          recipientId={product.seller_id}
                          recipientName={product.seller_name || 'Seller'}
                          recipientRole="seller"
                          metadata={{
                            type: 'product_inquiry',
                            productId: product.id,
                            productName: product.title || product.name,
                            source: 'search_results'
                          }}
                          className="w-full text-sm px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                        >
                          Chat with Seller
                        </StartChatButton>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {products.length === 0 && (query || selectedCategory) && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔍</div>
                  <h3 className="text-xl font-semibold mb-2">
                    {query
                      ? `No results found for "${query}"${selectedCategory ? ` in ${selectedCategory}` : ''}`
                      : `No products in ${selectedCategory}`}
                  </h3>
                  <p className="text-gray-600 mb-4">Try different keywords or select a different category</p>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Suggestions:</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        onClick={() => navigate('/search?q=electronics')}
                        className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm hover:bg-blue-200"
                      >
                        Electronics
                      </button>
                      <button
                        onClick={() => navigate('/search?q=fashion')}
                        className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm hover:bg-blue-200"
                      >
                        Fashion
                      </button>
                      <button
                        onClick={() => navigate('/search?q=home')}
                        className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm hover:bg-blue-200"
                      >
                        Home & Garden
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/')}
                    className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Browse All Products
                  </button>
                </div>
              )}

              {!query && !selectedCategory && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔍</div>
                  <h3 className="text-xl font-semibold mb-2">Start Your Search</h3>
                  <p className="text-gray-600">Enter a search term or select a category from the sidebar</p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default SearchPage
