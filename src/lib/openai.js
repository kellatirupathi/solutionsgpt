import { buildResponsePlan, buildSystemPrompt } from './knowledgeBase'

const OPENAI_API_URL = 'https://api.openai.com/v1/responses'
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'

const openAiApiKey = import.meta.env.VITE_OPENAI_API_KEY
const groqApiKey = import.meta.env.VITE_GROQ_API_KEY
const mistralApiKey = import.meta.env.VITE_MISTRAL_API_KEY
const preferredProvider = (import.meta.env.VITE_AI_PROVIDER || 'mistral').toLowerCase()
const configuredOpenAiModel = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4.1'
const openAiModel =
  configuredOpenAiModel === 'gpt-4.1-long-context' ? 'gpt-4.1' : configuredOpenAiModel
const groqModel = import.meta.env.VITE_GROQ_MODEL || 'openai/gpt-oss-120b'
const mistralModel = import.meta.env.VITE_MISTRAL_MODEL || 'mistral-large-2512'
const RESPONSE_TEMPERATURE = Number(import.meta.env.VITE_RESPONSE_TEMPERATURE || 0.35)
const MAX_OUTPUT_TOKENS = Number(import.meta.env.VITE_MAX_OUTPUT_TOKENS || 1800)
const MAX_CONTEXT_MESSAGES = Number(import.meta.env.VITE_MAX_CONTEXT_MESSAGES || 6)

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
      return await generateStructuredResponse({ provider, messages, signal })
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('The request failed for every configured provider.')
}

