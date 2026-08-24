import type { ReactNode } from 'react'
import { useInView } from '../hooks/useInView'

export function AnimatedSection({
  children,
  className = '',
  as: Tag = 'section',
  id,
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article'
  id?: string
}) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <Tag id={id} className={className}>
      <div ref={ref} className={`reveal ${inView ? 'in' : ''}`}>
        {children}
      </div>
    </Tag>
  )
}

export function Stars({ value }: { value: number }) {
  const full = Math.round(value)
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {'★'.repeat(full)}
      {'☆'.repeat(5 - full)} {value.toFixed(1)}
    </span>
  )
}
