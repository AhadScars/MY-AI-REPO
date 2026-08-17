import { useCallback, useEffect, useRef, useState } from 'react'

export interface MediaState {
  stream: MediaStream | null
  audioEnabled: boolean
  videoEnabled: boolean
  error: string | null
  ready: boolean
}

const defaultConstraints: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: 'user',
  },
}

export function useMedia() {
  const [state, setState] = useState<MediaState>({
    stream: null,
    audioEnabled: true,
    videoEnabled: true,
    error: null,
    ready: false,
  })
  const streamRef = useRef<MediaStream | null>(null)

  const adopt = useCallback((stream: MediaStream, opts?: { audio?: boolean; video?: boolean }) => {
    // Don't stop tracks — they may be reused from lobby
    streamRef.current = stream
    if (typeof opts?.audio === 'boolean') {
      stream.getAudioTracks().forEach((t) => {
        t.enabled = opts.audio!
      })
    }
    if (typeof opts?.video === 'boolean') {
      stream.getVideoTracks().forEach((t) => {
        t.enabled = opts.video!
      })
    }
    const audioEnabled =
      typeof opts?.audio === 'boolean'
        ? opts.audio
        : stream.getAudioTracks().some((t) => t.enabled)
    const videoEnabled =
      typeof opts?.video === 'boolean'
        ? opts.video
        : stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live')

    setState({
      stream,
      audioEnabled,
      videoEnabled,
      error: null,
      ready: true,
    })
  }, [])

  const start = useCallback(async (opts?: { audio?: boolean; video?: boolean }) => {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop())

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: opts?.audio === false ? false : defaultConstraints.audio,
        video: opts?.video === false ? false : defaultConstraints.video,
      })

      streamRef.current = stream
      const audioEnabled = stream.getAudioTracks().some((t) => t.enabled)
      const videoEnabled = stream.getVideoTracks().some((t) => t.enabled)

      setState({
        stream,
        audioEnabled,
        videoEnabled,
        error: null,
        ready: true,
      })
      return stream
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera/microphone permission denied. Allow access to join with video.'
          : err instanceof Error
            ? err.message
            : 'Could not access camera or microphone'

      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        streamRef.current = audioOnly
        setState({
          stream: audioOnly,
          audioEnabled: true,
          videoEnabled: false,
          error: 'Camera unavailable — joined with audio only.',
          ready: true,
        })
        return audioOnly
      } catch {
        setState({
          stream: null,
          audioEnabled: false,
          videoEnabled: false,
          error: message,
          ready: true,
        })
        return null
      }
    }
  }, [])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setState({
      stream: null,
      audioEnabled: false,
      videoEnabled: false,
      error: null,
      ready: false,
    })
  }, [])

  const toggleAudio = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return false
    const track = stream.getAudioTracks()[0]
    if (!track) return false
    track.enabled = !track.enabled
    setState((s) => ({ ...s, audioEnabled: track.enabled }))
    return track.enabled
  }, [])

  const toggleVideo = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return false
    const track = stream.getVideoTracks()[0]
    if (!track) return false
    track.enabled = !track.enabled
    setState((s) => ({ ...s, videoEnabled: track.enabled }))
    return track.enabled
  }, [])

  const setAudioEnabled = useCallback((enabled: boolean) => {
    const track = streamRef.current?.getAudioTracks()[0]
    if (track) {
      track.enabled = enabled
      setState((s) => ({ ...s, audioEnabled: enabled }))
    }
  }, [])

  const setVideoEnabled = useCallback((enabled: boolean) => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (track) {
      track.enabled = enabled
      setState((s) => ({ ...s, videoEnabled: enabled }))
    }
  }, [])

  useEffect(() => {
    return () => {
      // Do not auto-stop on unmount — lobby/meeting handoff reuses tracks.
      // Explicit stop() on leave handles cleanup.
    }
  }, [])

  return {
    ...state,
    streamRef,
    start,
    stop,
    adopt,
    toggleAudio,
    toggleVideo,
    setAudioEnabled,
    setVideoEnabled,
  }
}
