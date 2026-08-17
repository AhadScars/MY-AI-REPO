import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Send, X, MessageSquare } from 'lucide-react'
import type { ChatMessage } from '../types'

interface ChatPanelProps {
  open: boolean
  onClose: () => void
  messages: ChatMessage[]
  selfId: string | null
  onSend: (text: string) => void
  mobile?: boolean
}

export function ChatPanel({ open, onClose, messages, selfId, onSend, mobile }: ChatPanelProps) {
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (!open) return null

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    onSend(value)
    setText('')
  }

  const panel = (
    <aside
      className={`flex h-full w-full flex-col border-l border-white/10 bg-surface-2/95 backdrop-blur-xl ${
        mobile ? '' : 'max-w-sm'
      }`}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-baithak-300" />
          <h2 className="font-display text-sm font-semibold tracking-wide text-white">Live chat</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="baithak-scroll flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-500">
            <MessageSquare className="h-8 w-8 opacity-40" />
            <p>No messages yet. Say hello to the baithak!</p>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.senderId === selfId
          return (
            <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <span className="mb-1 px-1 text-[11px] font-medium text-slate-500">
                {mine ? 'You' : m.senderName}
                <span className="ml-1 font-normal opacity-70">
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </span>
              <div
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  mine
                    ? 'rounded-br-md bg-baithak-600 text-white'
                    : 'rounded-bl-md bg-surface-3 text-slate-100 ring-1 ring-white/5'
                }`}
              >
                {m.text}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2 rounded-xl bg-surface-3 ring-1 ring-white/10 focus-within:ring-baithak-500/50">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            maxLength={2000}
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="m-1 rounded-lg bg-baithak-600 p-2 text-white transition enabled:hover:bg-baithak-500 disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </aside>
  )

  if (mobile) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-surface/80 backdrop-blur-sm">
        <div className="mt-auto h-[75vh] overflow-hidden rounded-t-3xl border border-white/10 shadow-2xl">
          {panel}
        </div>
      </div>
    )
  }

  return panel
}
