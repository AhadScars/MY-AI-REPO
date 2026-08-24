import { useRef, type ButtonHTMLAttributes, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { useMagnetic } from '../hooks/useMagnetic'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'solid' | 'ghost' | 'dark' | 'hot'
  to?: string
  children: ReactNode
}

export function MagneticButton({
  variant = 'solid',
  className = '',
  onClick,
  children,
  to,
  type = 'button',
  ...rest
}: Props) {
  const ref = useRef<HTMLElement>(null)
  useMagnetic(ref, 0.28)
  const v = variant === 'solid' ? '' : ` btn--${variant}`
  const cls = `btn${v} ${className}`

  const mark = (e: MouseEvent<HTMLElement>) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    el.style.setProperty('--rx', `${((e.clientX - r.left) / r.width) * 100}%`)
    el.style.setProperty('--ry', `${((e.clientY - r.top) / r.height) * 100}%`)
  }

  if (to) {
    return (
      <Link ref={ref as RefObject<HTMLAnchorElement>} to={to} className={cls} onClick={mark}>
        {children}
      </Link>
    )
  }

  return (
    <button
      ref={ref as RefObject<HTMLButtonElement>}
      className={cls}
      type={type}
      onClick={(e) => {
        mark(e)
        onClick?.(e)
      }}
      {...rest}
    >
      {children}
    </button>
  )
}
