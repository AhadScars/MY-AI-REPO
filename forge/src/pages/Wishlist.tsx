import { Link } from 'react-router-dom'
import { ProductGrid } from '../components/ProductGrid'
import { getProductById } from '../data/products'
import { useStore } from '../context/StoreContext'

export function Wishlist() {
  const { wishlist } = useStore()
  const items = wishlist.map(getProductById).filter((p): p is NonNullable<typeof p> => !!p)

  return (
    <div className="page">
      <div className="page-hero">
        <div className="container">
          <p className="kicker">Saved</p>
          <h1 className="display">Wishlist</h1>
        </div>
      </div>
      <div className="container" style={{ padding: '40px 0 80px' }}>
        {items.length === 0 ? (
          <div className="empty">
            <h2 className="display">Nothing saved.</h2>
            <p>Tap the heart on a piece you want to come back for.</p>
            <Link to="/shop" className="btn" style={{ marginTop: 16 }}>
              Browse the rack
            </Link>
          </div>
        ) : (
          <ProductGrid items={items} />
        )}
      </div>
    </div>
  )
}
