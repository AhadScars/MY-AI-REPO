import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Video, Users, MessageSquare, MonitorUp, ArrowRight, Sparkles } from 'lucide-react'
import { getSocket } from '../lib/socket'

export function Home() {
  const navigate = useNavigate()
  const [name, setName] = useState(() => localStorage.getItem('baithak-name') || '')
  const [roomCode, setRoomCode] = useState('')
  const [mode, setMode] = useState<'join' | 'create'>('create')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const persistName = (value: string) => {
    setName(value)
    localStorage.setItem('baithak-name', value)
  }

  const handleCreate = (e: FormEvent) => {
    e.preventDefault()
    const displayName = name.trim() || 'Guest'
    persistName(displayName)
    setLoading(true)
    setError(null)

    const socket = getSocket()
    socket.emit('create-room', { name: displayName }, (res: {
      ok: boolean
      roomId?: string
      room?: unknown
      error?: string
    }) => {
      setLoading(false)
      if (!res.ok || !res.roomId) {
        setError(res.error || 'Could not create meeting')
        return
      }
      navigate(`/lobby/${res.roomId}`, {
        state: { name: displayName, isHost: true, justCreated: true, room: res.room },
      })
    })
  }

  const handleJoin = (e: FormEvent) => {
    e.preventDefault()
    const displayName = name.trim() || 'Guest'
    const code = roomCode.trim().toUpperCase()
    if (!code) {
      setError('Enter a meeting code')
      return
    }
    persistName(displayName)
    setLoading(true)
    setError(null)

    const socket = getSocket()
    socket.emit('join-room', { roomId: code, name: displayName }, (res: {
      ok: boolean
      roomId?: string
      room?: unknown
      error?: string
    }) => {
      setLoading(false)
      if (!res.ok || !res.roomId) {
        setError(res.error || 'Could not join meeting')
        return
      }
      navigate(`/lobby/${res.roomId}`, {
        state: { name: displayName, isHost: false, room: res.room },
      })
    })
  }

  return (
    <div className="baithak-bg min-h-full">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-baithak-600 shadow-lg shadow-baithak-900/40">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
                Baithak
              </h1>
              <p className="text-xs text-slate-400">Meet · Chat · Share</p>
            </div>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full bg-baithak-500/10 px-3 py-1 text-xs font-medium text-baithak-300 ring-1 ring-baithak-500/20 sm:inline-flex">
            <Sparkles className="h-3.5 w-3.5" />
            Free peer-to-peer meetings
          </span>
        </header>

        <div className="grid flex-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="font-display text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
                Gather close.
                <span className="block text-baithak-300">Talk face to face.</span>
              </h2>
              <p className="max-w-md text-base leading-relaxed text-slate-400 sm:text-lg">
                Baithak is a modern video conference app for 1:1 and group calls, live chat, and
                screen sharing — with a polished lobby and responsive meeting UI.
              </p>
            </div>

            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: Video, label: 'HD video tiles', desc: 'Name & mute indicators' },
                { icon: MessageSquare, label: 'Live chat', desc: 'Side panel messaging' },
                { icon: MonitorUp, label: 'Screen share', desc: 'Present to everyone' },
                { icon: Users, label: 'Lobby system', desc: 'Preview before joining' },
              ].map(({ icon: Icon, label, desc }) => (
                <li
                  key={label}
                  className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-baithak-600/20 text-baithak-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass rounded-3xl p-6 shadow-2xl sm:p-8">
            <div className="mb-6 flex rounded-xl bg-surface-3 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('create')
                  setError(null)
                }}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                  mode === 'create'
                    ? 'bg-baithak-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                New meeting
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('join')
                  setError(null)
                }}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                  mode === 'join'
                    ? 'bg-baithak-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Join with code
              </button>
            </div>

            <form onSubmit={mode === 'create' ? handleCreate : handleJoin} className="space-y-4">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-slate-400">
                  Your name
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => persistName(e.target.value)}
                  placeholder="e.g. Ayesha"
                  maxLength={40}
                  className="w-full rounded-xl border border-white/10 bg-surface-3 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-baithak-500/50 focus:ring-2 focus:ring-baithak-500/20"
                />
              </div>

              {mode === 'join' && (
                <div>
                  <label htmlFor="code" className="mb-1.5 block text-xs font-medium text-slate-400">
                    Meeting code
                  </label>
                  <input
                    id="code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    maxLength={8}
                    className="w-full rounded-xl border border-white/10 bg-surface-3 px-4 py-3 font-mono text-sm tracking-[0.2em] text-white outline-none transition placeholder:text-slate-600 focus:border-baithak-500/50 focus:ring-2 focus:ring-baithak-500/20"
                  />
                </div>
              )}

              {error && (
                <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-rose-500/20">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-baithak-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-baithak-900/30 transition hover:bg-baithak-500 disabled:opacity-60"
              >
                {loading ? (
                  <span className="pulse-soft">Connecting…</span>
                ) : (
                  <>
                    {mode === 'create' ? 'Create baithak' : 'Continue to lobby'}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-500">
              Camera & mic stay on your device. Media is peer-to-peer via WebRTC.
              <br />
              Best for 1:1 and small groups (up to 12).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
