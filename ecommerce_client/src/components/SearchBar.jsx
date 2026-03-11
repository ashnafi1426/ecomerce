import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerAPI } from '../services/api.service';

const getCategoryEmoji = (name) => {
  const lower = (name || '').toLowerCase();
  if (lower.includes('electronics') || lower.includes('tech')) return '📱';
  if (lower.includes('fashion') || lower.includes('clothing')) return '👗';
  if (lower.includes('home') || lower.includes('kitchen') || lower.includes('garden')) return '🏠';
  if (lower.includes('sports') || lower.includes('fitness')) return '⚽';
  if (lower.includes('books')) return '📚';
  if (lower.includes('toys') || lower.includes('games')) return '🧸';
  if (lower.includes('beauty') || lower.includes('health')) return '💄';
  if (lower.includes('automotive') || lower.includes('car')) return '🚗';
  if (lower.includes('gold') || lower.includes('jewel')) return '💍';
  return '📦';
};

const SUGGESTION_ICONS = { product: '🛍️', category: '📂', suggestion: '🔍' };

const SearchBar = ({ onSearch, placeholder = "Search FastShop..." }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const navigate = useNavigate();
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  const defaultAll = { id: 'all', name: 'All Categories', icon: '🔍' };
  const [categories, setCategories] = useState([defaultAll]);
  const [selectedCategory, setSelectedCategory] = useState(defaultAll);

  // Fetch real categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await customerAPI.getCategories();
        const cats = response?.data || response || [];
        const apiCats = (Array.isArray(cats) ? cats : []).map(c => ({
          id: c.slug || c.name,
          name: c.name,
          icon: getCategoryEmoji(c.name)
        }));
        setCategories([defaultAll, ...apiCats]);
      } catch (err) {
        setCategories([
          defaultAll,
          { id: 'electronics', name: 'Electronics', icon: '📱' },
          { id: 'fashion', name: 'Fashion', icon: '👗' },
          { id: 'home', name: 'Home & Kitchen', icon: '🏠' },
          { id: 'sports', name: 'Sports & Fitness', icon: '⚽' },
          { id: 'books', name: 'Books', icon: '📚' },
        ]);
      }
    };
    fetchCategories();
  }, []);

  // Debounced autocomplete fetch
  const fetchSuggestions = useCallback((query) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        setLoadingSuggestions(true);
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
        const res = await fetch(`${apiBase}/products/autocomplete?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions || []);
          setShowSuggestions((data.suggestions || []).length > 0);
          setActiveSuggestion(-1);
        }
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 250);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    fetchSuggestions(val);
  };

  const executeSearch = (query) => {
    const q = (query || searchQuery).trim();
    if (!q) return;
    setShowSuggestions(false);
    setSuggestions([]);
    const searchParams = { query: q, category: selectedCategory.id !== 'all' ? selectedCategory.id : undefined };
    if (onSearch) {
      onSearch(searchParams);
    } else {
      const params = new URLSearchParams();
      params.set('q', q);
      if (searchParams.category) params.set('category', searchParams.category);
      navigate(`/search?${params.toString()}`);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    executeSearch();
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion.text);
    if (suggestion.type === 'category') {
      navigate(`/category/${encodeURIComponent(suggestion.text.toLowerCase())}`);
    } else {
      executeSearch(suggestion.text);
    }
    setShowSuggestions(false);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && activeSuggestion >= 0) {
      e.preventDefault();
      handleSuggestionClick(suggestions[activeSuggestion]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveSuggestion(-1);
    }
  };

  const handleQuickSearch = (query) => {
    setSearchQuery(query);
    setShowSuggestions(false);
    const searchParams = { query, category: undefined };
    if (onSearch) {
      onSearch(searchParams);
    } else {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  const popularSearches = [
    'iPhone', 'Laptop', 'Headphones', 'Nike Shoes', 'Samsung TV',
    'Coffee Maker', 'Bluetooth Speaker', 'Gaming Chair'
  ];

  return (
    <>
      {/* Amazon-style CSS */}
      <style>{`
        .amazon-search-container {
          position: relative;
          width: 100%;
          max-width: 100%;
          flex: 1;
          margin: 0 16px;
        }
        
        .amazon-search-form {
          display: flex;
          background: white;
          border-radius: 4px;
          overflow: hidden;
          box-shadow: 0 2px 5px rgba(15,17,17,.15);
          border: 1px solid #cdcdcd;
          transition: all 0.15s ease;
          width: 100%;
        }
        
        .amazon-search-form:focus-within {
          border-color: #ff9900;
          box-shadow: 0 0 0 3px rgba(255,153,0,0.2), 0 2px 5px rgba(15,17,17,.15);
        }
        
        .amazon-category-dropdown {
          position: relative;
          background: #f3f3f3;
          border-right: 1px solid #cdcdcd;
          min-width: 60px;
          flex-shrink: 0;
        }
        
        .amazon-category-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          background: #f3f3f3;
          border: none;
          cursor: pointer;
          font-size: 12px;
          color: #0f1111;
          height: 40px;
          transition: background-color 0.15s ease;
          white-space: nowrap;
          min-width: 60px;
          width: 100%;
        }
        
        .amazon-category-btn:hover {
          background: #e3e6e6;
        }
        
        .amazon-search-input {
          flex: 1;
          border: none;
          outline: none;
          padding: 8px 12px;
          font-size: 16px;
          color: #0f1111;
          background: white;
          height: 40px;
          min-width: 0;
          width: 100%;
        }
        
        .amazon-search-input::placeholder {
          color: #767676;
          font-size: 14px;
        }
        
        .amazon-search-btn {
          background: #ff9900;
          border: none;
          padding: 8px 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s ease;
          min-width: 50px;
          height: 40px;
          flex-shrink: 0;
        }
        
        .amazon-search-btn:hover {
          background: #fa8900;
        }
        
        .amazon-search-icon {
          width: 20px;
          height: 20px;
          color: #0f1111;
        }
        
        .amazon-dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #cdcdcd;
          border-top: none;
          border-radius: 0 0 4px 4px;
          box-shadow: 0 2px 5px rgba(15,17,17,.15);
          z-index: 1000;
          max-height: 300px;
          overflow-y: auto;
        }
        
        .amazon-dropdown-item {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          border: none;
          background: white;
          width: 100%;
          text-align: left;
          cursor: pointer;
          font-size: 13px;
          color: #0f1111;
          transition: background-color 0.15s ease;
        }
        
        .amazon-dropdown-item:hover,
        .amazon-dropdown-item.active {
          background: #f3f3f3;
        }
        
        .amazon-suggestions {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #cdcdcd;
          border-top: none;
          border-radius: 0 0 4px 4px;
          box-shadow: 0 2px 5px rgba(15,17,17,.15);
          z-index: 1000;
          max-height: 400px;
          overflow-y: auto;
        }
        
        .amazon-suggestion-item {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          border: none;
          background: white;
          width: 100%;
          text-align: left;
          cursor: pointer;
          font-size: 14px;
          color: #0f1111;
          transition: background-color 0.15s ease;
          gap: 8px;
        }
        
        .amazon-suggestion-item:hover,
        .amazon-suggestion-item.active {
          background: #f3f3f3;
        }
        
        .amazon-popular-searches {
          margin-top: 8px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        
        .amazon-popular-label {
          font-size: 12px;
          color: #565959;
          font-weight: 400;
        }
        
        .amazon-popular-link {
          font-size: 12px;
          color: #007185;
          text-decoration: none;
          cursor: pointer;
        }
        
        .amazon-popular-link:hover {
          color: #c7511f;
          text-decoration: underline;
        }
        
        /* Mobile Responsive */
        @media (max-width: 768px) {
          .amazon-search-container {
            margin: 0 8px;
          }
          
          .amazon-category-dropdown {
            min-width: 50px;
          }
          
          .amazon-category-btn {
            padding: 8px 8px;
            min-width: 50px;
          }
          .amazon-category-text {
            display: none;
          }
          .amazon-search-input {
            font-size: 16px; /* Prevent zoom on iOS */
            padding: 8px 10px;
          }
          .amazon-search-btn {
            padding: 8px 12px;
            min-width: 45px;
          }
          .amazon-popular-searches {
            display: none;

          }
        }
        
        @media (max-width: 480px) {
          .amazon-search-container {
            margin: 0 4px;
          }
          
          .amazon-category-btn {
            padding: 8px 6px;
            min-width: 45px;
          }
          
          .amazon-search-input {
            padding: 8px 8px;
          }
          
          .amazon-search-btn {
            padding: 8px 10px;
            min-width: 40px;
          }
          
          .amazon-search-icon {
            width: 18px;
            height: 18px;
          }
        }
        
        /* Tablet */
        @media (min-width: 769px) and (max-width: 1024px) {
          .amazon-search-container {
            margin: 0 12px;
          }
          
          .amazon-category-btn {
            padding: 8px 14px;
            min-width: 80px;
          }
          
          .amazon-search-input {
            padding: 8px 12px;
          }
          
          .amazon-search-btn {
            padding: 8px 14px;
          }
        }
        
        /* Desktop */
        @media (min-width: 1025px) {
          .amazon-search-container {
            margin: 0 20px;
            max-width: 800px;
          }
          
          .amazon-category-btn {
            min-width: 120px;
            padding: 8px 16px;
          }
          
          .amazon-search-btn {
            padding: 8px 20px;
            min-width: 60px;
          }
        }
      `}</style>

      <div className="amazon-search-container">
        {/* Main Search Bar */}
        <form onSubmit={handleSearch} className="relative">
          <div className="amazon-search-form">
            {/* Category Dropdown */}
            <div className="amazon-category-dropdown">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="amazon-category-btn"
              >
                <span className="text-sm">{selectedCategory.icon}</span>
                <span className="amazon-category-text ml-1 hidden sm:inline">
                  {selectedCategory.name === 'All Categories' ? 'All' : selectedCategory.name.split(' ')[0]}
                </span>
                <svg className="w-3 h-3 ml-1 hidden sm:inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Category Dropdown Menu */}
              {isExpanded && (
                <div className="amazon-dropdown-menu">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(category);
                        setIsExpanded(false);
                      }}
                      className={`amazon-dropdown-item ${selectedCategory.id === category.id ? 'active' : ''}`}
                    >
                      <span className="text-sm mr-2">{category.icon}</span>
                      <span>{category.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder={placeholder}
                autoComplete="off"
                className="amazon-search-input"
              />

              {/* Autocomplete Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div ref={suggestionsRef} className="amazon-suggestions">
                  {loadingSuggestions && (
                    <div className="px-3 py-2 text-xs text-gray-500">Loading...</div>
                  )}
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSuggestionClick(s)}
                      className={`amazon-suggestion-item ${i === activeSuggestion ? 'active' : ''}`}
                    >
                      <span className="text-sm">{SUGGESTION_ICONS[s.type] || '🔍'}</span>
                      <span className="flex-1 truncate">{s.text}</span>
                      <span className="text-xs text-gray-500 capitalize">{s.type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Button */}
            <button type="submit" className="amazon-search-btn">
              <svg className="amazon-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </form>

        {/* Popular Searches */}
        <div className="amazon-popular-searches">
          <span className="amazon-popular-label">Popular:</span>
          {popularSearches.slice(0, 6).map((search, index) => (
            <button
              key={index}
              onClick={() => handleQuickSearch(search)}
              className="amazon-popular-link"
            >
              {search}
            </button>
          ))}
        </div>

        {/* Click outside to close dropdowns */}
        {(isExpanded || showSuggestions) && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => { setIsExpanded(false); setShowSuggestions(false); }}
          />
        )}
      </div>
    </>
  );
};

export default SearchBar;