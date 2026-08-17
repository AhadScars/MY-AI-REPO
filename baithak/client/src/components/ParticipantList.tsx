import { Mic, MicOff, Monitor, User, X } from 'lucide-react'
import type { Participant } from '../types'

interface ParticipantListProps {
  open: boolean
  onClose: () => void
  participants: Participant[]
  selfId: string | null
  hostId?: string | null
}

export function ParticipantList({ open, onClose, participants, selfId, hostId }: ParticipantListProps) {
  if (!open) return null

  const inCall = participants.filter((p) => !p.inLobby)
  const lobby = participants.filter((p) => p.inLobby)

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center">
      <div className="glass w-full max-w-md overflow-hidden rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="font-display text-sm font-semibold text-white">
            People ({participants.length})
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="baithak-scroll max-h-[60vh] space-y-4 overflow-y-auto p-4">
          {inCall.length > 0 && (
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                In meeting
              </h3>
              <ul className="space-y-1">
                {inCall.map((p) => (
                  <ParticipantRow key={p.id} p={p} selfId={selfId} hostId={hostId} />
                ))}
              </ul>
            </section>
          )}
          {lobby.length > 0 && (
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                In lobby
              </h3>
              <ul className="space-y-1">
                {lobby.map((p) => (
                  <ParticipantRow key={p.id} p={p} selfId={selfId} hostId={hostId} />
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function ParticipantRow({
  p,
  selfId,
  hostId,
}: {
  p: Participant
  selfId: string | null
  hostId?: string | null
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-baithak-800/60 text-baithak-200">
        <User className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {p.name}
          {p.id === selfId ? ' (You)' : ''}
          {p.id === hostId ? (
            <span className="ml-1.5 text-[10px] font-normal text-baithak-300">Host</span>
          ) : null}
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-slate-400">
        {p.isScreenSharing && <Monitor className="h-3.5 w-3.5 text-sky-300" />}
        {p.audioEnabled ? (
          <Mic className="h-3.5 w-3.5" />
        ) : (
          <MicOff className="h-3.5 w-3.5 text-rose-400" />
        )}
      </div>
    </li>
  )
}
