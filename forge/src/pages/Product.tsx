import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Heart, Minus, Plus, ShieldCheck, Truck } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MagneticButton } from '../components/MagneticButton'
import { ProductGrid } from '../components/ProductGrid'
import { Stars } from '../components/AnimatedSection'
import { Reviews } from '../components/Reviews'
import { faqs, formatPrice, getProduct, relatedProducts } from '../data/products'
import { useStore } from '../context/StoreContext'

export function Product() {
  const { slug = '' } = useParams()
  const product = getProduct(slug)
  const nav = useNavigate()
  const { addToCart, toggleWishlist, isWished } = useStore()

  const [img, setImg] = useState(0)
  const [size, setSize] = useState(product?.sizes[0] ?? '')
  const [color, setColor] = useState(product?.colors[0]?.name ?? '')
  const [qty, setQty] = useState(1)
  const [tab, setTab] = useState<'desc' | 'specs' | 'ship' | 'reviews' | 'faq'>('desc')
  const [zoom, setZoom] = useState(false)

  const related = useMemo(() => (product ? relatedProducts(product) : []), [product])

  useEffect(() => {
    if (!product) return
    setImg(0)
    setSize(product.sizes[0] ?? '')
    setColor(product.colors[0]?.name ?? '')
    setQty(1)
    setTab('desc')
  }, [product])

  if (!product) {
    return (
      <div className="container empty" style={{ paddingTop: 160 }}>
        <h2 className="display">Piece not found</h2>
        <Link to="/shop" className="btn">
          Back to shop
        </Link>
      </div>
    )
  }

  const wished = isWished(product.id)

  const onStage = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--zx', `${((e.clientX - r.left) / r.width) * 100}%`)
    e.currentTarget.style.setProperty('--zy', `${((e.clientY - r.top) / r.height) * 100}%`)
  }

  return (
    <div className="page container">
      <div className="pdp">
        <div className="gallery">
          <div className="thumbs">
            {product.images.map((src, i) => (
              <button key={src} className={i === img ? 'is-on' : ''} onClick={() => setImg(i)}>
                <img src={src} alt="" />
              </button>
            ))}
          </div>
          <div
            className={`stage ${zoom ? 'is-zoom' : ''}`}
            onMouseEnter={() => setZoom(true)}
            onMouseLeave={() => setZoom(false)}
            onMouseMove={onStage}
          >
            <AnimatePresence mode="wait">
              <motion.img
                key={product.images[img]}
                src={product.images[img]}
                alt={product.name}
                initial={{ opacity: 0.4, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              />
            </AnimatePresence>
          </div>
        </div>

        <div>
          <p className="kicker">{product.category} · {product.gender}</p>
          <h1 className="display">{product.name}</h1>
          <Stars value={product.rating} />
          <span style={{ color: 'var(--muted)', marginLeft: 8 }}>({product.reviewCount} reviews)</span>
          <div className="price" style={{ fontSize: 28, marginTop: 12 }}>
            {formatPrice(product.price)}
            {product.compareAt && <s>{formatPrice(product.compareAt)}</s>}
          </div>
          <p className="lead">{product.description}</p>

          <div className="chooser">
            <span>Color · {color}</span>
            <div className="color-row">
              {product.colors.map((c) => (
                <button
                  key={c.name}
                  className={color === c.name ? 'is-on' : ''}
                  style={{ background: c.hex }}
                  aria-label={c.name}
                  onClick={() => setColor(c.name)}
                />
              ))}
            </div>
          </div>
          <div className="chooser">
            <span>Size · {size}</span>
            <div className="size-row">
              {product.sizes.map((s) => (
                <button key={s} className={size === s ? 'is-on' : ''} onClick={() => setSize(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="pdp-actions">
            <div className="qty">
              <button onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label="Decrease quantity">
                <Minus size={14} />
              </button>
              <span>{qty}</span>
              <button onClick={() => setQty((n) => n + 1)} aria-label="Increase quantity">
                <Plus size={14} />
              </button>
            </div>
            <MagneticButton onClick={() => addToCart(product, { qty, size, color })}>Add to cart</MagneticButton>
            <MagneticButton
              variant="ghost"
              onClick={() => {
                addToCart(product, { qty, size, color, open: false })
                nav('/checkout')
              }}
            >
              Buy now
            </MagneticButton>
            <button
              className={`icon-btn ${wished ? 'on' : ''}`}
              aria-label="Wishlist"
              onClick={() => toggleWishlist(product.id)}
              style={{ color: wished ? '#ff4d6d' : undefined }}
            >
              <Heart fill={wished ? 'currentColor' : 'none'} />
            </button>
          </div>

          <p className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
            <Truck size={12} style={{ verticalAlign: -2 }} /> Free shipping over ₹2,499 ·{' '}
            <ShieldCheck size={12} style={{ verticalAlign: -2 }} /> Secure checkout
          </p>

          <div className="tabs">
            {(['desc', 'specs', 'ship', 'reviews', 'faq'] as const).map((t) => (
              <button key={t} className={tab === t ? 'is-on' : ''} onClick={() => setTab(t)}>
                {t === 'desc' ? 'Description' : t === 'specs' ? 'Specs' : t === 'ship' ? 'Shipping' : t === 'reviews' ? 'Reviews' : 'FAQ'}
              </button>
            ))}
          </div>
          {tab === 'desc' && <p>{product.description} Built in small batches. Designed in Mumbai. Tested under load.</p>}
          {tab === 'specs' && (
            <ul>
              {Object.entries(product.specs).map(([k, v]) => (
                <li key={k} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <strong>{k}</strong> — {v}
                </li>
              ))}
            </ul>
          )}
          {tab === 'ship' && (
            <p id="shipping">
              Metro cities 2–4 days. Rest of India 4–7. Orders over ₹2,499 ship free. Easy 14-day returns on unused items with tags. Limited drops are final unless defective.
            </p>
          )}
          {tab === 'reviews' && <Reviews items={product.reviews} />}
          {tab === 'faq' && (
            <div className="faq">
              {faqs.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p style={{ color: 'var(--muted)', marginTop: 8 }}>{f.a}</p>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '40px 0 80px' }}>
        <div className="section__head">
          <h2 className="display">Also in the rack</h2>
        </div>
        <ProductGrid items={related} />
      </div>
    </div>
  )
}
