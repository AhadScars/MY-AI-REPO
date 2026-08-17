import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { PeerStream, SignalPayload } from '../types'

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

interface UseWebRTCOptions {
  socket: Socket | null
  localStream: MediaStream | null
  selfId: string | null
}

function findVideoSender(pc: RTCPeerConnection): RTCRtpSender | undefined {
  return pc.getSenders().find((s) => s.track?.kind === 'video')
}

export function useWebRTC({ socket, localStream, selfId }: UseWebRTCOptions) {
  const [peers, setPeers] = useState<Map<string, PeerStream>>(new Map())
  /** Stream shown in the local tile (camera or screen). New object when share starts/stops so <video> rebinds. */
  const [localDisplayStream, setLocalDisplayStream] = useState<MediaStream | null>(null)
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(localStream)
  const screenTrackRef = useRef<MediaStreamTrack | null>(null)
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const makingOfferRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    localStreamRef.current = localStream
    if (localStream) {
      const cam = localStream.getVideoTracks()[0]
      if (cam && !screenTrackRef.current) {
        cameraTrackRef.current = cam
      }
      if (!screenTrackRef.current) {
        setLocalDisplayStream(localStream)
      }
    } else if (!screenTrackRef.current) {
      setLocalDisplayStream(null)
    }
  }, [localStream])

  const updatePeer = useCallback((id: string, patch: Partial<PeerStream>) => {
    setPeers((prev) => {
      const next = new Map(prev)
      const existing = next.get(id) || {
        id,
        name: patch.name || 'Guest',
        stream: null,
        audioEnabled: true,
        videoEnabled: true,
        isScreenSharing: false,
      }
      next.set(id, { ...existing, ...patch })
      return next
    })
  }, [])

  const removePeer = useCallback((id: string) => {
    const pc = pcsRef.current.get(id)
    if (pc) {
      pc.close()
      pcsRef.current.delete(id)
    }
    makingOfferRef.current.delete(id)
    setPeers((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  const addLocalTracks = useCallback((pc: RTCPeerConnection) => {
    const stream = localStreamRef.current
    if (!stream) return

    const existingKinds = new Set(
      pc
        .getSenders()
        .map((s) => s.track?.kind)
        .filter(Boolean) as string[],
    )

    const videoTrack = screenTrackRef.current || stream.getVideoTracks()[0] || null
    const audioTrack = stream.getAudioTracks()[0] || null

    if (audioTrack && !existingKinds.has('audio')) {
      pc.addTrack(audioTrack, stream)
    } else if (audioTrack) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'audio')
      if (sender && sender.track?.id !== audioTrack.id) {
        void sender.replaceTrack(audioTrack)
      }
    }

    if (videoTrack && !existingKinds.has('video')) {
      pc.addTrack(videoTrack, stream)
    } else if (videoTrack) {
      const sender = findVideoSender(pc)
      if (sender && sender.track?.id !== videoTrack.id) {
        void sender.replaceTrack(videoTrack)
      }
    }
  }, [])

  const renegotiate = useCallback(
    async (peerId: string) => {
      if (!socket) return
      const pc = pcsRef.current.get(peerId)
      if (!pc) return
      if (makingOfferRef.current.has(peerId)) return
      if (pc.signalingState !== 'stable') return

      try {
        makingOfferRef.current.add(peerId)
        const offer = await pc.createOffer()
        if (pc.signalingState !== 'stable') return
        await pc.setLocalDescription(offer)
        const payload: SignalPayload = { type: 'offer', sdp: pc.localDescription! }
        socket.emit('signal', { to: peerId, data: payload })
      } catch (err) {
        console.error('Renegotiation failed', err)
      } finally {
        makingOfferRef.current.delete(peerId)
      }
    },
    [socket],
  )

  /** Replace outbound video on all PCs; addTrack + renegotiate if no video sender yet. */
  const replaceVideoTrack = useCallback(
    async (track: MediaStreamTrack | null) => {
      const jobs: Promise<void>[] = []

      pcsRef.current.forEach((pc, peerId) => {
        const sender = findVideoSender(pc)
        if (sender) {
          jobs.push(
            sender.replaceTrack(track).then(() => {
              try {
                const params = sender.getParameters()
                if (!params.encodings?.length) {
                  params.encodings = [{}]
                }
                void sender.setParameters(params)
              } catch {
                /* ignore */
              }
            }),
          )
        } else if (track) {
          const stream = localStreamRef.current || new MediaStream([track])
          pc.addTrack(track, stream)
          jobs.push(renegotiate(peerId))
        }
      })

      await Promise.all(jobs)
    },
    [renegotiate],
  )

  const createPeerConnection = useCallback(
    (peerId: string, peerName: string) => {
      if (pcsRef.current.has(peerId)) {
        return pcsRef.current.get(peerId)!
      }

      const pc = new RTCPeerConnection(ICE_SERVERS)
      pcsRef.current.set(peerId, pc)

      addLocalTracks(pc)

      pc.onicecandidate = (event) => {
        if (!socket) return
        const payload: SignalPayload = {
          type: 'ice-candidate',
          candidate: event.candidate ? event.candidate.toJSON() : null,
        }
        socket.emit('signal', { to: peerId, data: payload })
      }

      pc.ontrack = (event) => {
        setPeers((prev) => {
          const next = new Map(prev)
          const existing = next.get(peerId)
          let stream = existing?.stream ?? null

          if (!stream) {
            stream = event.streams[0] ? event.streams[0] : new MediaStream()
          }

          // Attach incoming track if not already present
          if (!stream.getTracks().some((t) => t.id === event.track.id)) {
            // For video, drop previous video track so UI picks up screen frames cleanly
            if (event.track.kind === 'video') {
              stream.getVideoTracks().forEach((t) => stream!.removeTrack(t))
            }
            stream.addTrack(event.track)
          }

          // Force a new MediaStream reference so React re-binds <video>
          const refreshed = new MediaStream(stream.getTracks())

          next.set(peerId, {
            id: peerId,
            name: peerName || existing?.name || 'Guest',
            stream: refreshed,
            audioEnabled: existing?.audioEnabled ?? true,
            videoEnabled: existing?.videoEnabled ?? true,
            isScreenSharing: existing?.isScreenSharing ?? false,
          })
          return next
        })
      }

      updatePeer(peerId, { id: peerId, name: peerName })
      return pc
    },
    [socket, updatePeer, addLocalTracks],
  )

  const callPeer = useCallback(
    async (peerId: string, peerName: string) => {
      if (!socket || peerId === selfId) return
      createPeerConnection(peerId, peerName)
      await renegotiate(peerId)
    },
    [socket, selfId, createPeerConnection, renegotiate],
  )

  const handleSignal = useCallback(
    async ({
      from,
      data,
      name,
    }: {
      from: string
      data: SignalPayload
      name?: string
    }) => {
      if (!socket || from === selfId) return
      const peerName = name || 'Guest'

      if (data.type === 'offer') {
        const pc = createPeerConnection(from, peerName)
        try {
          // If we also sent an offer, roll back and accept remote (polite peer)
          if (pc.signalingState === 'have-local-offer') {
            await pc.setLocalDescription({ type: 'rollback' })
          }
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          const payload: SignalPayload = { type: 'answer', sdp: pc.localDescription! }
          socket.emit('signal', { to: from, data: payload })
        } catch (err) {
          console.error('Failed to handle offer', err)
        }
      } else if (data.type === 'answer') {
        const pc = pcsRef.current.get(from)
        if (!pc) return
        try {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
          }
        } catch (err) {
          console.error('Failed to handle answer', err)
        }
      } else if (data.type === 'ice-candidate') {
        const pc = pcsRef.current.get(from) || createPeerConnection(from, peerName)
        if (data.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
          } catch (err) {
            console.error('Failed to add ICE candidate', err)
          }
        }
      }
    },
    [socket, selfId, createPeerConnection],
  )

  useEffect(() => {
    if (!socket) return

    const onSignal = (payload: { from: string; data: SignalPayload; name?: string }) => {
      void handleSignal(payload)
    }

    socket.on('signal', onSignal)
    return () => {
      socket.off('signal', onSignal)
    }
  }, [socket, handleSignal])

  const buildDisplayStream = useCallback((videoTrack: MediaStreamTrack | null) => {
    const audio = localStreamRef.current?.getAudioTracks()[0]
    const tracks: MediaStreamTrack[] = []
    if (audio) tracks.push(audio)
    if (videoTrack) tracks.push(videoTrack)
    return tracks.length ? new MediaStream(tracks) : null
  }, [])

  const stopScreenShareRef = useRef<() => Promise<void>>(async () => {})

  const stopScreenShare = useCallback(async () => {
    const screenTrack = screenTrackRef.current
    if (screenTrack) {
      screenTrack.onended = null
      screenTrack.stop()
      screenTrackRef.current = null
    }

    const cam = cameraTrackRef.current
    await replaceVideoTrack(cam)

    if (localStreamRef.current) {
      setLocalDisplayStream(localStreamRef.current)
    } else if (cam) {
      setLocalDisplayStream(buildDisplayStream(cam))
    } else {
      setLocalDisplayStream(null)
    }

    setIsScreenSharing(false)
    socket?.emit('media-state', { isScreenSharing: false })
  }, [replaceVideoTrack, socket, buildDisplayStream])

  stopScreenShareRef.current = stopScreenShare

  const startScreenShare = useCallback(async () => {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 15, max: 30 },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      const screenTrack = display.getVideoTracks()[0]
      if (!screenTrack) return false

      try {
        screenTrack.contentHint = 'detail'
      } catch {
        /* ignore */
      }

      const local = localStreamRef.current
      const cam = local?.getVideoTracks()[0]
      if (cam && cam.id !== screenTrack.id) {
        cameraTrackRef.current = cam
      }

      screenTrackRef.current = screenTrack
      await replaceVideoTrack(screenTrack)

      // New MediaStream so React/VideoTile rebinds <video srcObject>
      setLocalDisplayStream(buildDisplayStream(screenTrack))
      setIsScreenSharing(true)

      // Peers must show video tile while screen is shared
      socket?.emit('media-state', {
        isScreenSharing: true,
        videoEnabled: true,
      })

      screenTrack.onended = () => {
        void stopScreenShareRef.current()
      }

      return true
    } catch (err) {
      console.error('Screen share failed', err)
      return false
    }
  }, [replaceVideoTrack, socket, buildDisplayStream])

  const cleanup = useCallback(() => {
    pcsRef.current.forEach((pc) => pc.close())
    pcsRef.current.clear()
    setPeers(new Map())
    if (screenTrackRef.current) {
      screenTrackRef.current.onended = null
      screenTrackRef.current.stop()
      screenTrackRef.current = null
    }
    setIsScreenSharing(false)
    setLocalDisplayStream(null)
  }, [])

  // Sync tracks when local camera stream becomes available after peers connected
  useEffect(() => {
    if (!localStream || screenTrackRef.current) return
    pcsRef.current.forEach((pc, peerId) => {
      const senders = pc.getSenders()
      localStream.getTracks().forEach((track) => {
        const kindSender = senders.find((s) => s.track?.kind === track.kind)
        if (kindSender) {
          if (kindSender.track?.id !== track.id) {
            void kindSender.replaceTrack(track)
          }
        } else {
          pc.addTrack(track, localStream)
          void renegotiate(peerId)
        }
      })
    })
  }, [localStream, renegotiate])

  return {
    peers: Array.from(peers.values()),
    peersMap: peers,
    callPeer,
    removePeer,
    updatePeer,
    startScreenShare,
    stopScreenShare,
    isScreenSharing,
    localDisplayStream,
    cleanup,
  }
}
