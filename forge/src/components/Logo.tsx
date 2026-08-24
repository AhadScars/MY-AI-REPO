import { Link } from 'react-router-dom'

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="logo" aria-label="FORGE home">
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M7 6h11.2c3.6 0 6.1 2.3 6.1 5.7 0 2.5-1.4 4.4-3.6 5.2L27 26h-5.5l-4.9-7.6H12.2V26H7V6zm5.2 4.3v5.7h4.7c1.8 0 3-1 3-2.85s-1.2-2.85-3-2.85h-4.7z"
          fill="#C6FF00"
        />
      </svg>
      FORGE
    </Link>
  )
}
