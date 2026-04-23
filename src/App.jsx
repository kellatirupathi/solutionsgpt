import React, { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { generateSolutionArchitectResponse } from './lib/openai'

const loadingSteps = [
  'Analyzing business context',
  'Identifying the real problem',
  'Mapping the best-fit solution',
  'Calculating pricing and packaging',
  'Preparing final recommendation',
]

function App() {
  const [businessInput, setBusinessInput] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadingStepIndex, setLoadingStepIndex] = useState(0)

  useEffect(() => {
    if (!loading) {
      setLoadingStepIndex(0)
      return
    }

    const interval = window.setInterval(() => {
      setLoadingStepIndex((current) => (current + 1) % loadingSteps.length)
    }, 1700)

    return () => window.clearInterval(interval)
  }, [loading])

  async function handleAnalyze() {
    const trimmedInput = businessInput.trim()

    if (!trimmedInput || loading) {
      return
    }

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmedInput,
    }

    setMessages((current) => [...current, userMessage])
    setBusinessInput('')
    setError('')
    setLoading(true)

    try {
      const result = await generateSolutionArchitectResponse({
        businessInput: trimmedInput,
      })

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result,
        },
      ])
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

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col">
        <div className="flex-1 px-4 pb-40 pt-8 sm:px-6 sm:pt-10">
          {messages.length === 0 ? (
            <div className="flex min-h-[70vh] items-center justify-center">
              <div className="max-w-2xl text-center">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  Solution Architect GPT
                </h1>
                <p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base">
                  Describe the business problem. The app will analyze it in the background using your
                  instruction files and return a structured solution recommendation.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message) => (
                <section
                  key={message.id}
                  className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                >
                  <div
                    className={
                      message.role === 'user'
                        ? 'max-w-2xl rounded-[28px] bg-slate-900 px-5 py-4 text-sm leading-7 text-white shadow-sm'
                        : 'w-full rounded-[28px] bg-white px-5 py-5 text-sm leading-7 text-slate-700 shadow-sm ring-1 ring-slate-200'
                    }
                  >
                    {message.role === 'user' ? (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <article className="prose prose-slate max-w-none prose-headings:mb-3 prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-li:text-slate-700 prose-table:block prose-table:overflow-x-auto prose-th:text-slate-900 prose-td:border-slate-300 prose-th:border-slate-300">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                      </article>
                    )}
                  </div>
                </section>
              ))}

              {loading ? (
                <section className="flex justify-start">
                  <div className="rounded-[28px] bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                      </div>
                      <div className="min-w-[220px]">
                        <p className="text-sm font-medium text-slate-700">
                          {loadingSteps[loadingStepIndex]}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">Generating response...</p>
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              {error ? (
                <section className="flex justify-start">
                  <div className="w-full rounded-[28px] bg-rose-50 px-5 py-4 text-sm text-rose-700 ring-1 ring-rose-200">
                    {error}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-end gap-3 rounded-[30px] bg-white px-3 py-3 shadow-lg ring-1 ring-slate-200">
              <textarea
                value={businessInput}
                onChange={(event) => setBusinessInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe the business problem..."
                className="max-h-40 min-h-[52px] flex-1 resize-none border-0 bg-transparent px-3 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={loading || !businessInput.trim()}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                aria-label="Send"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      </main>
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

export default App
