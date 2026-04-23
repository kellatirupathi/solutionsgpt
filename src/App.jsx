import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { generateSolutionArchitectResponse } from './lib/openai'

const STORAGE_KEY = 'solution-architect-gpt-chats'
const conversationStarters = [
  'Suggest the right solution for gyms to track paid members and daily attendance',
  'Use Case: Salon Problem: losing repeat customers after first visit',
  'A clinic is missing appointments and struggling with patient follow-up',
  'Help a kirana shop improve collections and customer retention',
]

function App() {
  const [businessInput, setBusinessInput] = useState('')
  const [chats, setChats] = useState([])
  const [activeChatId, setActiveChatId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadingSteps, setLoadingSteps] = useState([])
  const [loadingStepIndex, setLoadingStepIndex] = useState(0)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const messagesEndRef = useRef(null)

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) || null,
    [activeChatId, chats],
  )

  const messages = activeChat?.messages || []

  const renderedMessages = useMemo(
    () =>
      messages.map((message) =>
        message.role === 'assistant'
          ? { ...message, content: normalizeAssistantMarkdown(message.content) }
          : message,
      ),
    [messages],
  )

  useEffect(() => {
    const savedChats = loadChatsFromStorage()
    const chatIdFromPath = getChatIdFromPath()

    if (savedChats.length > 0) {
      setChats(savedChats)
      const matchingChat = savedChats.find((chat) => chat.id === chatIdFromPath)
      setActiveChatId(matchingChat?.id || savedChats[0].id)
      return
    }

    const initialChat = createNewChat()
    setChats([initialChat])
    setActiveChatId(initialChat.id)
  }, [])

  useEffect(() => {
    const closeSidebarOnDesktop = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false)
      }
    }

    closeSidebarOnDesktop()
    window.addEventListener('resize', closeSidebarOnDesktop)

    return () => window.removeEventListener('resize', closeSidebarOnDesktop)
  }, [])

  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
    }
  }, [chats])

  useEffect(() => {
    if (!activeChatId) {
      return
    }

    const nextPath = `/${activeChatId}`

    if (window.location.pathname !== nextPath) {
      window.history.replaceState({}, '', nextPath)
    }
  }, [activeChatId])

  useEffect(() => {
    if (!loading) {
      setLoadingStepIndex(0)
      return
    }

    const interval = window.setInterval(() => {
      setLoadingStepIndex((current) => (current + 1) % Math.max(loadingSteps.length, 1))
    }, 1700)

    return () => window.clearInterval(interval)
  }, [loading, loadingSteps])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading, error])

  async function handleAnalyze(overrideInput) {
    const trimmedInput = (overrideInput ?? businessInput).trim()

    if (!trimmedInput || loading || !activeChat) {
      return
    }

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmedInput,
      createdAt: new Date().toISOString(),
    }

    const nextMessages = [...messages, userMessage]

    setChats((current) =>
      current.map((chat) =>
        chat.id === activeChat.id
          ? {
              ...chat,
              title: chat.messages.length === 0 ? buildChatTitle(trimmedInput) : chat.title,
              updatedAt: new Date().toISOString(),
              messages: nextMessages,
            }
          : chat,
      ),
    )

    setBusinessInput('')
    setError('')
    setLoadingSteps(buildLoadingSteps(trimmedInput))
    setLoading(true)

    try {
      const result = await generateSolutionArchitectResponse({
        messages: nextMessages,
      })

      const assistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result,
        createdAt: new Date().toISOString(),
      }

      setChats((current) =>
        current.map((chat) =>
          chat.id === activeChat.id
            ? {
                ...chat,
                updatedAt: new Date().toISOString(),
                messages: [...nextMessages, assistantMessage],
              }
            : chat,
        ),
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleAnalyze()
    }
  }

  function handleNewChat() {
    const newChat = createNewChat()
    setChats((current) => [newChat, ...current])
    setActiveChatId(newChat.id)
    setBusinessInput('')
    setError('')
    setLoading(false)
    setLoadingSteps([])
    setIsSidebarOpen(false)
  }

  function handleDeleteChat(chatId) {
    const remainingChats = chats.filter((chat) => chat.id !== chatId)

    if (remainingChats.length === 0) {
      const replacementChat = createNewChat()
      setChats([replacementChat])
      setActiveChatId(replacementChat.id)
      setBusinessInput('')
      setError('')
      setLoading(false)
      setLoadingSteps([])
      setIsSidebarOpen(false)
      return
    }

    setChats(remainingChats)

    if (activeChatId === chatId) {
      setActiveChatId(remainingChats[0].id)
      setBusinessInput('')
      setError('')
      setLoading(false)
      setLoadingSteps([])
      setIsSidebarOpen(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <main className="flex min-h-screen w-full flex-col md:flex-row">
        <MobileHeader isSidebarOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen((value) => !value)} />

        {isSidebarOpen ? (
          <button
            type="button"
            aria-label="Close sidebar overlay"
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-slate-900/20 md:hidden"
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[260px] border-r border-slate-200 bg-white px-3 py-3 shadow-xl transition-transform md:sticky md:top-0 md:h-screen md:z-auto md:w-[290px] md:flex-none md:translate-x-0 md:border-b-0 md:bg-white/80 md:px-4 md:py-4 md:shadow-none md:backdrop-blur ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="h-full">
            <button
              type="button"
              onClick={handleNewChat}
              className="mb-3 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              New Chat
            </button>

            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                History
              </h2>
              <span className="text-xs text-slate-400">{chats.length}</span>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto overflow-x-hidden pb-1 md:max-h-[calc(100vh-110px)]">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group relative rounded-xl border transition ${
                    chat.id === activeChatId
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveChatId(chat.id)
                      setError('')
                      setIsSidebarOpen(false)
                    }}
                    className="w-full rounded-xl px-3 py-2.5 pr-9 text-left"
                  >
                    <p className="truncate text-[13px] font-medium">{chat.title}</p>
                  </button>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleDeleteChat(chat.id)
                    }}
                    className={`absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full transition ${
                      chat.id === activeChatId
                        ? 'text-slate-300 opacity-0 hover:bg-white/10 hover:text-white group-hover:opacity-100'
                        : 'text-slate-400 opacity-0 hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100'
                    }`}
                    aria-label="Delete chat"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex min-h-screen min-w-0 flex-1 flex-col">
          <div className="flex-1 px-3 pb-32 pt-16 sm:px-5 sm:pb-36 sm:pt-16 md:px-6 md:pb-40 md:pt-8 lg:px-8 lg:pt-10">
            {messages.length === 0 ? (
              <div className="flex min-h-[68vh] items-center justify-center px-2 sm:min-h-[70vh]">
                <div className="max-w-3xl text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
                    Solution Architect GPT
                  </h1>
                  <p className="mt-3 text-sm leading-7 text-slate-500 sm:mt-4 sm:text-base">
                    Analyzes any business use case and recommends the best-fit digital, AI,
                    automation, CRM, reminder, tracking, or website solution based on the actual
                    problem and revenue opportunity.
                  </p>

                  <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {conversationStarters.map((starter) => (
                      <button
                        key={starter}
                        type="button"
                        onClick={() => handleAnalyze(starter)}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <p className="line-clamp-2 leading-6">{starter}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {renderedMessages.map((message) => (
                  <section
                    key={message.id}
                    className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                  >
                    <div
                      className={
                        message.role === 'user'
                          ? 'w-auto max-w-[92%] rounded-[20px] bg-slate-900 px-4 py-3 text-[14px] leading-6 text-white shadow-sm sm:max-w-[85%] sm:rounded-[22px] sm:px-5 sm:py-3.5 md:max-w-[78%] lg:max-w-2xl'
                          : 'w-full rounded-[22px] bg-white px-4 py-4 text-slate-700 shadow-sm ring-1 ring-slate-200 sm:rounded-[24px] sm:px-5 sm:py-5 lg:rounded-[28px]'
                      }
                    >
                      {message.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        <article className="max-w-none text-[14px] leading-7 text-slate-700 sm:text-[15px] sm:leading-8">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({ children }) => (
                                <h1 className="mb-4 text-[18px] font-semibold tracking-tight text-slate-900 sm:mb-5 sm:text-[20px]">
                                  {children}
                                </h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="mb-3 mt-8 text-[16px] font-semibold tracking-tight text-slate-900 first:mt-0 sm:mb-4 sm:mt-10 sm:text-[17px]">
                                  {children}
                                </h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="mb-3 mt-6 text-[15px] font-semibold text-slate-900 sm:mt-8 sm:text-[16px]">
                                  {children}
                                </h3>
                              ),
                              p: ({ children }) => (
                                <p className="mb-4 whitespace-pre-wrap text-[14px] leading-7 text-slate-700 last:mb-0 sm:text-[15px] sm:leading-8">
                                  {children}
                                </p>
                              ),
                              ul: ({ children }) => (
                                <ul className="mb-5 list-disc space-y-2 pl-5 marker:text-slate-500 sm:pl-6">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="mb-5 list-decimal space-y-3 pl-5 marker:font-medium marker:text-slate-500 sm:pl-6">
                                  {children}
                                </ol>
                              ),
                              li: ({ children }) => (
                                <li className="pl-1 text-[14px] leading-7 text-slate-700 sm:text-[15px] sm:leading-8">
                                  {children}
                                </li>
                              ),
                              strong: ({ children }) => (
                                <strong className="font-semibold text-slate-900">{children}</strong>
                              ),
                              hr: () => <hr className="my-8 border-slate-200" />,
                              blockquote: ({ children }) => (
                                <blockquote className="my-5 rounded-r-xl border-l-4 border-slate-300 bg-slate-50 px-3 py-3 text-slate-700 sm:px-4">
                                  {children}
                                </blockquote>
                              ),
                              table: ({ children }) => (
                                <div className="mb-6 overflow-x-auto">
                                  <table className="min-w-full border-collapse text-left text-[13px] leading-6 sm:text-[14px]">
                                    {children}
                                  </table>
                                </div>
                              ),
                              thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
                              th: ({ children }) => (
                                <th className="border border-slate-200 px-3 py-2 font-semibold text-slate-900">
                                  {children}
                                </th>
                              ),
                              td: ({ children }) => (
                                <td className="border border-slate-200 px-3 py-2 align-top text-slate-700">
                                  {children}
                                </td>
                              ),
                              code: ({ inline, children }) =>
                                inline ? (
                                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px] text-slate-800">
                                    {children}
                                  </code>
                                ) : (
                                  <code className="block overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-[13px] leading-6 text-slate-100">
                                    {children}
                                  </code>
                                ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </article>
                      )}
                    </div>
                  </section>
                ))}

                {loading ? (
                  <section className="flex justify-start">
                    <div className="max-w-[92%] rounded-[18px] bg-white px-3.5 py-3 shadow-sm ring-1 ring-slate-200 sm:max-w-[85%] sm:rounded-[20px] sm:px-4">
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium leading-5 text-slate-700 sm:text-[14px]">
                            {loadingSteps[loadingStepIndex] || 'Analyzing request'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null}

                {error ? (
                  <section className="flex justify-start">
                    <div className="w-full rounded-[22px] bg-rose-50 px-4 py-4 text-sm text-rose-700 ring-1 ring-rose-200 sm:rounded-[28px] sm:px-5">
                      {error}
                    </div>
                  </section>
                ) : null}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="sticky bottom-0 px-3 pb-3 pt-2 sm:px-5 sm:pb-4 md:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
              <div className="flex items-end gap-2 rounded-[20px] bg-white px-2.5 py-2 shadow-lg ring-1 ring-slate-200 sm:gap-3 sm:rounded-[22px] sm:px-3 sm:py-2.5 md:rounded-[24px]">
                <textarea
                  value={businessInput}
                  onChange={(event) => setBusinessInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe the business problem..."
                  className="max-h-28 min-h-[42px] flex-1 resize-none border-0 bg-transparent px-2.5 py-2 text-[14px] leading-6 text-slate-900 outline-none placeholder:text-slate-400 sm:max-h-32 sm:min-h-[44px] sm:px-3 sm:py-2.5 sm:text-[15px]"
                />
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={loading || !businessInput.trim()}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:h-10 sm:w-10"
                  aria-label="Send"
                >
                  <SendIcon />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function MobileHeader({ isSidebarOpen, onToggle }) {
  return (
    <div className="fixed left-0 right-0 top-0 z-20 flex items-center justify-end border-b border-slate-200 bg-white/90 px-3 py-3 backdrop-blur md:hidden">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"
        aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
      >
        <MenuIcon />
      </button>
    </div>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

function loadChatsFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    const parsed = JSON.parse(saved || '[]')

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
  } catch {
    return []
  }
}

function createNewChat() {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    title: 'New chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
  }
}

function buildChatTitle(input) {
  const cleaned = input.replace(/\s+/g, ' ').trim()
  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}...` : cleaned
}

function formatRelativeDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function getChatIdFromPath() {
  const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '')
  return pathname || ''
}

function buildLoadingSteps(input) {
  const normalizedInput = input.toLowerCase()
  const analysisContext = resolveAnalysisContext(normalizedInput)
  const businessLabel = analysisContext.businessLabel || 'business context'
  const painLabel = analysisContext.painLabel
  const solutionLabel = analysisContext.solutionLabel

  return [
    `Reviewing ${businessLabel}`,
    painLabel ? `Investigating ${painLabel}` : 'Finding the real operational problem',
    solutionLabel ? `Matching ${solutionLabel}` : 'Matching the best-fit solution',
    'Estimating tools, pricing, and offer packaging',
    'Preparing final recommendation',
  ]
}

function resolveAnalysisContext(input) {
  const businessMatch = businessProfiles.find((profile) =>
    profile.patterns.some((pattern) => input.includes(pattern)),
  )

  const painMatch =
    businessMatch?.painProfiles.find((profile) =>
      profile.patterns.some((pattern) => input.includes(pattern)),
    ) ||
    globalPainProfiles.find((profile) => profile.patterns.some((pattern) => input.includes(pattern)))

  return {
    businessType: businessMatch?.name || '',
    businessLabel: businessMatch?.label || '',
    painLabel: painMatch?.label || '',
    solutionLabel:
      painMatch?.solutionLabel || businessMatch?.defaultSolutionLabel || '',
  }
}

const businessProfiles = [
  {
    name: 'gym',
    label: 'gym membership and retention workflow',
    patterns: ['gym', 'fitness'],
    defaultSolutionLabel: 'member management and payment reminder system',
    painProfiles: [
      {
        label: 'late renewals and payment collections',
        patterns: ['payment', 'late payment', 'renewal', 'renewals', 'due', 'dues', 'collection'],
        solutionLabel: 'member management and automated payment reminders',
      },
      {
        label: 'member attendance tracking',
        patterns: ['attendance', 'checkin', 'check-in', 'entry', 'visit'],
        solutionLabel: 'attendance tracking and member management',
      },
      {
        label: 'trial lead conversion',
        patterns: ['lead', 'trial', 'conversion', 'pipeline'],
        solutionLabel: 'lead CRM and follow-up automation',
      },
    ],
  },
  {
    name: 'clinic',
    label: 'clinic appointments and patient follow-up flow',
    patterns: ['clinic', 'doctor', 'hospital', 'patient'],
    defaultSolutionLabel: 'appointment booking and patient reminder system',
    painProfiles: [
      {
        label: 'appointments, no-shows, and patient follow-up',
        patterns: ['appointment', 'booking', 'no-show', 'follow-up', 'missed'],
        solutionLabel: 'appointment booking, reminders, and patient CRM',
      },
      {
        label: 'WhatsApp and receptionist workload',
        patterns: ['whatsapp', 'messages', 'receptionist', 'support'],
        solutionLabel: 'WhatsApp automation and patient intake workflow',
      },
    ],
  },
  {
    name: 'salon',
    label: 'salon repeat-customer and booking journey',
    patterns: ['salon', 'spa', 'beauty'],
    defaultSolutionLabel: 'loyalty and customer follow-up system',
    painProfiles: [
      {
        label: 'repeat customer retention',
        patterns: ['retention', 'repeat customer', 'repeat', 'churn', 'return', 'disappear'],
        solutionLabel: 'loyalty, rewards, and follow-up automation',
      },
      {
        label: 'appointments and missed bookings',
        patterns: ['appointment', 'booking', 'schedule', 'no-show'],
        solutionLabel: 'booking workflow and reminder automation',
      },
    ],
  },
  {
    name: 'coaching center',
    label: 'student fees, attendance, and admissions workflow',
    patterns: ['coaching', 'tuition', 'institute', 'students', 'student'],
    defaultSolutionLabel: 'fee reminder and attendance management system',
    painProfiles: [
      {
        label: 'fee collection delays',
        patterns: ['fees', 'fee', 'payment', 'dues', 'collection'],
        solutionLabel: 'fee reminder and payment tracking system',
      },
      {
        label: 'student attendance tracking',
        patterns: ['attendance', 'absent', 'class attendance'],
        solutionLabel: 'attendance tracking and reporting workflow',
      },
      {
        label: 'lead follow-up for admissions',
        patterns: ['lead', 'enquiry', 'admission', 'conversion'],
        solutionLabel: 'lead CRM and admissions follow-up',
      },
    ],
  },
  {
    name: 'kirana shop',
    label: 'kirana credit, collections, and inventory flow',
    patterns: ['kirana', 'grocery', 'retail', 'shop'],
    defaultSolutionLabel: 'credit tracking and inventory management system',
    painProfiles: [
      {
        label: 'credit dues and payment follow-up',
        patterns: ['credit', 'due', 'dues', 'collection', 'payment'],
        solutionLabel: 'credit tracking and payment reminder workflow',
      },
      {
        label: 'inventory tracking',
        patterns: ['inventory', 'stock', 'stockout', 'stock out'],
        solutionLabel: 'inventory monitoring and reorder workflow',
      },
      {
        label: 'customer retention',
        patterns: ['retention', 'repeat customer', 'loyalty'],
        solutionLabel: 'simple loyalty and customer follow-up system',
      },
    ],
  },
  {
    name: 'restaurant',
    label: 'restaurant orders and repeat-customer workflow',
    patterns: ['restaurant', 'cafe', 'food', 'dine-in', 'takeaway'],
    defaultSolutionLabel: 'WhatsApp ordering and loyalty system',
    painProfiles: [
      {
        label: 'repeat customer engagement',
        patterns: ['retention', 'repeat customer', 'loyalty'],
        solutionLabel: 'loyalty and customer follow-up automation',
      },
      {
        label: 'WhatsApp ordering and order handling',
        patterns: ['whatsapp', 'order', 'ordering', 'delivery'],
        solutionLabel: 'WhatsApp ordering and operations workflow',
      },
    ],
  },
  {
    name: 'real estate agency',
    label: 'real estate lead and follow-up pipeline',
    patterns: ['real estate', 'property', 'broker', 'brokerage'],
    defaultSolutionLabel: 'CRM and lead pipeline automation',
    painProfiles: [
      {
        label: 'lead leakage and poor follow-up',
        patterns: ['lead', 'follow-up', 'pipeline', 'conversion'],
        solutionLabel: 'lead CRM and follow-up automation',
      },
    ],
  },
  {
    name: 'digital agency',
    label: 'agency clients, billing, and delivery workflow',
    patterns: ['agency', 'freelancer', 'client project'],
    defaultSolutionLabel: 'client CRM and invoicing system',
    painProfiles: [
      {
        label: 'invoice follow-up and collections',
        patterns: ['invoice', 'billing', 'payment', 'collection'],
        solutionLabel: 'billing automation and client payment tracking',
      },
      {
        label: 'project and client coordination',
        patterns: ['project', 'client', 'task', 'delivery'],
        solutionLabel: 'client CRM and project tracker',
      },
    ],
  },
  {
    name: 'contractor business',
    label: 'contractor payments, milestones, and site operations',
    patterns: ['contractor', 'construction', 'site', 'builder'],
    defaultSolutionLabel: 'milestone tracking and payment workflow',
    painProfiles: [
      {
        label: 'milestone billing and collections',
        patterns: ['payment', 'milestone', 'invoice', 'billing'],
        solutionLabel: 'milestone tracker and payment reminders',
      },
      {
        label: 'site attendance and progress tracking',
        patterns: ['attendance', 'labour', 'labor', 'site progress'],
        solutionLabel: 'site attendance and project tracking system',
      },
    ],
  },
  {
    name: 'photography business',
    label: 'client communication and delivery workflow',
    patterns: ['photographer', 'photography', 'wedding photographer'],
    defaultSolutionLabel: 'client portal and follow-up workflow',
    painProfiles: [
      {
        label: 'scattered WhatsApp communication',
        patterns: ['whatsapp', 'chaotic', 'messages', 'follow-up'],
        solutionLabel: 'client portal and communication workflow',
      },
    ],
  },
  {
    name: 'auto workshop',
    label: 'service jobs and customer reminder workflow',
    patterns: ['workshop', 'garage', 'mechanic', 'service center'],
    defaultSolutionLabel: 'digital job card and service reminder system',
    painProfiles: [
      {
        label: 'service reminder follow-up',
        patterns: ['service reminder', 'follow-up', 'repeat service'],
        solutionLabel: 'service reminder and customer CRM',
      },
      {
        label: 'job card and service tracking',
        patterns: ['job card', 'repair', 'vehicle', 'service'],
        solutionLabel: 'digital job card and operations tracker',
      },
    ],
  },
  {
    name: 'logistics business',
    label: 'delivery tracking and proof-of-delivery workflow',
    patterns: ['logistics', 'delivery', 'courier', 'dispatch'],
    defaultSolutionLabel: 'delivery management and invoicing system',
    painProfiles: [
      {
        label: 'delivery tracking and proof of delivery',
        patterns: ['tracking', 'proof of delivery', 'pod', 'dispatch'],
        solutionLabel: 'delivery tracking and proof-of-delivery workflow',
      },
      {
        label: 'invoicing and collections',
        patterns: ['invoice', 'billing', 'payment', 'collection'],
        solutionLabel: 'invoicing and collection automation',
      },
    ],
  },
]

const globalPainProfiles = [
  {
    label: 'payment collections',
    patterns: ['payment', 'late payment', 'due', 'dues', 'collection', 'credit'],
    solutionLabel: 'payment reminder and collection workflow',
  },
  {
    label: 'customer retention',
    patterns: ['retention', 'repeat customer', 'churn', 'renewal'],
    solutionLabel: 'customer follow-up and retention system',
  },
  {
    label: 'lead conversion',
    patterns: ['lead', 'conversion', 'pipeline'],
    solutionLabel: 'lead management and follow-up workflow',
  },
  {
    label: 'appointments and no-shows',
    patterns: ['appointment', 'booking', 'no-show'],
    solutionLabel: 'appointment reminders and booking workflow',
  },
  {
    label: 'inventory tracking',
    patterns: ['inventory', 'stock'],
    solutionLabel: 'inventory management workflow',
  },
  {
    label: 'attendance tracking',
    patterns: ['attendance', 'staff attendance'],
    solutionLabel: 'attendance tracking workflow',
  },
  {
    label: 'WhatsApp workload',
    patterns: ['whatsapp', 'messages', 'support'],
    solutionLabel: 'WhatsApp automation workflow',
  },
  {
    label: 'billing operations',
    patterns: ['billing', 'invoice'],
    solutionLabel: 'billing and invoicing workflow',
  },
]

function detectBusinessType(input) {
  const analysisContext = resolveAnalysisContext(input)
  return analysisContext.businessType
}

function detectPainLabel(input) {
  const analysisContext = resolveAnalysisContext(input)
  return analysisContext.painLabel
}

function detectSolutionLabel(input) {
  const analysisContext = resolveAnalysisContext(input)
  return analysisContext.solutionLabel
}

function normalizeAssistantMarkdown(content) {
  if (!content) {
    return ''
  }

  return content
    .split('\n')
    .map((line) => convertStandaloneBoldToHeading(stripLeadingEmoji(line)))
    .join('\n')
}

function stripLeadingEmoji(line) {
  return line.replace(
    /^(\s*(?:[-*]\s+)?)(?:[\p{Extended_Pictographic}\uFE0F\u200D]+(?:\s+|$))+?/u,
    '$1',
  )
}

function convertStandaloneBoldToHeading(line) {
  const trimmed = line.trim()
  const match = trimmed.match(/^\*\*(.+?)\*\*$/)

  if (!match) {
    return line
  }

  return `## ${match[1].trim()}`
}

export default App
