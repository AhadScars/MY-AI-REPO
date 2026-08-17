import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  MessageSquare,
  PhoneOff,
  Users,
  Copy,
  Check,
} from 'lucide-react'
import { useState } from 'react'

interface ControlBarProps {
  audioEnabled: boolean
  videoEnabled: boolean
  isScreenSharing: boolean
  chatOpen: boolean
  unreadChat: number
  roomId: string
  participantCount: number
  onToggleAudio: () => void
  onToggleVideo: () => void
  onToggleScreen: () => void
  onToggleChat: () => void
  onLeave: () => void
  onShowParticipants?: () => void
}

export function ControlBar({
  audioEnabled,
  videoEnabled,
  isScreenSharing,
  chatOpen,
  unreadChat,
  roomId,
  participantCount,
  onToggleAudio,
  onToggleVideo,
  onToggleScreen,
  onToggleChat,
  onLeave,
  onShowParticipants,
}: ControlBarProps) {
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* ignore */
    }
  }

  const btn =
    'relative flex h-12 w-12 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-baithak-400 sm:h-13 sm:w-13'

  return (
    <div className="flex w-full flex-col items-center gap-3 px-3 pb-4 pt-2 sm:px-6">
      <div className="flex items-center gap-2 text-xs text-slate-400 sm:hidden">
        <span className="rounded-md bg-white/5 px-2 py-1 font-mono tracking-wider text-slate-300">
          {roomId}
        </span>
        <button type="button" onClick={copyCode} className="text-baithak-300">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="glass flex max-w-full items-center gap-1.5 rounded-2xl px-2 py-2 shadow-2xl sm:gap-2 sm:px-3">
        <div className="mr-1 hidden items-center gap-2 border-r border-white/10 pr-3 sm:flex">
          <span className="font-mono text-xs tracking-widest text-slate-300">{roomId}</span>
          <button
            type="button"
            onClick={copyCode}
            className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white"
            title="Copy meeting code"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-baithak-300" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleAudio}
          className={`${btn} ${
            audioEnabled ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-rose-500 text-white hover:bg-rose-400'
          }`}
          title={audioEnabled ? 'Mute' : 'Unmute'}
        >
          {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={onToggleVideo}
          className={`${btn} ${
            videoEnabled ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-rose-500 text-white hover:bg-rose-400'
          }`}
          title={videoEnabled ? 'Stop video' : 'Start video'}
        >
          {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={onToggleScreen}
          className={`${btn} ${
            isScreenSharing
              ? 'bg-sky-500 text-white hover:bg-sky-400'
              : 'bg-white/10 text-white hover:bg-white/15'
          }`}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={onToggleChat}
          className={`${btn} ${
            chatOpen ? 'bg-baithak-600 text-white' : 'bg-white/10 text-white hover:bg-white/15'
          }`}
          title="Chat"
        >
          <MessageSquare className="h-5 w-5" />
          {unreadChat > 0 && !chatOpen && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold">
              {unreadChat > 9 ? '9+' : unreadChat}
            </span>
          )}
        </button>

        {onShowParticipants && (
          <button
            type="button"
            onClick={onShowParticipants}
            className={`${btn} bg-white/10 text-white hover:bg-white/15`}
            title="Participants"
          >
            <Users className="h-5 w-5" />
            <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-surface-2 px-1 text-[10px] text-slate-300">
              {participantCount}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={onLeave}
          className={`${btn} ml-1 bg-rose-600 text-white hover:bg-rose-500 sm:ml-2 sm:w-auto sm:gap-2 sm:px-5`}
          title="Leave meeting"
        >
          <PhoneOff className="h-5 w-5" />
          <span className="hidden text-sm font-medium sm:inline">Leave</span>
        </button>
      </div>
    </div>
  )
}
