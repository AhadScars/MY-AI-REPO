export interface Participant {
  id: string
  name: string
  inLobby?: boolean
  audioEnabled: boolean
  videoEnabled: boolean
  isScreenSharing: boolean
  joinedAt?: number
}

export interface RoomSummary {
  id: string
  hostId: string | null
  participantCount: number
  participants: Participant[]
}

export interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  text: string
  timestamp: number
}

export interface PeerStream {
  id: string
  name: string
  stream: MediaStream | null
  audioEnabled: boolean
  videoEnabled: boolean
  isScreenSharing: boolean
}

export type SignalPayload =
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit | null }
