import { useState } from 'react'
import { useStore } from '../context/StoreContext'

export function Newsletter() {
  const { toast } = useStore()
  const [email, setEmail] = useState('')
  return (
    <section className="news">
      <div className="container">
        <div className="news__box">
          <p className="kicker">The list</p>
          <h2 className="display">Join the movement</h2>
          <p>Drops, training notes, and early access. No fluff emails. Unsubscribe whenever you want.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              toast('Welcome to FORGE.')
              setEmail('')
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              aria-label="Email address"
            />
            <button className="btn" type="submit">
              Get in
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
