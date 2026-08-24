import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { testimonials } from '../data/products'

export function Testimonials() {
  const [i, setI] = useState(0)
  const t = testimonials[i]
  const prev = () => setI((n) => (n - 1 + testimonials.length) % testimonials.length)
  const next = () => setI((n) => (n + 1) % testimonials.length)

  return (
    <div>
      <AnimatePresence mode="wait">
        <motion.article
          key={t.id}
          className="tcard"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.4 }}
        >
          <q>{t.quote}</q>
          <div className="tcard__who">
            <img src={t.image} alt="" />
            <div>
              <strong>{t.name}</strong>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>{t.role}</div>
            </div>
            <div className="tcard__stat">{t.stat}</div>
          </div>
        </motion.article>
      </AnimatePresence>
      <div className="t-nav">
        <button className="icon-btn" onClick={prev} aria-label="Previous testimonial">
          <ChevronLeft />
        </button>
        <button className="icon-btn" onClick={next} aria-label="Next testimonial">
          <ChevronRight />
        </button>
      </div>
    </div>
  )
}