export async function streamSolutionArchitectResponse({ messages, onChunk, onReplace, onStatus, signal }) {
  const providerChain = buildProviderChain()

  if (providerChain.length === 0) {
    throw new Error(
      'Missing API keys. Add VITE_MISTRAL_API_KEY, VITE_GROQ_API_KEY, and/or VITE_OPENAI_API_KEY to your .env file and restart the dev server.',
    )
  }

  let lastError = null

  for (const provider of providerChain) {
    try {
      onStatus?.(`Analyzing with ${providerLabel(provider)}...`)
      const responseText = await generateStructuredResponse({ provider, messages, signal })
      onStatus?.('Rendering response...')
      await emitTextChunks(responseText, onChunk, signal)
      return responseText
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

  return [preferredProvider]
}

async function generateStructuredResponse({ provider, messages, signal }) {
  const plan = buildResponsePlan({ messages })
  const systemPrompt = buildSystemPrompt({ messages })

  if (provider !== 'openai') {
    return generateTemplatedMarkdownResponse({
      provider,
      messages,
      systemPrompt,
      plan,
      signal,
    })
  }

  const responseInstructions = buildStructuredResponseInstructions(plan)

  try {
    const rawText = await requestOpenAIText({
      messages,
      systemPrompt,
      responseInstructions,
      signal,
    })

    const parsed = await parseOrRepairStructuredResponse({
      provider,
      rawText,
      messages,
      systemPrompt,
      plan,
      signal,
    })
    const validated = validateStructuredResponse(parsed, plan)

    if (!validated.isValid) {
      const repairedText = await repairStructuredResponse({
        provider,
        messages,
        systemPrompt,
        plan,
        rawText,
        validation: validated,
        signal,
      })

      const repairedParsed = await parseOrRepairStructuredResponse({
        provider,
        rawText: repairedText,
        messages,
        systemPrompt,
        plan,
        signal,
        allowRepair: false,
      })
      const repairedValidated = validateStructuredResponse(repairedParsed, plan)

      if (!repairedValidated.isValid) {
        throw new Error(`Structured response validation failed: ${repairedValidated.errors.join('; ')}`)
      }

      return renderStructuredResponse(repairedParsed, plan)
    }

    return renderStructuredResponse(parsed, plan)
  } catch {
    return generateTemplatedMarkdownResponse({
      provider,
      messages,
      systemPrompt,
      plan,
      signal,
    })
  }
}

async function requestOpenAIText({ messages, systemPrompt, responseInstructions, signal }) {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiApiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: openAiModel,
      input: [
        buildOpenAISystemMessage(systemPrompt),
        buildOpenAIInstructionsMessage(responseInstructions),
        ...buildOpenAIConversation(messages),
      ],
      temperature: RESPONSE_TEMPERATURE,
      max_output_tokens: MAX_OUTPUT_TOKENS,
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

async function requestGroqText({ messages, systemPrompt, responseInstructions, signal }) {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: groqModel,
      temperature: RESPONSE_TEMPERATURE,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [
        { role: 'system', content: `${systemPrompt}\n\n${responseInstructions}` },
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

  const outputText = extractChatCompletionText(data)

  if (!outputText) {
    throw new Error('Groq returned an empty response.')
  }

  return outputText
}

async function requestMistralText({ messages, systemPrompt, responseInstructions, signal }) {
  const response = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mistralApiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: mistralModel,
      temperature: RESPONSE_TEMPERATURE,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [
        { role: 'system', content: `${systemPrompt}\n\n${responseInstructions}` },
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

async function repairStructuredResponse({ provider, messages, systemPrompt, plan, rawText, validation, signal }) {
  const repairPrompt = [
    buildStructuredResponseInstructions(plan),
    'The previous JSON was invalid or incomplete.',
    `Errors: ${validation.errors.join('; ')}`,
    `Previous JSON/text to repair:\n${rawText}`,
    'Return corrected JSON only.',
  ].join('\n\n')

  return provider === 'openai'
    ? requestOpenAIText({
        messages,
        systemPrompt,
        responseInstructions: repairPrompt,
        signal,
      })
    : provider === 'groq'
      ? requestGroqText({
          messages,
          systemPrompt,
          responseInstructions: repairPrompt,
          signal,
        })
      : requestMistralText({
          messages,
          systemPrompt,
          responseInstructions: repairPrompt,
          signal,
        })
}

function buildStructuredResponseInstructions(plan) {
  const sectionLines = plan.sections
    .map((section) => `- ${section.id}: ${section.title}`)
    .join('\n')
  const includesFollowUpOptions = plan.sections.some((section) => section.id === 'follow_up_options')
  const includesTechStack = plan.sections.some((section) => section.id === 'tech_stack')
  const isFollowUpOnlyPlan =
    plan.mode === 'analysis' &&
    plan.sections.length === 1 &&
    ['understanding_guide', 'implementation_guide', 'client_pitch_script', 'full_solution_document'].includes(
      plan.sections[0]?.id,
    )

  return [
    'Return valid JSON only. Do not wrap it in markdown fences.',
    `Mode must be "${plan.mode}".`,
    'JSON schema:',
    '{',
    '  "mode": "analysis" | "clarify",',
    '  "sections": [',
    '    {',
    '      "id": "section_id",',
    '      "title": "Section Title",',
    '      "content": "Markdown content for that section"',
    '    }',
    '  ]',
    '}',
    'Allowed sections for this request:',
    sectionLines,
    'Rules:',
    '- Include every required section exactly once.',
    '- Do not add sections outside the allowed list.',
    '- Keep titles exactly as provided.',
    '- For clarify mode, only return the clarifying_questions section.',
    '- For analysis mode, fill each section with strong, business-specific content.',
    includesFollowUpOptions
      ? '- The follow_up_options section must contain A, B, C, and D options.'
      : '- Do not add A/B/C/D follow-up choices unless that section is explicitly requested.',
    includesTechStack
      ? '- The tech_stack section must include concrete tools and pricing in INR.'
      : '- Do not add tech stack tables unless the requested section explicitly needs them.',
    isFollowUpOnlyPlan
      ? '- This is a same-chat follow-up request. Use the established conversation context and generate the requested deliverable directly.'
      : '- When context is incomplete, ask clarifying questions only if the plan is clarify mode.',
    isFollowUpOnlyPlan
      ? '- Do not ask fresh discovery questions if the existing chat already established the business, pain point, and recommended solution.'
      : '- Preserve continuity with the previous messages.',
    isFollowUpOnlyPlan
      ? '- If a user asked you to assume samples or dummy values, proceed with reasonable assumptions and state them inside the requested deliverable.'
      : '- Use reasonable assumptions when the user explicitly permits them.',
    '- The content must follow the Solution Architect GPT style and decision logic.',
  ].join('\n')
}

function buildMarkdownFallbackInstructions(plan) {
  const headings = plan.sections
    .map((section) => `- ${section.title}`)
    .join('\n')
  const includesFollowUpOptions = plan.sections.some((section) => section.id === 'follow_up_options')
  const includesTechStack = plan.sections.some((section) => section.id === 'tech_stack')
  const includesRecommendedNextSteps = plan.sections.some(
    (section) => section.id === 'recommended_next_steps',
  )
  const isFollowUpOnlyPlan =
    plan.mode === 'analysis' &&
    plan.sections.length === 1 &&
    ['understanding_guide', 'implementation_guide', 'client_pitch_script', 'full_solution_document'].includes(
      plan.sections[0]?.id,
    )

  return [
    'Return markdown only. Do not return JSON.',
    'Use exactly these section headings in this order when they apply:',
    headings,
    'Rules:',
    '- Start directly with the first section heading. Do not add any intro text before it.',
    '- Include all required sections for this plan.',
    '- Keep the headings exactly as written.',
    '- Write each heading as a markdown H2 in the form: ## Section Title',
    '- Do not rename, merge, skip, or reorder headings.',
    '- For clarify mode, only ask the clarifying questions.',
    '- For analysis mode, provide complete business-specific content under each heading.',
    includesFollowUpOptions
      ? '- When follow_up_options is included, include exactly four options starting with A, B, C, and D.'
      : '- Do not include A/B/C/D follow-up options unless that heading is requested.',
    includesTechStack
      ? '- The tech_stack section must include a markdown table with Component, Tool/Platform, Reason, and Monthly Cost.'
      : '- Do not include tech stack tables unless the requested section explicitly requires one.',
    includesRecommendedNextSteps
      ? '- The recommended_next_steps section must include exactly 3 sequenced actions.'
      : '- Do not add a next-steps sequence unless that heading is requested.',
    isFollowUpOnlyPlan
      ? '- This is a same-chat follow-up deliverable. Continue the already established business case instead of restarting discovery.'
      : '- Keep continuity with the current chat context.',
    isFollowUpOnlyPlan
      ? '- Do not ask fresh clarifying questions when the existing chat already gives enough context to produce the requested section.'
      : '- Ask clarifying questions only when the plan is clarify mode.',
    isFollowUpOnlyPlan
      ? '- If the user permits sample or dummy assumptions, proceed and make those assumptions explicit inside the section.'
      : '- Use assumptions only when supported by the chat context or explicitly permitted by the user.',
  ].join('\n')
}

function parseStructuredResponse(rawText) {
  const normalized = (rawText || '').trim()
  const fenced = normalized.match(/```(?:json)?\s*([\s\S]+?)\s*```/i)
  const candidate = sanitizeJsonCandidate(fenced?.[1] || extractJsonObject(normalized))

  if (!candidate) {
    throw new Error('The model did not return parseable JSON.')
  }

  return JSON.parse(candidate)
}

async function parseOrRepairStructuredResponse({
  provider,
  rawText,
  messages,
  systemPrompt,
  plan,
  signal,
  allowRepair = true,
}) {
  try {
    return parseStructuredResponse(rawText)
  } catch (error) {
    if (!allowRepair) {
      throw error
    }

    const repairedText = await repairStructuredResponse({
      provider,
      messages,
      systemPrompt,
      plan,
      rawText,
      validation: {
        errors: [error.message || 'Invalid JSON structure.'],
      },
      signal,
    })

    return parseOrRepairStructuredResponse({
      provider,
      rawText: repairedText,
      messages,
      systemPrompt,
      plan,
      signal,
      allowRepair: false,
    })
  }
}

async function generateTemplatedMarkdownResponse({ provider, messages, systemPrompt, plan, signal }) {
  const responseInstructions = buildMarkdownFallbackInstructions(plan)
  const rawText = await requestProviderText({
    provider,
    messages,
    systemPrompt,
    responseInstructions,
    signal,
  })

  if (!rawText?.trim()) {
    throw new Error('The model returned an empty response.')
  }

  const normalizedText = normalizeMarkdownFallback(rawText.trim(), plan)
  const parsed = parseMarkdownSections(normalizedText, plan)
  const validated = validateStructuredResponse(parsed, plan)

  if (validated.isValid) {
    return renderStrictTemplate(parsed, plan)
  }

  const repairedText = await repairMarkdownSections({
    provider,
    messages,
    systemPrompt,
    plan,
    rawText: normalizedText,
    validation: validated,
    signal,
  })
  const repairedParsed = mergeStructuredSections(
    parsed,
    parseMarkdownSections(normalizeMarkdownFallback(repairedText.trim(), plan), plan),
    plan,
  )
  const repairedValidated = validateStructuredResponse(repairedParsed, plan)

  if (repairedValidated.isValid) {
    return renderStrictTemplate(repairedParsed, plan)
  }

  return renderStrictTemplate(fillMissingStructuredSections(repairedParsed, plan))
}

function validateStructuredResponse(parsed, plan) {
  const errors = []

  if (!parsed || typeof parsed !== 'object') {
    return { isValid: false, errors: ['Response is not an object.'] }
  }

  if (parsed.mode !== plan.mode) {
    errors.push(`Mode should be "${plan.mode}".`)
  }

  if (!Array.isArray(parsed.sections)) {
    errors.push('Sections must be an array.')
    return { isValid: false, errors }
  }

  const allowedIds = new Set(plan.sections.map((section) => section.id))
  const requiredIds = new Set(plan.sections.filter((section) => section.required).map((section) => section.id))
  const seen = new Set()

  for (const section of parsed.sections) {
    if (!section || typeof section !== 'object') {
      errors.push('Each section must be an object.')
      continue
    }

    if (!allowedIds.has(section.id)) {
      errors.push(`Unexpected section id: ${section.id}`)
    }

    if (seen.has(section.id)) {
      errors.push(`Duplicate section id: ${section.id}`)
    }

    seen.add(section.id)

    if (typeof section.title !== 'string' || !section.title.trim()) {
      errors.push(`Section ${section.id} is missing a title.`)
    }

    if (typeof section.content !== 'string' || !section.content.trim()) {
      errors.push(`Section ${section.id} is missing content.`)
    }
  }

  for (const requiredId of requiredIds) {
    if (!seen.has(requiredId)) {
      errors.push(`Missing required section: ${requiredId}`)
    }
  }

  const followUpSection = parsed.sections.find((section) => section.id === 'follow_up_options')

  if (plan.mode === 'analysis' && followUpSection) {
    const normalized = normalizeText(followUpSection.content)
    for (const letter of ['a', 'b', 'c', 'd']) {
      if (!normalized.includes(`${letter} `) && !normalized.includes(`${letter} -`)) {
        errors.push('Follow-up options must include A/B/C/D choices.')
        break
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

function renderStructuredResponse(parsed, plan) {
  const plannedSections = new Map(plan.sections.map((section) => [section.id, section]))
  const orderedSections = parsed.sections
    .filter((section) => plannedSections.has(section.id))
    .sort(
      (left, right) =>
        plan.sections.findIndex((section) => section.id === left.id) -
        plan.sections.findIndex((section) => section.id === right.id),
    )

  if (plan.mode === 'clarify') {
    return orderedSections.map((section) => section.content.trim()).join('\n\n')
  }

  return orderedSections
    .map((section) => `## ${section.title}\n\n${section.content.trim()}`)
    .join('\n\n')
}

async function requestProviderText({ provider, messages, systemPrompt, responseInstructions, signal }) {
  if (provider === 'openai') {
    return requestOpenAIText({
      messages,
      systemPrompt,
      responseInstructions,
      signal,
    })
  }

  if (provider === 'groq') {
    return requestGroqText({
      messages,
      systemPrompt,
      responseInstructions,
      signal,
    })
  }

  return requestMistralText({
    messages,
    systemPrompt,
    responseInstructions,
    signal,
  })
}

function buildOpenAISystemMessage(systemPrompt) {
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

function buildOpenAIInstructionsMessage(responseInstructions) {
  return {
    role: 'system',
    content: [
      {
        type: 'input_text',
        text: responseInstructions,
      },
    ],
  }
}

function buildOpenAIConversation(messages = []) {
  return messages
    .filter((message) => message?.role === 'user' || message?.role === 'assistant')
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: [
        {
          type: message.role === 'assistant' ? 'output_text' : 'input_text',
          text: message.content,
        },
      ],
    }))
}

function buildChatConversation(messages = []) {
  return messages
    .filter((message) => message?.role === 'user' || message?.role === 'assistant')
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }))
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

async function emitTextChunks(text, onChunk, signal) {
  if (!text || !onChunk) {
    return
  }

  const parts = splitForStreaming(text)

  for (const part of parts) {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError')
    }

    onChunk(part)
    await delay(12)
  }
}

function splitForStreaming(text) {
  return text
    .split(/(\n\n|(?<=\.)\s+)/)
    .filter(Boolean)
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function extractJsonObject(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    return null
  }

  return text.slice(start, end + 1)
}

function sanitizeJsonCandidate(text) {
  if (!text) {
    return text
  }

  return text
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
}

function providerLabel(provider) {
  if (provider === 'openai') {
    return 'OpenAI'
  }

  if (provider === 'groq') {
    return 'Groq'
  }

  return 'Mistral'
}

function normalizeText(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^\w\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeMarkdownFallback(content, plan) {
  if (!content) {
    return ''
  }

  if (plan.mode === 'clarify') {
    return content.replace(/^###\s+/gm, '## ').replace(/^#\s+/gm, '## ')
  }

  const normalized = content.replace(/^###\s+/gm, '## ').replace(/^#\s+/gm, '## ')

  return ensurePlannedHeadings(normalized, plan)
}

function ensurePlannedHeadings(content, plan) {
  let result = content

  for (const section of plan.sections) {
    if (!section.title) {
      continue
    }

    const headingPattern = new RegExp(`^##\\s+${escapeRegExp(section.title)}\\s*$`, 'im')

    if (headingPattern.test(result)) {
      continue
    }

    const loosePattern = new RegExp(`^${escapeRegExp(section.title)}\\s*$`, 'im')

    if (loosePattern.test(result)) {
      result = result.replace(loosePattern, `## ${section.title}`)
    }
  }

  return result
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function repairMarkdownSections({ provider, messages, systemPrompt, plan, rawText, validation, signal }) {
  const missingIds = extractMissingSectionIds(validation.errors)
  const missingSections = plan.sections.filter((section) => missingIds.has(section.id))
  const sectionLines =
    missingSections.length > 0
      ? missingSections.map((section) => `- ${section.title}`).join('\n')
      : plan.sections.map((section) => `- ${section.title}`).join('\n')

  const repairPrompt = [
    'Return markdown only. Do not return JSON.',
    'The previous draft did not satisfy the required section structure.',
    `Errors: ${validation.errors.join('; ')}`,
    'Return content only for these sections, in this exact order, each as a markdown H2 heading:',
    sectionLines,
    'Rules:',
    '- Use exact section titles.',
    '- Do not include sections outside this list.',
    '- Do not add intro text or closing text.',
    '- Make the content specific to the same business request.',
    '- If A/B/C/D Follow-up Options is included, include exactly four options starting with A, B, C, and D.',
    `Previous draft for context:\n${rawText}`,
  ].join('\n\n')

  return requestProviderText({
    provider,
    messages,
    systemPrompt,
    responseInstructions: repairPrompt,
    signal,
  })
}

function parseMarkdownSections(content, plan) {
  if (plan.mode === 'clarify') {
    return {
      mode: plan.mode,
      sections: [
        {
          id: 'clarifying_questions',
          title: plan.sections[0]?.title || 'Clarifying Questions',
          content: stripSectionHeadingFromClarify(content, plan.sections[0]?.title || ''),
        },
      ],
    }
  }

  const lines = (content || '').split(/\r?\n/)
  const collected = new Map()
  let currentSectionId = null

  for (const line of lines) {
    const matchedSection = matchPlannedSectionHeading(line, plan)

    if (matchedSection) {
      currentSectionId = matchedSection.id

      if (!collected.has(currentSectionId)) {
        collected.set(currentSectionId, [])
      }

      continue
    }

    if (!currentSectionId) {
      continue
    }

    collected.get(currentSectionId).push(line)
  }

  return {
    mode: plan.mode,
    sections: plan.sections
      .filter((section) => collected.has(section.id))
      .map((section) => ({
        id: section.id,
        title: section.title,
        content: collected.get(section.id).join('\n').trim(),
      }))
      .filter((section) => section.content),
  }
}

function matchPlannedSectionHeading(line, plan) {
  const normalizedHeading = normalizeHeadingCandidate(line)

  if (!normalizedHeading) {
    return null
  }

  return (
    plan.sections.find((section) => {
      const normalizedTitle = normalizeHeadingCandidate(section.title)
      const aliases = getSectionAliases(section.id).map((alias) => normalizeHeadingCandidate(alias))

      return normalizedHeading === normalizedTitle || aliases.includes(normalizedHeading)
    }) || null
  )
}

function normalizeHeadingCandidate(value) {
  return (value || '')
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(/^\*\*+\s*/, '')
    .replace(/\s*\*+$/, '')
    .replace(/:$/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function getSectionAliases(sectionId) {
  const aliases = {
    business_snapshot: ['Business Overview'],
    real_problem_identified: ['Real Problem', 'Core Problem', 'Actual Problem'],
    pain_point_breakdown: ['Pain Points', 'Pain Point Analysis'],
    primary_solution_recommended: ['Recommended Solution', 'Primary Solution', 'Solution Recommended'],
    why_this_solution: ['Why This Works', 'Why This Solution Not Something Else'],
    is_a_website_needed: ['Website Needed', 'Do You Need a Website'],
    alternative_solutions: ['Alternatives', 'Alternative Approaches'],
    tech_stack: ['Tech Stack & Build Approach', 'Technology Stack'],
    key_features_to_build: ['Key Features', 'Features to Build', 'Core Features'],
    monetization_strategy: ['Pricing and Monetization', 'Pricing Strategy'],
    best_offer_to_sell: ['Best Offer', 'Recommended Offer', 'Package Recommendation'],
    recommended_next_steps: ['Next Steps', 'Recommended Actions'],
    follow_up_options: ['Follow-up Options', 'Want to Go Deeper'],
    clarifying_questions: ['Questions', 'Clarification Questions'],
    understanding_guide: ['Understanding Guide', 'How It Works', 'Day-to-Day Guide'],
    implementation_guide: ['Implementation Guide', 'Setup Guide', 'Step-by-Step Setup'],
    client_pitch_script: ['Client Pitch Script', 'Pitch Script', 'Sales Script'],
    full_solution_document: ['Full Solution Document', 'Solution Document', 'Detailed Solution'],
  }

  return aliases[sectionId] || []
}

function mergeStructuredSections(baseParsed, nextParsed, plan) {
  const merged = new Map()

  for (const section of baseParsed.sections || []) {
    merged.set(section.id, section)
  }

  for (const section of nextParsed.sections || []) {
    if (section?.content?.trim()) {
      merged.set(section.id, section)
    }
  }

  return {
    mode: plan.mode,
    sections: plan.sections
      .filter((section) => merged.has(section.id))
      .map((section) => merged.get(section.id)),
  }
}

function renderStrictTemplate(parsed, plan) {
  return renderStructuredResponse(parsed, plan)
}

function fillMissingStructuredSections(parsed, plan) {
  const sectionsById = new Map((parsed.sections || []).map((section) => [section.id, section]))

  return {
    mode: plan.mode,
    sections: plan.sections.map((section) => {
      const existing = sectionsById.get(section.id)

      if (existing?.content?.trim()) {
        return existing
      }

      return {
        id: section.id,
        title: section.title,
        content: buildSectionFallbackContent(section.id),
      }
    }),
  }
}

function buildSectionFallbackContent(sectionId) {
  if (sectionId === 'follow_up_options') {
    return [
      'A. Understanding Guide',
      'B. Implementation Guide',
      'C. Client Pitch Script',
      'D. Full Solution Document',
    ].join('\n')
  }

  return 'This section needs refinement from the current provider output. Re-run the analysis to refresh it.'
}

function extractMissingSectionIds(errors = []) {
  const ids = new Set()

  for (const error of errors) {
    const missingMatch = error.match(/^Missing required section:\s+(.+)$/)
    const emptyMatch = error.match(/^Section\s+(.+)\s+is missing content\.$/)

    if (missingMatch?.[1]) {
      ids.add(missingMatch[1].trim())
    }

    if (emptyMatch?.[1]) {
      ids.add(emptyMatch[1].trim())
    }
  }

  return ids
}

function stripSectionHeadingFromClarify(content, title) {
  if (!content) {
    return ''
  }

  const lines = content.split(/\r?\n/)

  if (normalizeHeadingCandidate(lines[0]) === normalizeHeadingCandidate(title)) {
    return lines.slice(1).join('\n').trim()
  }

  return content.trim()
}
