import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import * as XLSX from 'xlsx'
import { streamSolutionArchitectResponse } from './lib/openai'
import { RealtimeVoiceSession } from './lib/realtimeVoice'
import { buildVoiceInstructions } from './lib/knowledgeBase'

const OPENAI_REALTIME_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const OPENAI_REALTIME_MODEL =
  import.meta.env.VITE_OPENAI_REALTIME_MODEL || 'gpt-realtime'
const OPENAI_REALTIME_VOICE = import.meta.env.VITE_OPENAI_REALTIME_VOICE || 'alloy'
const VOICE_PRIOR_MESSAGE_LIMIT = 10

const STORAGE_KEY = 'solution-architect-gpt-chats'
const MAX_ATTACHMENT_CHARS = 12000
const MAX_TOTAL_ATTACHMENT_CHARS = 24000
const ACCENT_INPUT_SURFACE_CLASS =
  'border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] ring-1 ring-black/5'
const ACCENT_ICON_BUTTON_CLASS =
  'bg-transparent text-slate-500 transition hover:bg-slate-100 hover:text-slate-700'
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
  const [attachedFiles, setAttachedFiles] = useState([])
  const [isParsingFiles, setIsParsingFiles] = useState(false)
  const [attachmentError, setAttachmentError] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [speechError, setSpeechError] = useState('')
  const [streamStatus, setStreamStatus] = useState('')
  const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false)
  const [voiceState, setVoiceState] = useState('idle')
  const [voiceError, setVoiceError] = useState('')
  const [isVoiceMuted, setIsVoiceMuted] = useState(false)
  const messagesEndRef = useRef(null)
  const requestAbortRef = useRef(null)
  const fileInputRef = useRef(null)
  const textAreaRef = useRef(null)
  const speechRecognitionRef = useRef(null)
  const speechFinalTranscriptRef = useRef('')
  const speechShouldContinueRef = useRef(false)
  const uploadedFileIdsRef = useRef([])
  const voiceSessionRef = useRef(null)
  const voiceAssistantMessageIdRef = useRef(null)
  const voiceChatIdRef = useRef(null)
  const voicePendingUserMessageIdRef = useRef(null)
  const voiceCurrentTurnHasUserMessageRef = useRef(false)

  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) || null,
    [activeChatId, chats],
  )

  const messages = activeChat?.messages || []

  const renderedMessages = useMemo(
    () =>
      messages
        .filter((message) => message.role !== 'user' || message.content)
        .map((message) =>
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

  useEffect(() => {
    const RecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition
    setSpeechSupported(Boolean(RecognitionApi))
  }, [])

  useEffect(() => {
    const textArea = textAreaRef.current

    if (!textArea) {
      return
    }

    textArea.style.height = '0px'
    textArea.style.height = `${Math.min(textArea.scrollHeight, 144)}px`
  }, [businessInput])

  useEffect(() => () => {
    requestAbortRef.current?.abort()
    speechShouldContinueRef.current = false
    speechRecognitionRef.current?.stop()
    voiceSessionRef.current?.stop()
    voiceSessionRef.current = null
  }, [])

  async function handleAnalyze(overrideInput) {
    const trimmedInput = (overrideInput ?? businessInput).trim()
    const composedInput = buildComposedInput({
      input: trimmedInput,
      attachedFiles,
    })

    if ((!trimmedInput && attachedFiles.length === 0) || loading || !activeChat) {
      return
    }

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: composedInput,
      createdAt: new Date().toISOString(),
    }

    const assistantMessageId = crypto.randomUUID()
    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      isStreaming: true,
    }

    const nextMessages = [...messages, userMessage]
    const optimisticMessages = [...nextMessages, assistantMessage]

    setChats((current) =>
      current.map((chat) =>
        chat.id === activeChat.id
          ? {
              ...chat,
              title: chat.messages.length === 0 ? buildChatTitle(trimmedInput || attachedFiles[0]?.name || 'New request') : chat.title,
              updatedAt: new Date().toISOString(),
              messages: optimisticMessages,
            }
          : chat,
      ),
    )

    setBusinessInput('')
    setAttachedFiles([])
    uploadedFileIdsRef.current = []
    setAttachmentError('')
    setError('')
    setSpeechError('')
    setStreamStatus('')
    setLoadingSteps(buildLoadingSteps(trimmedInput))
    setLoading(true)

    requestAbortRef.current?.abort()
    const abortController = new AbortController()
    requestAbortRef.current = abortController

    try {
      let streamedContent = ''

      const result = await streamSolutionArchitectResponse({
        messages: nextMessages,
        signal: abortController.signal,
        onStatus: (status) => {
          setStreamStatus(status || '')
        },
        onChunk: (chunk) => {
          streamedContent += chunk

          setChats((current) =>
            current.map((chat) =>
              chat.id === activeChat.id
                ? {
                    ...chat,
                    updatedAt: new Date().toISOString(),
                    messages: chat.messages.map((message) =>
                      message.id === assistantMessageId
                        ? {
                            ...message,
                            content: streamedContent,
                            isStreaming: true,
                          }
                        : message,
                    ),
                  }
                : chat,
            ),
          )
        },
        onReplace: (nextContent) => {
          streamedContent = nextContent

          setChats((current) =>
            current.map((chat) =>
              chat.id === activeChat.id
                ? {
                    ...chat,
                    updatedAt: new Date().toISOString(),
                    messages: chat.messages.map((message) =>
                      message.id === assistantMessageId
                        ? {
                            ...message,
                            content: nextContent,
                            isStreaming: true,
                          }
                        : message,
                    ),
                  }
                : chat,
            ),
          )
        },
      })

      setChats((current) =>
        current.map((chat) =>
          chat.id === activeChat.id
            ? {
                ...chat,
                updatedAt: new Date().toISOString(),
                messages: chat.messages.map((message) =>
                  message.id === assistantMessageId
                    ? {
                        ...message,
                        content: result,
                        isStreaming: false,
                      }
                    : message,
                ),
              }
            : chat,
        ),
      )
    } catch (err) {
      if (err.name === 'AbortError') {
        return
      }

      setChats((current) =>
        current.map((chat) =>
          chat.id === activeChat.id
            ? {
                ...chat,
                updatedAt: new Date().toISOString(),
                messages: chat.messages.filter((message) => message.id !== assistantMessageId),
              }
            : chat,
        ),
      )
      setError(err.message)
    } finally {
      if (requestAbortRef.current === abortController) {
        requestAbortRef.current = null
      }
      setStreamStatus('')
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
    requestAbortRef.current?.abort()
    stopSpeechRecognition()
    const newChat = createNewChat()
    setChats((current) => [newChat, ...current])
    setActiveChatId(newChat.id)
    setBusinessInput('')
    setAttachedFiles([])
    uploadedFileIdsRef.current = []
    setAttachmentError('')
    setError('')
    setSpeechError('')
    setStreamStatus('')
    setLoading(false)
    setLoadingSteps([])
    setIsSidebarOpen(false)
  }

  function handleDeleteChat(chatId) {
    if (activeChatId === chatId) {
      requestAbortRef.current?.abort()
      stopSpeechRecognition()
    }

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
      setAttachedFiles([])
      uploadedFileIdsRef.current = []
      setAttachmentError('')
      setError('')
      setSpeechError('')
      setStreamStatus('')
      setLoading(false)
      setLoadingSteps([])
      setIsSidebarOpen(false)
    }
  }

  async function handleFileSelection(event) {
    const files = Array.from(event.target.files || [])

    if (files.length === 0) {
      return
    }

    const nextPendingFiles = files
      .filter((file) => !uploadedFileIdsRef.current.includes(buildFileFingerprint(file)))
      .map((file) => buildPendingAttachmentRecord(file))

    if (nextPendingFiles.length === 0) {
      setAttachmentError('Those files are already attached.')
      event.target.value = ''
      return
    }

    setSpeechError('')
    setAttachmentError('')
    setIsParsingFiles(true)
    uploadedFileIdsRef.current = [
      ...uploadedFileIdsRef.current,
      ...nextPendingFiles.map((file) => file.fingerprint),
    ]

    setAttachedFiles((current) => trimAttachments([...current, ...nextPendingFiles]))

    try {
      for (const pendingFile of nextPendingFiles) {
        const parsedFile = await parseAttachmentFile(pendingFile.file)

        setAttachedFiles((current) =>
          trimAttachments(
            current.map((file) => (file.id === pendingFile.id ? parsedFile : file)),
          ),
        )
      }
    } catch {
      setAttachmentError('Some files could not be fully processed.')
    } finally {
      setIsParsingFiles(false)
    }

    event.target.value = ''
  }

  function handleRemoveAttachedFile(fileId) {
    setAttachedFiles((current) => {
      const fileToRemove = current.find((file) => file.id === fileId)

      if (fileToRemove?.fingerprint) {
        uploadedFileIdsRef.current = uploadedFileIdsRef.current.filter(
          (fingerprint) => fingerprint !== fileToRemove.fingerprint,
        )
      }

      return current.filter((file) => file.id !== fileId)
    })
  }

  function handleOpenFilePicker() {
    fileInputRef.current?.click()
  }

  function handleSpeechToggle() {
    if (isListening) {
      stopSpeechRecognition()
      return
    }

    const RecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!RecognitionApi) {
      setSpeechError('Speech-to-text is not supported in this browser.')
      return
    }

    speechShouldContinueRef.current = true
    const recognition = new RecognitionApi()
    recognition.lang = 'en-IN'
    recognition.interimResults = true
    recognition.continuous = true

    speechFinalTranscriptRef.current = businessInput.trim()
      ? `${businessInput.trim()} `
      : ''

    recognition.onstart = () => {
      setIsListening(true)
      setSpeechError('')
    }

    recognition.onresult = (event) => {
      let interimTranscript = ''
      let finalTranscript = speechFinalTranscriptRef.current

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result[0]?.transcript || ''

        if (result.isFinal) {
          finalTranscript += `${transcript.trim()} `
        } else {
          interimTranscript += transcript
        }
      }

      speechFinalTranscriptRef.current = finalTranscript
      setBusinessInput(`${finalTranscript}${interimTranscript}`.trim())
    }

    recognition.onerror = (event) => {
      speechShouldContinueRef.current = false
      setSpeechError(getSpeechErrorMessage(event.error))
      setIsListening(false)
    }

    recognition.onend = () => {
      const shouldRestart = speechShouldContinueRef.current
      speechRecognitionRef.current = null
      setIsListening(false)

      if (shouldRestart) {
        window.setTimeout(() => {
          if (!speechShouldContinueRef.current) {
            return
          }

          handleSpeechToggle()
        }, 150)
        return
      }

    }

    speechRecognitionRef.current = recognition
    recognition.start()
  }

  function stopSpeechRecognition() {
    speechShouldContinueRef.current = false
    speechRecognitionRef.current?.stop()
    speechRecognitionRef.current = null
    setIsListening(false)
  }

  function appendVoiceUserTurn(transcript) {
    const chatId = voiceChatIdRef.current
    if (!chatId) return

    voiceCurrentTurnHasUserMessageRef.current = true

    const pendingId = voicePendingUserMessageIdRef.current
    if (pendingId) {
      // Fill in the placeholder that was inserted before transcription arrived
      voicePendingUserMessageIdRef.current = null
      setChats((current) =>
        current.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                title: chat.title === 'Voice chat' ? buildChatTitle(transcript) : chat.title,
                updatedAt: new Date().toISOString(),
                messages: chat.messages.map((message) =>
                  message.id === pendingId ? { ...message, content: transcript } : message,
                ),
              }
            : chat,
        ),
      )
      return
    }

    // Transcription arrived before assistant deltas — safe to append directly
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: transcript,
      createdAt: new Date().toISOString(),
    }

    setChats((current) =>
      current.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              title: chat.title === 'Voice chat' ? buildChatTitle(transcript) : chat.title,
              updatedAt: new Date().toISOString(),
              messages: [...chat.messages, userMessage],
            }
          : chat,
      ),
    )
  }

  function applyVoiceAssistantDelta(_delta, fullTranscript) {
    const chatId = voiceChatIdRef.current
    if (!chatId) return

    let assistantId = voiceAssistantMessageIdRef.current

    if (!assistantId) {
      assistantId = crypto.randomUUID()
      voiceAssistantMessageIdRef.current = assistantId

      const assistantMessage = {
        id: assistantId,
        role: 'assistant',
        content: fullTranscript,
        createdAt: new Date().toISOString(),
        isStreaming: true,
      }

      if (!voiceCurrentTurnHasUserMessageRef.current) {
        // Transcription hasn't arrived yet — insert an empty user placeholder
        // BEFORE the assistant message so the chat stays in chronological order.
        const placeholderId = crypto.randomUUID()
        voicePendingUserMessageIdRef.current = placeholderId

        const placeholder = {
          id: placeholderId,
          role: 'user',
          content: '',
          createdAt: new Date().toISOString(),
        }

        setChats((current) =>
          current.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  updatedAt: new Date().toISOString(),
                  messages: [...chat.messages, placeholder, assistantMessage],
                }
              : chat,
          ),
        )
      } else {
        // Transcription already in chat — just append assistant message
        setChats((current) =>
          current.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  updatedAt: new Date().toISOString(),
                  messages: [...chat.messages, assistantMessage],
                }
              : chat,
          ),
        )
      }
      return
    }

    setChats((current) =>
      current.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              updatedAt: new Date().toISOString(),
              messages: chat.messages.map((message) =>
                message.id === assistantId
                  ? { ...message, content: fullTranscript, isStreaming: true }
                  : message,
              ),
            }
          : chat,
      ),
    )
  }

  function finalizeVoiceAssistantTurn(finalTranscript) {
    const chatId = voiceChatIdRef.current
    const assistantId = voiceAssistantMessageIdRef.current

    if (!chatId) {
      return
    }

    if (!assistantId) {
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: finalTranscript,
        createdAt: new Date().toISOString(),
        isStreaming: false,
      }

      setChats((current) =>
        current.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                updatedAt: new Date().toISOString(),
                messages: [...chat.messages, assistantMessage],
              }
            : chat,
        ),
      )
      return
    }

    setChats((current) =>
      current.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              updatedAt: new Date().toISOString(),
              messages: chat.messages.map((message) =>
                message.id === assistantId
                  ? { ...message, content: finalTranscript, isStreaming: false }
                  : message,
              ),
            }
          : chat,
      ),
    )

    voiceAssistantMessageIdRef.current = null
  }

  async function handleOpenVoiceMode() {
    if (isVoiceModeOpen) {
      return
    }

    if (!OPENAI_REALTIME_API_KEY) {
      setVoiceError(
        'Voice mode needs an OpenAI API key. Set VITE_OPENAI_API_KEY in your .env file and restart the dev server.',
      )
      setIsVoiceModeOpen(true)
      setVoiceState('error')
      return
    }

    requestAbortRef.current?.abort()
    stopSpeechRecognition()

    let chatForVoice = activeChat

    if (!chatForVoice) {
      chatForVoice = createNewChat()
      setChats((current) => [chatForVoice, ...current])
      setActiveChatId(chatForVoice.id)
    }

    const isEmptyChat = (chatForVoice.messages || []).length === 0
    if (isEmptyChat) {
      setChats((current) =>
        current.map((chat) =>
          chat.id === chatForVoice.id
            ? { ...chat, title: 'Voice chat', updatedAt: new Date().toISOString() }
            : chat,
        ),
      )
    }

    voiceChatIdRef.current = chatForVoice.id
    voiceAssistantMessageIdRef.current = null
    voicePendingUserMessageIdRef.current = null
    voiceCurrentTurnHasUserMessageRef.current = false

    setVoiceError('')
    setVoiceState('connecting')
    setIsVoiceModeOpen(true)

    const priorMessages = (chatForVoice.messages || [])
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .filter((message) => message.content?.trim())
      .slice(-VOICE_PRIOR_MESSAGE_LIMIT)
      .map((message) => ({ role: message.role, content: message.content }))

    const session = new RealtimeVoiceSession({
      apiKey: OPENAI_REALTIME_API_KEY,
      model: OPENAI_REALTIME_MODEL,
      voice: OPENAI_REALTIME_VOICE,
      instructions: buildVoiceInstructions(),
      priorMessages,
      onUserTranscript: (transcript) => {
        appendVoiceUserTurn(transcript)
      },
      onAssistantDelta: (delta, fullTranscript) => {
        applyVoiceAssistantDelta(delta, fullTranscript)
      },
      onAssistantDone: (finalTranscript) => {
        finalizeVoiceAssistantTurn(finalTranscript)
      },
      onStateChange: (nextState) => {
        if (nextState === 'speaking') {
          voiceCurrentTurnHasUserMessageRef.current = false
        }
        setVoiceState(nextState)
      },
      onError: (error) => {
        setVoiceError(error?.message || 'Voice session failed.')
        setVoiceState('error')
      },
    })

    voiceSessionRef.current = session
    await session.start()
  }

  function handleCloseVoiceMode() {
    voiceSessionRef.current?.stop()
    voiceSessionRef.current = null

    // Drop any unfilled placeholder user message left over from a cancelled turn
    const chatId = voiceChatIdRef.current
    const pendingId = voicePendingUserMessageIdRef.current
    if (chatId && pendingId) {
      setChats((current) =>
        current.map((chat) =>
          chat.id === chatId
            ? { ...chat, messages: chat.messages.filter((m) => m.id !== pendingId || m.content) }
            : chat,
        ),
      )
    }

    voiceChatIdRef.current = null
    voiceAssistantMessageIdRef.current = null
    voicePendingUserMessageIdRef.current = null
    voiceCurrentTurnHasUserMessageRef.current = false
    setIsVoiceModeOpen(false)
    setVoiceState('idle')
    setVoiceError('')
    setIsVoiceMuted(false)
  }

  function handleVoiceInterrupt() {
    voiceSessionRef.current?.interrupt()
  }

  function handleToggleVoiceMute() {
    setIsVoiceMuted((current) => {
      const next = !current
      voiceSessionRef.current?.setMuted(next)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="flex min-h-screen w-full flex-col md:flex-row">
        <MobileHeader
          isSidebarOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((value) => !value)}
          onNewChat={handleNewChat}
        />

        {isSidebarOpen ? (
          <button
            type="button"
            aria-label="Close sidebar overlay"
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-sm md:hidden"
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-slate-200 bg-[#f9fafb] px-3 py-3 shadow-xl transition-transform md:sticky md:top-0 md:h-screen md:w-[260px] md:flex-none md:translate-x-0 md:shadow-none ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="mb-3 flex items-center gap-2.5 px-2 pt-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-sm">
                <SparkIcon className="h-4 w-4" />
              </div>
              <p className="truncate text-[14px] font-semibold tracking-tight text-slate-900">
                Solution Architect
              </p>
            </div>

            <button
              type="button"
              onClick={handleNewChat}
              className="mb-5 inline-flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13.5px] font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 hover:shadow"
            >
              <ComposeIcon />
              <span>New chat</span>
            </button>

            <div className="mb-1.5 flex items-center justify-between px-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Recent
              </h2>
              {chats.length > 0 ? (
                <span className="text-[11px] text-slate-400">{chats.length}</span>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden pb-2">
              <div className="flex flex-col gap-0.5">
                {chats.map((chat) => (
                  <div key={chat.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveChatId(chat.id)
                        setError('')
                        setIsSidebarOpen(false)
                      }}
                      className={`block w-full rounded-lg px-2.5 py-2 pr-9 text-left text-[13.5px] leading-5 transition ${
                        chat.id === activeChatId
                          ? 'bg-white font-medium text-slate-900 shadow-sm ring-1 ring-slate-200'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <p className="truncate">{chat.title}</p>
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleDeleteChat(chat.id)
                      }}
                      className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 opacity-0 transition hover:bg-slate-200/70 hover:text-slate-700 group-hover:opacity-100"
                      aria-label="Delete chat"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-2 border-t border-slate-200/70 pt-3">
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-100"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[10.5px] font-semibold uppercase text-white shadow-sm">
                  SA
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-slate-700">
                    Solution Architect
                  </p>
                </div>
              </button>
            </div>
          </div>
        </aside>

        <section className="flex min-h-screen min-w-0 flex-1 flex-col">
          <div className="flex-1 px-4 pb-36 pt-16 sm:px-6 sm:pb-40 sm:pt-16 md:px-8 md:pb-40 md:pt-10 lg:px-10 lg:pt-12">
            {messages.length === 0 ? (
              <div className="mx-auto flex min-h-[68vh] max-w-3xl items-center justify-center">
                <div className="w-full text-center">
                  <h1 className="text-[26px] font-semibold tracking-tight text-slate-900 sm:text-[30px] md:text-[34px]">
                    How can I help today?
                  </h1>
                  <p className="mx-auto mt-3 max-w-xl text-[14px] leading-6 text-slate-500 sm:mt-4 sm:text-[15px] sm:leading-7">
                    Describe a business problem and get the best-fit digital, automation,
                    CRM, or website solution.
                  </p>

                  <div className="mt-9 grid grid-cols-1 gap-2 sm:mt-12 sm:grid-cols-2 sm:gap-2.5">
                    {conversationStarters.map((starter, index) => (
                      <button
                        key={starter}
                        type="button"
                        onClick={() => handleAnalyze(starter)}
                        className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 transition group-hover:bg-white group-hover:text-slate-700">
                          <StarterIcon index={index} />
                        </span>
                        <span className="flex-1 text-[13px] leading-5 text-slate-700 sm:text-[13.5px]">
                          {starter}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-auto w-full max-w-3xl space-y-5 sm:space-y-6 lg:max-w-3xl xl:max-w-4xl">
                {renderedMessages.map((message) => (
                  <section
                    key={message.id}
                    className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                  >
                    <div
                      className={
                        message.role === 'user'
                          ? 'w-auto max-w-[88%] rounded-3xl bg-slate-100 px-4 py-2.5 text-[14px] leading-6 text-slate-900 sm:max-w-[80%] sm:px-5 sm:py-3 sm:text-[15px] md:max-w-[70%]'
                          : 'w-full px-0 py-1 text-slate-800 sm:py-2'
                      }
                    >
                      {message.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        <article className="max-w-none text-[14.5px] leading-7 text-slate-800 sm:text-[15.5px] sm:leading-[1.75]">
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

                {loading && !findStreamingMessage(messages)?.content ? (
                  <section className="flex justify-start py-1">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                      </div>
                      <p className="text-[13px] font-medium leading-5 text-slate-500 sm:text-[13.5px]">
                        {findStreamingMessage(messages)?.content
                          ? streamStatus || 'Generating response'
                          : loadingSteps[loadingStepIndex] || 'Analyzing request'}
                      </p>
                    </div>
                  </section>
                ) : null}

                {error ? (
                  <section className="flex justify-start">
                    <div className="w-full rounded-2xl bg-rose-50 px-4 py-3.5 text-[13.5px] leading-6 text-rose-700 ring-1 ring-rose-200">
                      {error}
                    </div>
                  </section>
                ) : null}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-10 bg-white px-3 pb-2 pt-3 sm:px-5 sm:pt-4 md:left-[260px] md:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl xl:max-w-4xl">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelection}
                accept=".txt,.md,.json,.csv,.pdf,.doc,.docx,.rtf,.xlsx,.xls,.ppt,.pptx"
                className="hidden"
              />
              <div
                className={`rounded-3xl border px-2 py-2 sm:px-2.5 sm:py-2 ${ACCENT_INPUT_SURFACE_CLASS}`}
              >
                {attachedFiles.length > 0 && !isVoiceModeOpen ? (
                  <div className="mb-2 flex flex-wrap gap-2 px-2 pt-1">
                    {attachedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] text-slate-700"
                      >
                        <FileIcon />
                        <span className="max-w-[160px] truncate">{file.name}</span>
                        <span className="text-slate-400">{file.statusLabel}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachedFile(file.id)}
                          className="text-slate-400 transition hover:text-slate-700"
                          aria-label={`Remove ${file.name}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {isVoiceModeOpen ? (
                  <VoiceBar
                    state={voiceState}
                    error={voiceError}
                    isMuted={isVoiceMuted}
                    sessionRef={voiceSessionRef}
                    onEnd={handleCloseVoiceMode}
                    onInterrupt={handleVoiceInterrupt}
                    onToggleMute={handleToggleVoiceMute}
                  />
                ) : (
                <div className="flex items-end gap-1 sm:gap-1.5">
                  <button
                    type="button"
                    onClick={handleOpenFilePicker}
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${ACCENT_ICON_BUTTON_CLASS}`}
                    aria-label="Attach files"
                    title="Attach files"
                  >
                    <PlusIcon />
                  </button>

                  <textarea
                    ref={textAreaRef}
                    value={businessInput}
                    onChange={(event) => setBusinessInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything"
                    className="min-h-[40px] max-h-36 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2 py-2 text-[14.5px] leading-6 text-slate-900 outline-none placeholder:text-slate-400 sm:min-h-[44px] sm:text-[15px]"
                    rows={1}
                  />

                  <button
                    type="button"
                    onClick={handleSpeechToggle}
                    disabled={!speechSupported}
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition sm:h-10 sm:w-10 ${
                      isListening
                        ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
                        : `disabled:cursor-not-allowed disabled:text-slate-300 ${ACCENT_ICON_BUTTON_CLASS}`
                    }`}
                    aria-label={isListening ? 'Stop dictation' : 'Dictate'}
                    title="Dictate"
                  >
                    <MicIcon />
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenVoiceMode}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm transition hover:bg-slate-800 sm:h-10 sm:w-10"
                    aria-label="Use voice"
                    title="Use voice"
                  >
                    <VoiceWaveIcon />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAnalyze()}
                    disabled={loading || (!businessInput.trim() && attachedFiles.length === 0)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none sm:h-10 sm:w-10"
                    aria-label="Send"
                    title="Send"
                  >
                    <SendArrowIcon />
                  </button>
                </div>
                )}
              </div>

              {isParsingFiles || attachmentError || speechError ? (
                <div className="mt-1.5 flex items-center justify-between px-1 text-[11.5px] text-slate-400">
                  <div>
                    {isParsingFiles ? (
                      <span>Processing attached files...</span>
                    ) : attachmentError ? (
                      <span className="text-rose-600">{attachmentError}</span>
                    ) : speechError ? (
                      <span className="text-rose-600">{speechError}</span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>

    </div>
  )
}

function VoiceBar({ state, error, isMuted, sessionRef, onEnd, onInterrupt, onToggleMute }) {
  const barsRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    let lastUpdate = 0
    const tick = (now) => {
      if (now - lastUpdate > 50) {
        lastUpdate = now
        const session = sessionRef?.current
        const bars = barsRef.current?.children
        if (bars) {
          const inputLevel = session?.getInputLevel?.() || 0
          const outputLevel = session?.getOutputLevel?.() || 0
          const level = Math.max(inputLevel, outputLevel)
          const peaks = [0.4, 0.7, 1.0, 0.7, 0.4]
          for (let i = 0; i < bars.length; i++) {
            const h = Math.max(4, Math.round(peaks[i] * level * 22 + peaks[i] * 6))
            bars[i].style.height = `${h}px`
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [sessionRef])

  const isError = state === 'error' || Boolean(error)
  const isConnecting = state === 'connecting'
  const isSpeaking = state === 'speaking'
  const isUserSpeaking = state === 'user_speaking'
  const isThinking = state === 'thinking'

  const statusText = isError
    ? (error && error.length > 55 ? `${error.slice(0, 55)}…` : error) || 'Voice error'
    : isMuted
      ? 'Mic muted'
      : isConnecting
        ? 'Connecting…'
        : isUserSpeaking
          ? 'Listening…'
          : isThinking
            ? 'Thinking…'
            : isSpeaking
              ? 'Speaking…'
              : 'Listening…'

  const dotColor = isError
    ? 'bg-rose-500'
    : isMuted
      ? 'bg-slate-400'
      : isSpeaking
        ? 'bg-blue-500'
        : isUserSpeaking
          ? 'bg-emerald-500'
          : isThinking
            ? 'bg-amber-500'
            : 'bg-indigo-500'

  const barColor = isError
    ? 'bg-rose-300'
    : isMuted
      ? 'bg-slate-300'
      : isSpeaking
        ? 'bg-blue-400'
        : isUserSpeaking
          ? 'bg-emerald-400'
          : isThinking
            ? 'bg-amber-400'
            : 'bg-indigo-400'

  return (
    <div className="flex items-center gap-2 px-2 py-2 sm:gap-3">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {!isError && !isConnecting ? (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dotColor} opacity-60`} />
        ) : null}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotColor} ${isConnecting ? 'animate-pulse' : ''}`} />
      </span>

      <span className="flex-1 text-[13.5px] leading-6 text-slate-600 sm:text-[14px]">
        {statusText}
      </span>

      <div ref={barsRef} className="flex items-center gap-[3px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`w-[3px] rounded-full transition-all duration-75 ${barColor}`}
            style={{ height: '6px' }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onToggleMute}
        disabled={isError || isConnecting}
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9 ${
          isMuted
            ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
            : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'
        }`}
        aria-label={isMuted ? 'Unmute mic' : 'Mute mic'}
        title={isMuted ? 'Unmute mic' : 'Mute mic'}
      >
        {isMuted ? <MicOffIcon /> : <MicIcon />}
      </button>

      {isSpeaking ? (
        <button
          type="button"
          onClick={onInterrupt}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-[12px] font-medium text-slate-700 transition hover:bg-slate-200 sm:h-9 sm:text-[12.5px]"
        >
          Interrupt
        </button>
      ) : null}

      <button
        type="button"
        onClick={onEnd}
        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-rose-500 px-3 text-[12px] font-semibold text-white shadow-sm transition hover:bg-rose-600 sm:h-9 sm:px-4 sm:text-[12.5px]"
        aria-label="End voice"
      >
        <span className="hidden sm:inline">End</span>
        <CloseIcon />
      </button>
    </div>
  )
}

function MobileHeader({ isSidebarOpen, onToggle, onNewChat }) {
  return (
    <div className="fixed left-0 right-0 top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur md:hidden">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-700 transition hover:bg-slate-100"
        aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
      >
        <MenuIcon />
      </button>
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white">
          <SparkIcon className="h-3.5 w-3.5" />
        </div>
        <p className="text-[14px] font-semibold tracking-tight text-slate-900">
          Solution Architect
        </p>
      </div>
      <button
        type="button"
        onClick={onNewChat}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-700 transition hover:bg-slate-100"
        aria-label="New chat"
      >
        <ComposeIcon />
      </button>
    </div>
  )
}

function SparkIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <path d="M5.6 5.6l2.1 2.1" />
      <path d="M16.3 16.3l2.1 2.1" />
      <path d="M5.6 18.4l2.1-2.1" />
      <path d="M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  )
}

function StarterIcon({ index }) {
  const icons = [
    <svg key="0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="m4.93 4.93 2.83 2.83" />
      <path d="m16.24 16.24 2.83 2.83" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <circle cx="12" cy="12" r="4" />
    </svg>,
    <svg key="1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
    </svg>,
    <svg key="2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </svg>,
    <svg key="3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h18v6H3z" />
      <path d="M3 15h18v6H3z" />
      <path d="M7 12h10" />
    </svg>,
  ]
  return icons[index % icons.length]
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
      <path d="M14 3v5h5" strokeLinejoin="round" />
    </svg>
  )
}

function ComposeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
      <path d="M15 5l4 4" />
    </svg>
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
    .map((line) =>
      removeSolutionLabelLine(
        cleanAssistantLine(
          convertStandaloneBoldToHeading(
            normalizeBrokenBoldSyntax(stripLeadingEmoji(line)),
          ),
        ),
      ),
    )
    .filter((line, index, lines) => {
      if (isDividerLine(line)) {
        return false
      }

      if (line === '' && lines[index - 1] === '') {
        return false
      }

      return true
    })
    .join('\n')
}

function SendArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
      <path d="M12 19V5" strokeLinecap="round" />
      <path d="m6 11 6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14" strokeLinecap="round" />
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
      <path d="M12 15a3 3 0 0 0 3-3V8a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" strokeLinecap="round" />
      <path d="M12 18v3" strokeLinecap="round" />
    </svg>
  )
}

function MicOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 2l20 20" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <path d="M15 9.34V5a3 3 0 0 0-5.94-.6" />
      <path d="M19 11a7 7 0 0 1-1.11 3.78" />
      <path d="M5 11a7 7 0 0 0 11.16 5.66" />
      <path d="M12 18v3" />
    </svg>
  )
}

function VoiceWaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
      <path d="M5 10v4" strokeLinecap="round" />
      <path d="M9 7v10" strokeLinecap="round" />
      <path d="M12 4v16" strokeLinecap="round" />
      <path d="M15 7v10" strokeLinecap="round" />
      <path d="M19 10v4" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12" strokeLinecap="round" />
      <path d="M18 6L6 18" strokeLinecap="round" />
    </svg>
  )
}

function findStreamingMessage(messages = []) {
  return [...messages].reverse().find((message) => message.role === 'assistant' && message.isStreaming)
}

function stripLeadingEmoji(line) {
  return line.replace(
    /^(\s*(?:[-*]\s+)?)(?:[\p{Extended_Pictographic}\uFE0F\u200D]+(?:\s+|$))+?/u,
    '$1',
  )
}

function convertStandaloneBoldToHeading(line) {
  const trimmed = line.trim()
  const match = trimmed.match(/^\*\*+\s*(.+?)\s*\*+$/)

  if (!match) {
    return line
  }

  return `## ${stripBoldMarkers(match[1]).trim()}`
}

function cleanAssistantLine(line) {
  return stripBoldMarkers(removeDecorativeIcons(line))
    .replace(/\*\*\s*\*\*/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+$/g, '')
}

function removeDecorativeIcons(line) {
  return line.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]+/gu, '')
}

function normalizeBrokenBoldSyntax(line) {
  return line
    .replace(/^\*\*\s+(.+?)\s*\*\*$/g, '**$1**')
    .replace(/:\*\*\s+\*\*(.+?)$/g, ': $1')
    .replace(/([^\s])\*\*\s+\*\*(.+?)$/g, '$1 $2')
    .replace(/\*\*\s+\*\*(.+?)$/g, '$1')
}

function stripBoldMarkers(line) {
  return line
    .replace(/^(#{1,6}\s*)\*\*+\s*(.+?)\s*\*+$/g, '$1$2')
    .replace(/^([*-]\s+)\*\*+\s*(.+?)\s*\*+$/g, '$1$2')
    .replace(/^(\d+\.\s+)\*\*+\s*(.+?)\s*\*+$/g, '$1$2')
    .replace(/^>\s*\*\*+\s*(.+?)\s*\*+$/g, '> $1')
    .replace(/\*\*+\s*([^*]+?)\s*\*+/g, '$1')
}

function removeSolutionLabelLine(line) {
  return /^\s*label\s*:\s*\[(?:predefined match|custom dynamic solution|combo)\].*$/i.test(line)
    ? ''
    : line
}

function isDividerLine(line) {
  return /^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)
}

function buildComposedInput({ input, attachedFiles }) {
  const normalizedInput = input.trim()

  if (attachedFiles.length === 0) {
    return normalizedInput
  }

  const attachmentSections = attachedFiles
    .map((file) => {
      const content = file.extractedText?.trim()
      const details = [`File: ${file.name}`, `Type: ${file.typeLabel}`]

      if (content) {
        details.push(`Extracted Content:\n${content}`)
      } else {
        details.push(`Notes: ${file.note}`)
      }

      return details.join('\n')
    })
    .join('\n\n')

  return [normalizedInput, 'Attached File Context:', attachmentSections].filter(Boolean).join('\n\n')
}

async function parseAttachmentFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  const id = crypto.randomUUID()
  const fingerprint = buildFileFingerprint(file)

  try {
    if (extension === 'pdf') {
      const extractedText = await extractPdfText(file)
      return buildAttachmentRecord({
        id,
        fingerprint,
        file,
        extractedText,
        statusLabel: 'PDF extracted',
      })
    }

    if (extension === 'docx' || extension === 'doc') {
      const extractedText = await extractDocxText(file)
      return buildAttachmentRecord({
        id,
        fingerprint,
        file,
        extractedText,
        statusLabel: 'Document extracted',
      })
    }

    if (extension === 'xlsx' || extension === 'xls') {
      const extractedText = await extractSpreadsheetText(file)
      return buildAttachmentRecord({
        id,
        fingerprint,
        file,
        extractedText,
        statusLabel: 'Spreadsheet extracted',
      })
    }

    if (['txt', 'md', 'json', 'csv', 'rtf'].includes(extension)) {
      const extractedText = await file.text()
      return buildAttachmentRecord({
        id,
        fingerprint,
        file,
        extractedText,
        statusLabel: 'Text extracted',
      })
    }

    return buildAttachmentRecord({
      id,
      fingerprint,
      file,
      extractedText: '',
      statusLabel: 'Metadata only',
      note: 'This file type is attached by name only. Content extraction is not supported in-browser yet.',
    })
  } catch {
    return buildAttachmentRecord({
      id,
      fingerprint,
      file,
      extractedText: '',
      statusLabel: 'Read failed',
      note: 'The file could not be parsed, so only its name will be included in the request.',
    })
  }
}

function buildPendingAttachmentRecord(file) {
  return {
    id: crypto.randomUUID(),
    fingerprint: buildFileFingerprint(file),
    file,
    name: file.name,
    size: file.size,
    type: file.type,
    typeLabel: file.type || 'Unknown',
    extractedText: '',
    statusLabel: 'Processing...',
    note: '',
  }
}

function buildAttachmentRecord({ id, fingerprint, file, extractedText, statusLabel, note }) {
  return {
    id,
    fingerprint,
    name: file.name,
    size: file.size,
    type: file.type,
    typeLabel: file.type || 'Unknown',
    extractedText: limitAttachmentText(extractedText),
    statusLabel,
    note: note || '',
  }
}

function trimAttachments(files) {
  let totalChars = 0

  return files.map((file) => {
    if (!file.extractedText) {
      return file
    }

    const remainingChars = Math.max(MAX_TOTAL_ATTACHMENT_CHARS - totalChars, 0)
    const nextText = file.extractedText.slice(0, remainingChars)
    totalChars += nextText.length

    return {
      ...file,
      extractedText: nextText,
      statusLabel:
        nextText.length < file.extractedText.length ? `${file.statusLabel} (trimmed)` : file.statusLabel,
    }
  })
}

function limitAttachmentText(text) {
  return (text || '').replace(/\0/g, '').trim().slice(0, MAX_ATTACHMENT_CHARS)
}

function buildFileFingerprint(file) {
  return [file.name, file.size, file.lastModified].join(':')
}

async function extractPdfText(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pageTexts = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = content.items.map((item) => item.str || '').join(' ')
    pageTexts.push(pageText)
  }

  return pageTexts.join('\n')
}

async function extractDocxText(file) {
  const buffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return result.value || ''
}

async function extractSpreadsheetText(file) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    const content = rows
      .map((row) => row.map((cell) => String(cell).trim()).filter(Boolean).join(' | '))
      .filter(Boolean)
      .join('\n')

    return [`Sheet: ${sheetName}`, content].filter(Boolean).join('\n')
  })
    .filter(Boolean)
    .join('\n\n')
}

function getSpeechErrorMessage(errorCode) {
  if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
    return 'Microphone access was blocked.'
  }

  if (errorCode === 'audio-capture') {
    return 'No microphone was found for speech input.'
  }

  if (errorCode === 'network') {
    return 'Speech recognition failed because the browser lost network access.'
  }

  if (errorCode === 'no-speech') {
    return 'No speech was detected. Try again and speak after the mic turns on.'
  }

  return 'Speech recognition failed.'
}

export default App
