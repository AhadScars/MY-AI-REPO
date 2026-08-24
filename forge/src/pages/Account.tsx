import { useState } from 'react'
import { useStore } from '../context/StoreContext'

export function Account() {
  const { toast } = useStore()
  const [mode, setMode] = useState<'in' | 'up'>('in')

  return (
    <div className="page">
      <div className="page-hero">
        <div className="container">
          <p className="kicker">Member</p>
          <h1 className="display">{mode === 'in' ? 'Sign in' : 'Create account'}</h1>
        </div>
      </div>
      <div className="container" style={{ maxWidth: 520, padding: '40px 20px 80px' }}>
        <form
          className="panel fields"
          onSubmit={(e) => {
            e.preventDefault()
            toast(mode === 'in' ? 'Welcome back, athlete.' : 'Account created. Welcome to FORGE.')
          }}
        >
          {mode === 'up' && (
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" required />
            </div>
          )}
          <div className="field">
            <label htmlFor="em">Email</label>
            <input id="em" type="email" required />
          </div>
          <div className="field">
            <label htmlFor="pw">Password</label>
            <input id="pw" type="password" required minLength={6} />
          </div>
          <button className="btn" type="submit">
            {mode === 'in' ? 'Enter' : 'Join FORGE'}
          </button>
          <button type="button" onClick={() => setMode(mode === 'in' ? 'up' : 'in')} style={{ color: 'var(--muted)' }}>
            {mode === 'in' ? 'Need an account? Create one' : 'Already in? Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
