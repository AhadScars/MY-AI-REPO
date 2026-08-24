import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ProductFilters, defaultFilters, type FilterState } from '../components/ProductFilters'
import { ProductGrid } from '../components/ProductGrid'
import { categoryMeta, filterProducts } from '../data/products'

export function Shop() {
  const { category = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const q = params.get('q') || ''
  const [filters, setFilters] = useState<FilterState>({
    ...defaultFilters,
    category: category || '',
  })

  useEffect(() => {
    setFilters((f) => ({ ...f, category: category || '' }))
  }, [category])

  const active = { ...filters, category: category || filters.category, q }
  const items = useMemo(() => filterProducts(active), [category, q, filters])

  const title =
    category === 'new'
      ? 'New drops'
      : category === 'sale'
        ? 'Sale'
        : category && category in categoryMeta
          ? categoryMeta[category as keyof typeof categoryMeta].label
          : q
            ? `Results for “${q}”`
            : 'The collection'

  return (
    <div className="page">
      <div className="page-hero">
        <div className="container">
          <p className="kicker">Shop</p>
          <h1 className="display">{title}</h1>
          <p style={{ color: 'var(--muted)' }}>{items.length} pieces · engineered, not decorated</p>
        </div>
      </div>
      <div className="container shop-layout">
        <ProductFilters
          value={{ ...filters, category: category || filters.category }}
          onChange={(next) => {
            setFilters(next)
            const current = category || ''
            if (next.category !== current) {
              navigate(next.category ? `/shop/${next.category}` : '/shop')
            }
          }}
        />
        <div>
          <div className="shop-tools">
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
              {items.length} products
            </span>
            <label>
              <span className="sr-only">Sort</span>
              <select
                value={filters.sort}
                onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                aria-label="Sort products"
              >
                <option value="featured">Featured</option>
                <option value="newest">Newest</option>
                <option value="price-asc">Price · Low</option>
                <option value="price-desc">Price · High</option>
                <option value="rating">Top rated</option>
              </select>
            </label>
          </div>
          <ProductGrid items={items} />
        </div>
      </div>
    </div>
  )
}
