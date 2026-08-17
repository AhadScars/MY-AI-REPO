import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getSocket } from '../lib/socket'
import { useMedia } from '../hooks/useMedia'
import { useWebRTC } from '../hooks/useWebRTC'
import { VideoTile } from '../components/VideoTile'
import { ControlBar } from '../components/ControlBar'
import { ChatPanel } from '../components/ChatPanel'
import { ParticipantList } from '../components/ParticipantList'
import type { ChatMessage, Participant, RoomSummary } from '../types'

interface PeerInfo {
  id: string
  name: string
  audioEnabled: boolean
  videoEnabled: boolean
  isScreenSharing: boolean
}

export function Meeting() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const navState = (location.state || {}) as {
    name?: string
    audioEnabled?: boolean
    videoEnabled?: boolean
    peers?: PeerInfo[]
    room?: RoomSummary
  }

  const displayName = navState.name || localStorage.getItem('baithak-name') || 'Guest'
  const code = roomId.toUpperCase()

  const media = useMedia()
  const [socketReady, setSocketReady] = useState(false)
  const [selfId, setSelfId] = useState<string | null>(null)
  const [room, setRoom] = useState<RoomSummary | null>(navState.room || null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatOpen, setChatOpen] = useState(false)
  const [unreadChat, setUnreadChat] = useState(0)
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [pendingPeers, setPendingPeers] = useState<PeerInfo[] | null>(navState.peers || null)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  )

  const socket = getSocket()

  const webrtc = useWebRTC({
    socket: socketReady ? socket : null,
    localStream: media.stream,
    selfId,
  })

  // Responsive
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Bootstrap media from lobby handoff or fresh getUserMedia
  useEffect(() => {
    const existing = (window as unknown as { __baithakStream?: MediaStream }).__baithakStream
    let cancelled = false
    const hasNavPeers = Array.isArray(navState.peers)

    async function boot() {
      const audioEnabled = navState.audioEnabled !== false
      const videoEnabled = navState.videoEnabled !== false

      if (existing && existing.getTracks().some((t) => t.readyState === 'live')) {
        media.adopt(existing, { audio: audioEnabled, video: videoEnabled })
      } else {
        await media.start()
        if (!audioEnabled) media.setAudioEnabled(false)
        if (!videoEnabled) media.setVideoEnabled(false)
      }

      if (cancelled) return

      if (!socket.connected) {
        await new Promise<void>((resolve) => {
          if (socket.connected) {
            resolve()
            return
          }
          socket.once('connect', () => resolve())
        })
      }

      if (cancelled) return

      setSelfId(socket.id || null)
      setSocketReady(true)

      // If we refreshed mid-call, rejoin + enter
      if (!hasNavPeers) {
        socket.emit(
          'join-room',
          { roomId: code, name: displayName },
          (joinRes: { ok: boolean; error?: string }) => {
            if (!joinRes.ok) {
              navigate('/', { replace: true })
              return
            }
            socket.emit(
              'enter-meeting',
              { audioEnabled, videoEnabled },
              (enterRes: { ok: boolean; peers?: PeerInfo[]; room?: RoomSummary }) => {
                if (!enterRes.ok) {
                  navigate('/', { replace: true })
                  return
                }
                setRoom(enterRes.room || null)
                setPendingPeers(enterRes.peers || [])
              },
            )
          },
        )
      }
    }

    void boot()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dial peers only after local media + socket are ready
  useEffect(() => {
    if (!socketReady || !media.stream || !pendingPeers?.length) return
    const toDial = pendingPeers
    setPendingPeers([])

    toDial.forEach((p) => {
      webrtc.updatePeer(p.id, {
        id: p.id,
        name: p.name,
        audioEnabled: p.audioEnabled,
        videoEnabled: p.videoEnabled,
        isScreenSharing: p.isScreenSharing,
      })
      void webrtc.callPeer(p.id, p.name)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketReady, media.stream, pendingPeers])

  // Socket room events
  useEffect(() => {
    if (!socketReady) return

    const onEntered = (payload: {
      participant: PeerInfo
      room: RoomSummary
    }) => {
      setRoom(payload.room)
      // Existing peers call the new joiner; new joiner is called by others...
      // Convention: the one already in the call sends offer to the newcomer.
      // So when we hear someone else entered, WE call them.
      if (payload.participant.id !== socket.id) {
        void webrtc.callPeer(payload.participant.id, payload.participant.name)
        webrtc.updatePeer(payload.participant.id, {
          id: payload.participant.id,
          name: payload.participant.name,
          audioEnabled: payload.participant.audioEnabled,
          videoEnabled: payload.participant.videoEnabled,
          isScreenSharing: payload.participant.isScreenSharing,
        })
      }
    }

    const onLeft = (payload: { participantId: string; room: RoomSummary }) => {
      setRoom(payload.room)
      webrtc.removePeer(payload.participantId)
    }

    const onMedia = (payload: {
      participantId: string
      audioEnabled?: boolean
      videoEnabled?: boolean
      isScreenSharing?: boolean
    }) => {
      const patch: Partial<{
        audioEnabled: boolean
        videoEnabled: boolean
        isScreenSharing: boolean
      }> = {}
      if (typeof payload.audioEnabled === 'boolean') patch.audioEnabled = payload.audioEnabled
      if (typeof payload.videoEnabled === 'boolean') patch.videoEnabled = payload.videoEnabled
      if (typeof payload.isScreenSharing === 'boolean') {
        patch.isScreenSharing = payload.isScreenSharing
        // Screen share is video — keep the tile visible on the remote side
        if (payload.isScreenSharing) patch.videoEnabled = true
      }
      webrtc.updatePeer(payload.participantId, patch)
      setRoom((r) => {
        if (!r) return r
        return {
          ...r,
          participants: r.participants.map((p) =>
            p.id === payload.participantId ? { ...p, ...patch } : p,
          ),
        }
      })
    }

    const onChat = (message: ChatMessage) => {
      setMessages((m) => [...m, message])
      setChatOpen((open) => {
        if (!open && message.senderId !== socket.id) {
          setUnreadChat((u) => u + 1)
        }
        return open
      })
    }

    const onLobby = (payload: { room: RoomSummary }) => setRoom(payload.room)

    socket.on('participant-entered', onEntered)
    socket.on('participant-left', onLeft)
    socket.on('media-state', onMedia)
    socket.on('chat-message', onChat)
    socket.on('participant-joined-lobby', onLobby)

    return () => {
      socket.off('participant-entered', onEntered)
      socket.off('participant-left', onLeft)
      socket.off('media-state', onMedia)
      socket.off('chat-message', onChat)
      socket.off('participant-joined-lobby', onLobby)
    }
  }, [socketReady, socket, webrtc])

  const broadcastMedia = useCallback(
    (patch: { audioEnabled?: boolean; videoEnabled?: boolean; isScreenSharing?: boolean }) => {
      socket.emit('media-state', patch)
    },
    [socket],
  )

  const handleToggleAudio = () => {
    const enabled = media.toggleAudio()
    broadcastMedia({ audioEnabled: enabled })
  }

  const handleToggleVideo = () => {
    const enabled = media.toggleVideo()
    broadcastMedia({ videoEnabled: enabled })
  }

  const handleToggleScreen = async () => {
    if (webrtc.isScreenSharing) {
      await webrtc.stopScreenShare()
    } else {
      await webrtc.startScreenShare()
    }
  }

  const handleToggleChat = () => {
    setChatOpen((o) => {
      if (!o) setUnreadChat(0)
      return !o
    })
  }

  const handleSendChat = (text: string) => {
    socket.emit('chat-message', { text })
  }

  const handleLeave = () => {
    webrtc.cleanup()
    media.stop()
    socket.emit('leave-room')
    delete (window as unknown as { __baithakStream?: MediaStream }).__baithakStream
    navigate('/', { replace: true })
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      webrtc.cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tileCount = webrtc.peers.length + 1
  const gridCount = Math.min(Math.max(tileCount, 1), 12)

  const participants: Participant[] = useMemo(() => {
    if (room?.participants) return room.participants
    return [
      {
        id: selfId || 'local',
        name: displayName,
        audioEnabled: media.audioEnabled,
        videoEnabled: media.videoEnabled,
        isScreenSharing: webrtc.isScreenSharing,
      },
      ...webrtc.peers.map((p) => ({
        id: p.id,
        name: p.name,
        audioEnabled: p.audioEnabled,
        videoEnabled: p.videoEnabled,
        isScreenSharing: p.isScreenSharing,
      })),
    ]
  }, [room, selfId, displayName, media.audioEnabled, media.videoEnabled, webrtc.peers, webrtc.isScreenSharing])

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-baithak-600">
            <span className="font-display text-xs font-bold text-white">B</span>
          </div>
          <div>
            <h1 className="font-display text-sm font-semibold text-white">Baithak</h1>
            <p className="text-[11px] text-slate-500">
              {webrtc.peers.length + 1} participant
              {webrtc.peers.length === 0 ? '' : 's'} · {code}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/20 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-soft" />
            Live
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Main stage */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 p-3 sm:p-4">
            <div className="tile-grid h-full" data-count={gridCount}>
              <VideoTile
                stream={webrtc.localDisplayStream || media.stream}
                name={displayName}
                isLocal
                audioEnabled={media.audioEnabled}
                videoEnabled={media.videoEnabled || webrtc.isScreenSharing}
                isScreenSharing={webrtc.isScreenSharing}
                className={`aspect-video w-full max-h-full min-h-[140px] sm:min-h-[180px] ${
                  webrtc.isScreenSharing ? 'sm:col-span-full sm:max-h-[70vh]' : ''
                }`}
              />
              {webrtc.peers.map((peer) => (
                <VideoTile
                  key={peer.id}
                  stream={peer.stream}
                  name={peer.name}
                  audioEnabled={peer.audioEnabled}
                  videoEnabled={peer.videoEnabled || peer.isScreenSharing}
                  isScreenSharing={peer.isScreenSharing}
                  className={`aspect-video w-full max-h-full min-h-[140px] sm:min-h-[180px] ${
                    peer.isScreenSharing ? 'sm:col-span-full sm:max-h-[70vh]' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          <ControlBar
            audioEnabled={media.audioEnabled}
            videoEnabled={media.videoEnabled}
            isScreenSharing={webrtc.isScreenSharing}
            chatOpen={chatOpen}
            unreadChat={unreadChat}
            roomId={code}
            participantCount={participants.length}
            onToggleAudio={handleToggleAudio}
            onToggleVideo={handleToggleVideo}
            onToggleScreen={() => void handleToggleScreen()}
            onToggleChat={handleToggleChat}
            onLeave={handleLeave}
            onShowParticipants={() => setPeopleOpen(true)}
          />
        </div>

        {/* Desktop chat */}
        {!isMobile && chatOpen && (
          <div className="hidden w-80 shrink-0 md:block lg:w-96">
            <ChatPanel
              open={chatOpen}
              onClose={() => setChatOpen(false)}
              messages={messages}
              selfId={selfId}
              onSend={handleSendChat}
            />
          </div>
        )}
      </div>

      {/* Mobile chat sheet */}
      {isMobile && (
        <ChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          messages={messages}
          selfId={selfId}
          onSend={handleSendChat}
          mobile
        />
      )}

      <ParticipantList
        open={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        participants={participants}
        selfId={selfId}
        hostId={room?.hostId}
      />
    </div>
  )
}
