import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { categoryMeta, type Category } from '../data/products'

export function CategoryCard({ id }: { id: Category }) {
  const c = categoryMeta[id]
  return (
    <Link to={c.href} className="cat" aria-label={`Shop ${c.label}`}>
      <img src={c.image} alt="" />
      <div className="cat__veil" />
      <div className="cat__copy">
        <h3 className="display">{c.label}</h3>
        <p>{c.blurb}</p>
        <div className="cat__line" />
        <div className="shop-now">
          Shop now <ArrowUpRight size={14} />
        </div>
      </div>
    </Link>
  )
}
