import { allColors, allSizes, CATEGORIES, type Category } from '../data/products'

export type FilterState = {
  category: string
  min: number
  max: number
  color: string
  size: string
  rating: number
  inStock: boolean
  sale: boolean
  sort: string
}

export const defaultFilters: FilterState = {
  category: '',
  min: 0,
  max: 15000,
  color: '',
  size: '',
  rating: 0,
  inStock: false,
  sale: false,
  sort: 'featured',
}

export function ProductFilters({
  value,
  onChange,
}: {
  value: FilterState
  onChange: (next: FilterState) => void
}) {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch })

  return (
    <aside className="filters">
      <p className="kicker">Filter</p>
      <h3>Category</h3>
      {(['', ...CATEGORIES, 'new', 'sale'] as const).map((c) => (
        <label key={c || 'all'}>
          <input
            type="radio"
            name="cat"
            checked={value.category === c}
            onChange={() => set({ category: c })}
          />
          {c === '' ? 'All' : c === 'new' ? 'New drops' : c}
        </label>
      ))}

      <h3>Price · ₹{value.max.toLocaleString('en-IN')}</h3>
      <input
        type="range"
        min={0}
        max={15000}
        step={100}
        value={value.max}
        onChange={(e) => set({ max: Number(e.target.value) })}
      />

      <h3>Color</h3>
      <label>
        <input type="radio" name="color" checked={!value.color} onChange={() => set({ color: '' })} />
        Any
      </label>
      {allColors.map((c) => (
        <label key={c.name}>
          <input
            type="radio"
            name="color"
            checked={value.color === c.name}
            onChange={() => set({ color: c.name })}
          />
          {c.name}
        </label>
      ))}

      <h3>Size</h3>
      <label>
        <input type="radio" name="size" checked={!value.size} onChange={() => set({ size: '' })} />
        Any
      </label>
      {allSizes.map((s) => (
        <label key={s}>
          <input type="radio" name="size" checked={value.size === s} onChange={() => set({ size: s })} />
          {s}
        </label>
      ))}

      <h3>Rating</h3>
      {[0, 4, 4.5].map((n) => (
        <label key={n}>
          <input type="radio" name="rating" checked={value.rating === n} onChange={() => set({ rating: n })} />
          {n === 0 ? 'Any' : `${n}+`}
        </label>
      ))}

      <h3>Availability</h3>
      <label>
        <input type="checkbox" checked={value.inStock} onChange={(e) => set({ inStock: e.target.checked })} />
        In stock
      </label>
      <label>
        <input type="checkbox" checked={value.sale} onChange={(e) => set({ sale: e.target.checked })} />
        On sale
      </label>
      <button className="btn btn--ghost" style={{ width: '100%', marginTop: 16 }} onClick={() => onChange(defaultFilters)}>
        Reset
      </button>
    </aside>
  )
}

export function categoryFromParam(param?: string): Partial<FilterState> {
  if (!param) return {}
  if (param === 'new' || param === 'sale') return { category: param }
  if ((CATEGORIES as readonly string[]).includes(param)) return { category: param as Category }
  return {}
}
