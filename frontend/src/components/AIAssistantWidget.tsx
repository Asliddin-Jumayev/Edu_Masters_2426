import { useState, useRef, useEffect } from 'react'
import { Bot, Send, Sparkles, X, Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import { cn } from '@/lib/utils'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: string
}

const QUICK_PROMPTS = [
  "Qarzdorlikni kamaytirish usullari",
  "Sinov darsidan to'lovga konversiyani oshirish",
  "O'quvchilarni jalb qilish bo'yicha maslahat",
]

export function AIAssistantWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Assalomu alaykum! Men Edu Masters AI yordamchisiman. Kurslar, o'quvchilar tahlili yoki CRM boshqaruvi bo'yicha qanday yordam bera olaman?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, open])

  const handleSend = async (textToSend?: string) => {
    const q = textToSend || input
    if (!q.trim() || loading) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: q.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await api.post<{ prompt: string; response: string }>('/ai/assistant', { prompt: q.trim() })
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: res.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: "Kechirasiz, so'rovni bajarishda xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="AI Yordamchi"
        className={cn(
          "fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300",
          "bg-gradient-to-tr from-brand to-violet-600 text-white hover:scale-105 active:scale-95",
          open && "rotate-90 scale-90"
        )}
      >
        {open ? <X className="size-6" /> : <Sparkles className="size-6 animate-pulse" />}
      </button>

      {/* Chat Window Dialog */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 flex h-[520px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line bg-gradient-to-r from-brand/10 via-violet-500/10 to-transparent px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-xl bg-brand text-brand-fg shadow-sm">
                <Bot className="size-5" />
              </div>
              <div>
                <div className="font-semibold text-sm leading-tight">Edu Masters AI</div>
                <div className="text-[11px] text-muted flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  Onlayn maslahatchi
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-muted hover:bg-sunken hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Messages Body */}
          <div ref={scrollRef} className="scroll-thin flex-1 space-y-3 overflow-y-auto p-4 text-[13px]">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm leading-relaxed whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-brand text-brand-fg rounded-br-xs'
                      : 'bg-sunken text-foreground border border-line rounded-bl-xs',
                  )}
                >
                  {m.text}
                </div>
                <span className="mt-1 px-1 text-[10px] text-muted">{m.timestamp}</span>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <Loader2 className="size-4 animate-spin text-brand" />
                AI javob tayyorlamoqda...
              </div>
            )}
          </div>

          {/* Quick Prompts */}
          {messages.length <= 2 && (
            <div className="border-t border-line/60 bg-sunken/40 px-3 py-2 flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(p)}
                  className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-muted hover:border-brand hover:text-brand transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-center gap-2 border-t border-line bg-surface p-2.5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Savolingizni yozing..."
              className="flex-1 rounded-xl bg-sunken px-3.5 py-2 text-sm outline-none placeholder:text-muted focus:ring-1 focus:ring-brand"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="grid size-9 place-items-center rounded-xl bg-brand text-brand-fg disabled:opacity-40 transition-opacity"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
