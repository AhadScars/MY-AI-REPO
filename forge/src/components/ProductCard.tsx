import type { CSSProperties } from 'react'
import { Heart, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatPrice, type Product } from '../data/products'
import { useStore } from '../context/StoreContext'
import { Stars } from './AnimatedSection'

export function ProductCard({ product, style }: { product: Product; style?: CSSProperties }) {
  const { addToCart, toggleWishlist, isWished } = useStore()
  const wished = isWished(product.id)
  const badgeClass = product.badge === 'sale' ? 'sale' : product.badge === 'drop' ? 'drop' : ''

  return (
    <article className="pcard" style={style}>
      <div className="pcard__media">
        <Link to={`/product/${product.slug}`}>
          <img className="main" src={product.images[0]} alt={product.name} loading="lazy" />
          {product.hoverImage && (
            <img className="alt" src={product.hoverImage} alt="" aria-hidden="true" loading="lazy" />
          )}
        </Link>
        {product.badge && <span className={`pcard__badge ${badgeClass}`}>{product.badge}</span>}
        <button
          className={`pcard__wish ${wished ? 'on' : ''}`}
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={() => toggleWishlist(product.id)}
        >
          <Heart size={16} fill={wished ? 'currentColor' : 'none'} />
        </button>
        <button
          className="btn pcard__quick"
          onClick={() => addToCart(product)}
          aria-label={`Quick add ${product.name}`}
        >
          <Plus size={16} /> Quick add
        </button>
      </div>
      <div>
        <Link to={`/product/${product.slug}`}>
          <h3>{product.name}</h3>
        </Link>
        <div className="pcard__meta">
          <div className="price">
            {formatPrice(product.price)}
            {product.compareAt && <s>{formatPrice(product.compareAt)}</s>}
          </div>
          <Stars value={product.rating} />
        </div>
        <div className="swatches" aria-hidden="true">
          {product.colors.map((c) => (
            <i key={c.name} style={{ background: c.hex }} title={c.name} />
          ))}
        </div>
      </div>
    </article>
  )
}
