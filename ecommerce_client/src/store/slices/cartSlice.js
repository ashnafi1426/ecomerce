import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../config/api'

// ---------------------------------------------------------------------------
// Helper: recalculate total from items array
// ---------------------------------------------------------------------------
const calcTotal = (items) =>
  items.reduce((sum, item) => sum + (item.price * item.quantity), 0)

// ---------------------------------------------------------------------------
// Persist cart items to localStorage
// ---------------------------------------------------------------------------
const persistCart = (items) => {
  try {
    localStorage.setItem('cart', JSON.stringify(items))
  } catch (_) { }
}

// ---------------------------------------------------------------------------
// Async Thunks — backend sync for authenticated users
// ---------------------------------------------------------------------------

/**
 * Fetch the user's cart from backend.
 * Backend returns: { items: [{product_id, quantity, price, name, image, variant_id}] }
 */
export const fetchCart = createAsyncThunk('cart/fetchCart', async (_, { rejectWithValue }) => {
  try {
    const data = await api.get('/cart')
    const items = (data.items || []).map((item) => ({
      id: item.product_id,
      variantId: item.variant_id || null,
      name: item.name || item.product?.title || 'Product',
      price: item.price,
      image: item.image || item.product?.images?.[0] || null,
      quantity: item.quantity
    }))
    return items
  } catch (err) {
    return rejectWithValue(err.message)
  }
})

/**
 * Add item to backend cart, then refresh local state.
 */
export const addToCartAsync = createAsyncThunk(
  'cart/addToCartAsync',
  async ({ productId, variantId, quantity = 1 }, { rejectWithValue }) => {
    try {
      await api.post('/cart/items', { product_id: productId, variant_id: variantId, quantity })
      const data = await api.get('/cart')
      const items = (data.items || []).map((item) => ({
        id: item.product_id,
        variantId: item.variant_id || null,
        name: item.name || item.product?.title || 'Product',
        price: item.price,
        image: item.image || item.product?.images?.[0] || null,
        quantity: item.quantity
      }))
      return items
    } catch (err) {
      return rejectWithValue(err.message)
    }
  }
)

/**
 * Remove item from backend cart.
 */
export const removeFromCartAsync = createAsyncThunk(
  'cart/removeFromCartAsync',
  async (productId, { rejectWithValue }) => {
    try {
      await api.delete(`/cart/items/${productId}`)
      return productId
    } catch (err) {
      return rejectWithValue(err.message)
    }
  }
)

/**
 * Update item quantity in backend cart.
 */
export const updateQuantityAsync = createAsyncThunk(
  'cart/updateQuantityAsync',
  async ({ productId, quantity }, { rejectWithValue }) => {
    try {
      await api.put(`/cart/items/${productId}`, { quantity })
      return { productId, quantity }
    } catch (err) {
      return rejectWithValue(err.message)
    }
  }
)

/**
 * Clear entire backend cart.
 */
export const clearCartAsync = createAsyncThunk('cart/clearCartAsync', async (_, { rejectWithValue }) => {
  try {
    await api.delete('/cart')
    return true
  } catch (err) {
    return rejectWithValue(err.message)
  }
})

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------
const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    items: (() => {
      try {
        return JSON.parse(localStorage.getItem('cart')) || []
      } catch (_) {
        return []
      }
    })(),
    total: 0,
    loading: false,
    error: null,
    synced: false
  },
  reducers: {
    // Local-only reducers (used for guest users or offline fallback)
    addToCart: (state, action) => {
      const existingItem = state.items.find(
        (item) =>
          item.id === action.payload.id &&
          item.variantId === (action.payload.variantId || null)
      )
      if (existingItem) {
        existingItem.quantity += action.payload.quantity || 1
      } else {
        state.items.push({ ...action.payload, quantity: action.payload.quantity || 1 })
      }
      state.total = calcTotal(state.items)
      persistCart(state.items)
    },
    removeFromCart: (state, action) => {
      state.items = state.items.filter((item) => item.id !== action.payload)
      state.total = calcTotal(state.items)
      persistCart(state.items)
    },
    updateQuantity: (state, action) => {
      const item = state.items.find((item) => item.id === action.payload.id)
      if (item) {
        item.quantity = action.payload.quantity
      }
      state.total = calcTotal(state.items)
      persistCart(state.items)
    },
    clearCart: (state) => {
      state.items = []
      state.total = 0
      state.synced = false
      localStorage.removeItem('cart')
    },
    recomputeTotal: (state) => {
      state.total = calcTotal(state.items)
    }
  },
  extraReducers: (builder) => {
    // fetchCart
    builder
      .addCase(fetchCart.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCart.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload
        state.total = calcTotal(action.payload)
        state.synced = true
        persistCart(state.items)
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
        state.total = calcTotal(state.items)
      })

    // addToCartAsync
    builder
      .addCase(addToCartAsync.pending, (state) => {
        state.loading = true
      })
      .addCase(addToCartAsync.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload
        state.total = calcTotal(action.payload)
        state.synced = true
        persistCart(state.items)
      })
      .addCase(addToCartAsync.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

    // removeFromCartAsync
    builder
      .addCase(removeFromCartAsync.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.id !== action.payload)
        state.total = calcTotal(state.items)
        persistCart(state.items)
      })
      .addCase(removeFromCartAsync.rejected, (state, action) => {
        state.error = action.payload
      })

    // updateQuantityAsync
    builder
      .addCase(updateQuantityAsync.fulfilled, (state, action) => {
        const item = state.items.find((i) => i.id === action.payload.productId)
        if (item) {
          item.quantity = action.payload.quantity
        }
        state.total = calcTotal(state.items)
        persistCart(state.items)
      })
      .addCase(updateQuantityAsync.rejected, (state, action) => {
        state.error = action.payload
      })

    // clearCartAsync
    builder
      .addCase(clearCartAsync.fulfilled, (state) => {
        state.items = []
        state.total = 0
        state.synced = false
        localStorage.removeItem('cart')
      })
      .addCase(clearCartAsync.rejected, (state, action) => {
        state.error = action.payload
      })
  }
})

export const { addToCart, removeFromCart, updateQuantity, clearCart, recomputeTotal } =
  cartSlice.actions
export default cartSlice.reducer
