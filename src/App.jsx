import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import * as XLSX from 'xlsx'
import { streamSolutionArchitectResponse } from './lib/openai'

const STORAGE_KEY = 'solution-architect-gpt-chats'
const MAX_ATTACHMENT_CHARS = 12000
const MAX_TOTAL_ATTACHMENT_CHARS = 24000
const ACCENT_SURFACE_CLASS =
  'border-[#cfe0f5] bg-[#edf5ff] text-slate-800 shadow-[0_12px_30px_rgba(125,147,178,0.14)]'
const ACCENT_SURFACE_HOVER_CLASS =
  'hover:border-[#bfd5ee] hover:bg-[#e4f0ff]'
const ACCENT_INPUT_SURFACE_CLASS =
  'border-[#cfe0f5] bg-[#f2f8ff] shadow-[0_18px_42px_rgba(125,147,178,0.16)] ring-1 ring-white/80'
const ACCENT_ICON_BUTTON_CLASS =
  'bg-white text-slate-500 shadow-sm ring-1 ring-[#cfe0f5] transition hover:bg-[#e8f2ff] hover:text-slate-700'
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
  const messagesEndRef = useRef(null)
  const requestAbortRef = useRef(null)
  const fileInputRef = useRef(null)
  const textAreaRef = useRef(null)
  const speechRecognitionRef = useRef(null)
  const speechFinalTranscriptRef = useRef('')
  const speechShouldContinueRef = useRef(false)
  const uploadedFileIdsRef = useRef([])

  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

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
            <div className="mb-4 px-1">
              <p className="text-[15px] font-semibold tracking-tight text-slate-900">
                Solution Architect GPT
              </p>
            </div>

            <button
              type="button"
              onClick={handleNewChat}
              className="mb-3 inline-flex items-center gap-2 px-1 py-2 text-[15px] font-medium text-slate-900 transition hover:text-slate-700"
            >
              <ComposeIcon />
              New Chat
            </button>

            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                History
              </h2>
              <span className="text-xs text-slate-400">{chats.length}</span>
            </div>

            <div className="flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden pb-1 md:max-h-[calc(100vh-110px)]">
              {chats.map((chat) => (
                <div key={chat.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveChatId(chat.id)
                      setError('')
                      setIsSidebarOpen(false)
                    }}
                    className={`w-full rounded-lg px-1 py-2 pr-8 text-left text-[14px] transition ${
                      chat.id === activeChatId
                        ? 'font-medium text-slate-900'
                        : 'text-slate-600 hover:text-slate-900'
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
                    className={`absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full transition ${
                      chat.id === activeChatId
                        ? 'text-slate-500 opacity-0 hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100'
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
                          ? 'w-auto max-w-[92%] rounded-[20px] border border-[#cfe0f5] bg-[#edf5ff] px-4 py-3 text-[14px] leading-6 text-slate-800 shadow-[0_10px_24px_rgba(125,147,178,0.12)] sm:max-w-[85%] sm:rounded-[22px] sm:px-5 sm:py-3.5 md:max-w-[78%] lg:max-w-2xl'
                          : 'w-full pr-2 px-1 py-1 text-slate-700 sm:px-2 sm:py-2 sm:pr-3 lg:pr-4 xl:pr-5'
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

                {loading && !findStreamingMessage(messages)?.content ? (
                  <section className="flex justify-start px-1 py-1 sm:px-2">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium leading-5 text-slate-600 sm:text-[14px]">
                          {findStreamingMessage(messages)?.content
                            ? streamStatus || 'Generating response live'
                            : loadingSteps[loadingStepIndex] || 'Analyzing request'}
                        </p>
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
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelection}
                accept=".txt,.md,.json,.csv,.pdf,.doc,.docx,.rtf,.xlsx,.xls,.ppt,.pptx"
                className="hidden"
              />
              <div className={`rounded-[20px] border px-2.5 py-2 sm:rounded-[22px] sm:px-3 sm:py-2.5 md:rounded-[24px] ${ACCENT_INPUT_SURFACE_CLASS}`}>
                {attachedFiles.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-2 px-1">
                    {attachedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700"
                      >
                        <span className="truncate">{file.name}</span>
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

                <div className="flex items-end gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={handleOpenFilePicker}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-white/70"
                    aria-label="Attach files"
                  >
                    <PlusIcon />
                  </button>

                  <textarea
                    ref={textAreaRef}
                    value={businessInput}
                    onChange={(event) => setBusinessInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe the business problem..."
                    className="min-h-[42px] max-h-36 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-1 py-2 text-[14px] leading-6 text-slate-800 outline-none placeholder:text-slate-400 sm:min-h-[44px] sm:text-[15px]"
                  />

                  <button
                    type="button"
                    onClick={handleSpeechToggle}
                    disabled={!speechSupported}
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
                      isListening
                        ? 'bg-white text-rose-600 shadow-sm ring-1 ring-[#cfe0f5]'
                        : `text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300 ${ACCENT_ICON_BUTTON_CLASS}`
                    }`}
                    aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                  >
                    <MicIcon />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAnalyze()}
                    disabled={loading || (!businessInput.trim() && attachedFiles.length === 0)}
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:bg-white/80 disabled:text-slate-300 ${ACCENT_ICON_BUTTON_CLASS}`}
                    aria-label="Send"
                  >
                    <SendArrowIcon />
                  </button>
                </div>
              </div>
              {isParsingFiles ? (
                <p className="mt-2 px-1 text-xs text-slate-500">Processing attached files...</p>
              ) : null}
              {attachmentError ? (
                <p className="mt-2 px-1 text-xs text-rose-600">{attachmentError}</p>
              ) : null}
              {speechError ? (
                <p className="mt-2 px-1 text-xs text-rose-600">{speechError}</p>
              ) : null}
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

function ComposeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
      <path
        d="M12 20h9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m16.5 3.5 4 4L8 20l-5 1 1-5 12.5-12.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
