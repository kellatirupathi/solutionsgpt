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

export async function generateSolutionArchitectResponse({ businessInput }) {
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
        return await fetchFromMistral({ businessInput })
      }

      if (provider === 'groq') {
        return await fetchFromGroq({ businessInput })
      }

      return await fetchFromOpenAI({ businessInput })
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

async function fetchFromOpenAI({ businessInput }) {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: openAiModel,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: systemPrompt,
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: businessInput,
            },
          ],
        },
      ],
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

async function fetchFromGroq({ businessInput }) {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: groqModel,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: businessInput,
        },
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

async function fetchFromMistral({ businessInput }) {
  const response = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mistralApiKey}`,
    },
    body: JSON.stringify({
      model: mistralModel,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: businessInput,
        },
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
