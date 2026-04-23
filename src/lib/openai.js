import { systemPrompt } from './knowledgeBase'

const OPENAI_API_URL = 'https://api.openai.com/v1/responses'
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'

const openAiApiKey = import.meta.env.VITE_OPENAI_API_KEY
const groqApiKey = import.meta.env.VITE_GROQ_API_KEY
const mistralApiKey = import.meta.env.VITE_MISTRAL_API_KEY
const preferredProvider = (import.meta.env.VITE_AI_PROVIDER || 'mistral').toLowerCase()
const openAiModel = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4.1'
const groqModel = import.meta.env.VITE_GROQ_MODEL || 'openai/gpt-oss-120b'
const mistralModel = import.meta.env.VITE_MISTRAL_MODEL || 'mistral-large-2512'

export async function generateSolutionArchitectResponse({ messages, signal }) {
  const providerChain = buildProviderChain()

  if (providerChain.length === 0) {
    throw new Error(
      'Missing API keys. Add VITE_MISTRAL_API_KEY, VITE_GROQ_API_KEY, and/or VITE_OPENAI_API_KEY to your .env file and restart the dev server.',
    )
  }

  let lastError = null

  for (const provider of providerChain) {
    try {
      if (provider === 'mistral') {
        return await fetchFromMistral({ messages, signal })
      }

      if (provider === 'groq') {
        return await fetchFromGroq({ messages, signal })
      }

      return await fetchFromOpenAI({ messages, signal })
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('The request failed for every configured provider.')
}

export async function streamSolutionArchitectResponse({ messages, onChunk, signal }) {
  const providerChain = buildProviderChain()

  if (providerChain.length === 0) {
    throw new Error(
      'Missing API keys. Add VITE_MISTRAL_API_KEY, VITE_GROQ_API_KEY, and/or VITE_OPENAI_API_KEY to your .env file and restart the dev server.',
    )
  }

  let lastError = null

  for (const provider of providerChain) {
    try {
      if (provider === 'openai') {
        return await streamFromOpenAI({ messages, onChunk, signal })
      }

      const fullResponse =
        provider === 'mistral'
          ? await fetchFromMistral({ messages, signal })
          : await fetchFromGroq({ messages, signal })

      if (fullResponse) {
        onChunk?.(fullResponse)
      }

      return fullResponse
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('The request failed for every configured provider.')
}

function buildProviderChain() {
  const availableProviders = []

  if (mistralApiKey) {
    availableProviders.push('mistral')
  }

  if (openAiApiKey) {
    availableProviders.push('openai')
  }

  if (groqApiKey) {
    availableProviders.push('groq')
  }

  if (!availableProviders.includes(preferredProvider)) {
    return availableProviders
  }

  return [preferredProvider, ...availableProviders.filter((provider) => provider !== preferredProvider)]
}

async function fetchFromOpenAI({ messages, signal }) {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiApiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: openAiModel,
      input: [buildOpenAISystemMessage(), ...buildOpenAIConversation(messages)],
      temperature: 0.7,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    const message =
      data?.error?.message || 'OpenAI request failed. Check the API key and network access.'
    throw new Error(message)
  }

  const outputText = extractOpenAIText(data)

  if (!outputText) {
    throw new Error('The model returned an empty response.')
  }

  return outputText
}

async function streamFromOpenAI({ messages, onChunk, signal }) {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiApiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: openAiModel,
      stream: true,
      input: [buildOpenAISystemMessage(), ...buildOpenAIConversation(messages)],
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const data = await safeReadJson(response)
    const message =
      data?.error?.message || 'OpenAI request failed. Check the API key and network access.'
    throw new Error(message)
  }

  if (!response.body) {
    throw new Error('OpenAI streaming response body was empty.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let outputText = ''
  let streamError = null

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() || ''

    for (const rawEvent of events) {
      const parsedEvent = parseSseEvent(rawEvent)

      if (!parsedEvent || parsedEvent.data === '[DONE]') {
        continue
      }

      let eventData

      try {
        eventData = JSON.parse(parsedEvent.data)
      } catch {
        continue
      }

      if (eventData.type === 'response.output_text.delta' && typeof eventData.delta === 'string') {
        outputText += eventData.delta
        onChunk?.(eventData.delta)
      }

      if (eventData.type === 'response.completed') {
        const completedText = extractOpenAIText(eventData.response)

        if (!outputText && completedText) {
          outputText = completedText
          onChunk?.(completedText)
        }
      }

      if (eventData.type === 'error') {
        streamError = new Error(
          eventData.error?.message || eventData.message || 'OpenAI streaming request failed.',
        )
      }
    }
  }

  if (streamError) {
    throw streamError
  }

  if (!outputText) {
    throw new Error('The model returned an empty response.')
  }

  return outputText
}

async function fetchFromGroq({ messages, signal }) {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: groqModel,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...buildChatConversation(messages),
      ],
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    const message =
      data?.error?.message || 'Groq request failed. Check the API key, model, and network access.'
    throw new Error(message)
  }

  const outputText =
    data?.choices
      ?.map((choice) => choice?.message?.content || '')
      .filter(Boolean)
      .join('\n') || ''

  if (!outputText) {
    throw new Error('Groq returned an empty response.')
  }

  return outputText
}

async function fetchFromMistral({ messages, signal }) {
  const response = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mistralApiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: mistralModel,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...buildChatConversation(messages),
      ],
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    const message =
      data?.error?.message || 'Mistral request failed. Check the API key, model, and network access.'
    throw new Error(message)
  }

  const outputText = extractChatCompletionText(data)

  if (!outputText) {
    throw new Error('Mistral returned an empty response.')
  }

  return outputText
}

function extractOpenAIText(data) {
  return (
    data?.output_text ||
    data?.output
      ?.flatMap((item) => item.content || [])
      ?.filter((item) => item.type === 'output_text')
      ?.map((item) => item.text)
      ?.join('\n')
  )
}

function extractChatCompletionText(data) {
  return (
    data?.choices
      ?.map((choice) => {
        const content = choice?.message?.content

        if (typeof content === 'string') {
          return content
        }

        if (Array.isArray(content)) {
          return content
            .map((item) => item?.text || '')
            .filter(Boolean)
            .join('\n')
        }

        return ''
      })
      .filter(Boolean)
      .join('\n') || ''
  )
}

function buildOpenAISystemMessage() {
  return {
    role: 'system',
    content: [
      {
        type: 'input_text',
        text: systemPrompt,
      },
    ],
  }
}

function buildOpenAIConversation(messages = []) {
  return messages
    .filter((message) => message?.role === 'user' || message?.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: [
        {
          type: 'input_text',
          text: message.content,
        },
      ],
    }))
}

function buildChatConversation(messages = []) {
  return messages
    .filter((message) => message?.role === 'user' || message?.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: message.content,
    }))
}

function parseSseEvent(rawEvent) {
  const lines = rawEvent.split('\n')
  let event = 'message'
  const dataLines = []

  for (const line of lines) {
    if (!line.trim()) {
      continue
    }

    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
      continue
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  if (dataLines.length === 0) {
    return null
  }

  return {
    event,
    data: dataLines.join('\n'),
  }
}

async function safeReadJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}
