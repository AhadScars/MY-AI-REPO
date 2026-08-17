import { useEffect, useRef } from 'react'
import { Mic, MicOff, Monitor, User } from 'lucide-react'

interface VideoTileProps {
  stream: MediaStream | null
  name: string
  isLocal?: boolean
  audioEnabled: boolean
  videoEnabled: boolean
  isScreenSharing?: boolean
  isSpeaking?: boolean
  className?: string
}

export function VideoTile({
  stream,
  name,
  isLocal = false,
  audioEnabled,
  videoEnabled,
  isScreenSharing = false,
  isSpeaking = false,
  className = '',
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return

    if (stream) {
      // Always re-assign so track swaps (camera ↔ screen) paint immediately
      if (el.srcObject !== stream) {
        el.srcObject = stream
      }
      // Kick playback (some browsers pause after track replace)
      const play = () => {
        void el.play().catch(() => undefined)
      }
      play()

      const onAdd = () => {
        // Force rebind when tracks change on the same MediaStream instance
        el.srcObject = stream
        play()
      }
      stream.addEventListener('addtrack', onAdd)
      stream.addEventListener('removetrack', onAdd)

      const videos = stream.getVideoTracks()
      const onUnmute = () => play()
      videos.forEach((t) => {
        t.addEventListener('unmute', onUnmute)
        t.addEventListener('ended', onAdd)
      })

      return () => {
        stream.removeEventListener('addtrack', onAdd)
        stream.removeEventListener('removetrack', onAdd)
        videos.forEach((t) => {
          t.removeEventListener('unmute', onUnmute)
          t.removeEventListener('ended', onAdd)
        })
      }
    }

    el.srcObject = null
  }, [stream])

  // Screen share must remain visible even if camera was muted
  const hasLiveVideo = Boolean(
    stream?.getVideoTracks().some((t) => t.readyState === 'live' && (t.enabled || isScreenSharing)),
  )
  const showVideo = Boolean(stream && (videoEnabled || isScreenSharing) && hasLiveVideo)

  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-surface-3 border transition-shadow duration-200 ${
        isSpeaking || isScreenSharing
          ? 'border-baithak-400 shadow-[0_0_0_2px_rgba(45,212,191,0.45)]'
          : 'border-white/5'
      } ${className}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`absolute inset-0 h-full w-full bg-black ${
          isScreenSharing ? 'object-contain' : 'object-cover'
        } ${showVideo ? 'opacity-100' : 'opacity-0'} ${
          isLocal && !isScreenSharing ? 'scale-x-[-1]' : ''
        }`}
      />

      {!showVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-surface-3 to-surface-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-baithak-700/40 text-baithak-200 ring-2 ring-baithak-500/30 sm:h-20 sm:w-20">
            {initials ? (
              <span className="font-display text-xl font-semibold sm:text-2xl">{initials}</span>
            ) : (
              <User className="h-8 w-8" />
            )}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 pt-10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-white drop-shadow">
              {name}
              {isLocal ? ' (You)' : ''}
            </span>
            {isScreenSharing && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-200 ring-1 ring-sky-400/30">
                <Monitor className="h-3 w-3" />
                Screen
              </span>
            )}
          </div>
          <span
            className={`inline-flex shrink-0 items-center justify-center rounded-full p-1.5 ${
              audioEnabled ? 'bg-white/10 text-white' : 'bg-rose-500/90 text-white'
            }`}
            title={audioEnabled ? 'Mic on' : 'Muted'}
          >
            {audioEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
          </span>
        </div>
      </div>
    </div>
  )
}
