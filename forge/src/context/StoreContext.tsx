import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { FREE_SHIPPING, getProductById, type Product } from '../data/products'

export type CartLine = {
  key: string
  productId: string
  qty: number
  size: string
  color: string
}

export type Toast = { id: number; message: string; tone?: 'ok' | 'warn' }

type Store = {
  cart: CartLine[]
  wishlist: string[]
  recent: string[]
  searchOpen: boolean
  cartOpen: boolean
  mobileOpen: boolean
  toasts: Toast[]
  setSearchOpen: (v: boolean) => void
  setCartOpen: (v: boolean) => void
  setMobileOpen: (v: boolean) => void
  addToCart: (product: Product, opts?: { qty?: number; size?: string; color?: string; open?: boolean }) => void
  updateQty: (key: string, qty: number) => void
  removeFromCart: (key: string) => void
  clearCart: () => void
  toggleWishlist: (id: string) => void
  isWished: (id: string) => boolean
  pushRecent: (q: string) => void
  toast: (message: string, tone?: Toast['tone']) => void
  cartCount: number
  cartSubtotal: number
  shippingLeft: number
  discountCode: string
  discount: number
  applyCode: (code: string) => boolean
}

const StoreContext = createContext<Store | null>(null)
const LS_CART = 'forge.cart'
const LS_WISH = 'forge.wish'
const LS_RECENT = 'forge.recent'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>(() => load(LS_CART, []))
  const [wishlist, setWishlist] = useState<string[]>(() => load(LS_WISH, []))
  const [recent, setRecent] = useState<string[]>(() => load(LS_RECENT, []))
  const [searchOpen, setSearchOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [discountCode, setDiscountCode] = useState('')
  const [discount, setDiscount] = useState(0)

  useEffect(() => localStorage.setItem(LS_CART, JSON.stringify(cart)), [cart])
  useEffect(() => localStorage.setItem(LS_WISH, JSON.stringify(wishlist)), [wishlist])
  useEffect(() => localStorage.setItem(LS_RECENT, JSON.stringify(recent)), [recent])

  const toast = useCallback((message: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, tone }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }, [])

  const addToCart = useCallback(
    (product: Product, opts?: { qty?: number; size?: string; color?: string; open?: boolean }) => {
      const size = opts?.size || product.sizes[0]
      const color = opts?.color || product.colors[0]?.name || 'Default'
      const qty = opts?.qty ?? 1
      const key = `${product.id}|${size}|${color}`
      setCart((prev) => {
        const existing = prev.find((l) => l.key === key)
        if (existing) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l))
        return [...prev, { key, productId: product.id, qty, size, color }]
      })
      toast(`${product.name} added to cart`)
      if (opts?.open !== false) setCartOpen(true)
    },
    [toast],
  )

  const updateQty = useCallback((key: string, qty: number) => {
    setCart((prev) => (qty <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, qty } : l))))
  }, [])

  const removeFromCart = useCallback((key: string) => {
    setCart((prev) => prev.filter((l) => l.key !== key))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
    setDiscount(0)
    setDiscountCode('')
  }, [])

  const toggleWishlist = useCallback(
    (id: string) => {
      setWishlist((prev) => {
        const on = prev.includes(id)
        toast(on ? 'Removed from wishlist' : 'Saved to wishlist')
        return on ? prev.filter((x) => x !== id) : [...prev, id]
      })
    },
    [toast],
  )

  const isWished = useCallback((id: string) => wishlist.includes(id), [wishlist])

  const pushRecent = useCallback((q: string) => {
    const t = q.trim()
    if (!t) return
    setRecent((prev) => [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 6))
  }, [])

  const applyCode = useCallback((code: string) => {
    const c = code.trim().toUpperCase()
    if (c === 'FORGE10') {
      setDiscountCode(c)
      setDiscount(0.1)
      toast('FORGE10 applied — 10% off')
      return true
    }
    if (c === 'VOLT15') {
      setDiscountCode(c)
      setDiscount(0.15)
      toast('VOLT15 applied — 15% off')
      return true
    }
    setDiscount(0)
    setDiscountCode('')
    toast('Code not recognised', 'warn')
    return false
  }, [toast])

  const cartSubtotal = useMemo(
    () =>
      cart.reduce((sum, line) => {
        const p = getProductById(line.productId)
        return sum + (p ? p.price * line.qty : 0)
      }, 0),
    [cart],
  )

  const cartCount = useMemo(() => cart.reduce((n, l) => n + l.qty, 0), [cart])
  const shippingLeft = Math.max(0, FREE_SHIPPING - cartSubtotal)

  const value: Store = {
    cart,
    wishlist,
    recent,
    searchOpen,
    cartOpen,
    mobileOpen,
    toasts,
    setSearchOpen,
    setCartOpen,
    setMobileOpen,
    addToCart,
    updateQty,
    removeFromCart,
    clearCart,
    toggleWishlist,
    isWished,
    pushRecent,
    toast,
    cartCount,
    cartSubtotal,
    shippingLeft,
    discountCode,
    discount,
    applyCode,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
