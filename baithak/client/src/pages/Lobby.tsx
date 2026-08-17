import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Mic, MicOff, Video, VideoOff, Copy, Check, ArrowLeft, LogIn, Users } from 'lucide-react'
import { getSocket } from '../lib/socket'
import { useMedia } from '../hooks/useMedia'
import { VideoTile } from '../components/VideoTile'
import type { RoomSummary } from '../types'

export function Lobby() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state || {}) as {
    name?: string
    isHost?: boolean
    justCreated?: boolean
    room?: RoomSummary
  }

  const displayName = state.name || localStorage.getItem('baithak-name') || 'Guest'
  const media = useMedia()
  const [room, setRoom] = useState<RoomSummary | null>(state.room || null)
  const [copied, setCopied] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ensured, setEnsured] = useState(Boolean(state.justCreated || state.name || state.room))

  useEffect(() => {
    void media.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // If user landed via direct URL / refresh, re-join the room
  useEffect(() => {
    if (ensured || !roomId) return
    const socket = getSocket()
    socket.emit(
      'join-room',
      { roomId: roomId.toUpperCase(), name: displayName },
      (res: { ok: boolean; room?: RoomSummary; error?: string }) => {
        if (!res.ok) {
          setError(res.error || 'Room not found')
          return
        }
        setRoom(res.room || null)
        setEnsured(true)
      },
    )
  }, [ensured, roomId, displayName])

  useEffect(() => {
    const socket = getSocket()

    // If we created/joined from Home, fetch room summary via a noop media-state or re-sync
    if (state.justCreated || state.name) {
      // Room already joined on server; wait for lobby events
    }

    const onLobby = (payload: { room: RoomSummary }) => setRoom(payload.room)
    const onEntered = (payload: { room: RoomSummary }) => setRoom(payload.room)
    const onLeft = (payload: { room: RoomSummary }) => setRoom(payload.room)

    socket.on('participant-joined-lobby', onLobby)
    socket.on('participant-entered', onEntered)
    socket.on('participant-left', onLeft)

    return () => {
      socket.off('participant-joined-lobby', onLobby)
      socket.off('participant-entered', onEntered)
      socket.off('participant-left', onLeft)
    }
  }, [state.justCreated, state.name])

  const code = roomId.toUpperCase()

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* ignore */
    }
  }

  const enterMeeting = () => {
    setJoining(true)
    setError(null)
    const socket = getSocket()
    socket.emit(
      'enter-meeting',
      { audioEnabled: media.audioEnabled, videoEnabled: media.videoEnabled },
      (res: { ok: boolean; peers?: unknown[]; room?: RoomSummary; error?: string }) => {
        if (!res.ok) {
          setJoining(false)
          setError(res.error || 'Could not join meeting')
          return
        }
        // Don't stop media — Meeting reuses the same tracks via navigation state
        navigate(`/meeting/${code}`, {
          state: {
            name: displayName,
            audioEnabled: media.audioEnabled,
            videoEnabled: media.videoEnabled,
            peers: res.peers || [],
            room: res.room,
          },
          replace: true,
        })
      },
    )
  }

  // Store stream on window temporarily so Meeting can pick it up without re-prompting
  useEffect(() => {
    if (media.stream) {
      ;(window as unknown as { __baithakStream?: MediaStream }).__baithakStream = media.stream
    }
  }, [media.stream])

  const leaveLobby = () => {
    const socket = getSocket()
    socket.emit('leave-room')
    media.stop()
    delete (window as unknown as { __baithakStream?: MediaStream }).__baithakStream
    navigate('/')
  }

  const lobbyCount = room?.participants.filter((p) => p.inLobby).length ?? 1
  const inCallCount = room?.participants.filter((p) => !p.inLobby).length ?? 0

  return (
    <div className="baithak-bg min-h-full">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col px-4 py-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={leaveLobby}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="text-center">
            <p className="font-display text-sm font-semibold text-white">Lobby</p>
            <p className="text-xs text-slate-500">Check your camera before joining</p>
          </div>
          <div className="w-16" />
        </header>

        <div className="grid flex-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-4">
            <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-white/10 bg-surface-2 shadow-2xl sm:aspect-[16/10]">
              <VideoTile
                stream={media.stream}
                name={displayName}
                isLocal
                audioEnabled={media.audioEnabled}
                videoEnabled={media.videoEnabled}
                className="absolute inset-0 h-full w-full rounded-3xl"
              />
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => media.toggleAudio()}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                  media.audioEnabled
                    ? 'bg-white/10 text-white hover:bg-white/15'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {media.audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => media.toggleVideo()}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                  media.videoEnabled
                    ? 'bg-white/10 text-white hover:bg-white/15'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {media.videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
            </div>

            {media.error && (
              <p className="text-center text-sm text-amber-300/90">{media.error}</p>
            )}
          </div>

          <div className="glass flex flex-col rounded-3xl p-6 shadow-xl">
            <div className="mb-6">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Meeting code
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="font-mono text-2xl font-bold tracking-[0.25em] text-white">
                  {code}
                </span>
                <button
                  type="button"
                  onClick={copyCode}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                  title="Copy code"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-baithak-300" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                Share this code so others can join your baithak.
              </p>
            </div>

            <div className="mb-6 rounded-2xl bg-surface-3/80 p-4 ring-1 ring-white/5">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                <Users className="h-4 w-4 text-baithak-300" />
                Waiting room
              </div>
              <div className="flex gap-4 text-xs text-slate-400">
                <span>
                  <strong className="text-white">{lobbyCount}</strong> in lobby
                </span>
                <span>
                  <strong className="text-white">{inCallCount}</strong> in call
                </span>
              </div>
              {room && (
                <ul className="mt-3 max-h-36 space-y-1.5 overflow-y-auto baithak-scroll">
                  {room.participants.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm"
                    >
                      <span className="text-slate-200">
                        {p.name}
                        {p.id === getSocket().id ? ' (You)' : ''}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-500">
                        {p.inLobby ? 'Lobby' : 'In call'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && (
              <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={enterMeeting}
              disabled={joining || !media.ready}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-baithak-600 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-baithak-500 disabled:opacity-50"
            >
              <LogIn className="h-4 w-4" />
              {joining ? 'Joining…' : 'Join now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
