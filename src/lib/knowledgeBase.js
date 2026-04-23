import masterInstructions from '../../readme/SolutionArchitectGPT_Instructions_7900.md?raw'

const SYSTEM_HEADER = `
You are Solution Architect GPT.

Use the master instruction file below as the only authoritative prompt document.
Do not rely on any separate markdown knowledge files.

Execution rules:
- Follow the master instruction file exactly.
- Use plain text headings only.
- Do not output emojis or decorative icons.
- Use INR pricing.
- Keep the response specific to the business input.
- If the request is vague, ask clarifying questions instead of forcing a full solution.
- In the same chat, treat short follow-up prompts as continuations of the existing business context unless the user clearly changes topic.
`.trim()

const businessProfiles = [
  {
    label: 'gym',
    terms: ['gym', 'fitness', 'member', 'membership', 'renewal'],
  },
  {
    label: 'clinic',
    terms: ['clinic', 'doctor', 'patient', 'appointment', 'consultation'],
  },
  {
    label: 'salon',
    terms: ['salon', 'spa', 'beauty'],
  },
  {
    label: 'restaurant',
    terms: ['restaurant', 'cafe', 'food', 'dine', 'delivery', 'order'],
  },
  {
    label: 'coaching',
    terms: ['coaching', 'tuition', 'institute', 'student', 'admission'],
  },
  {
    label: 'real estate',
    terms: ['real estate', 'property', 'broker', 'site visit', 'agent'],
  },
  {
    label: 'kirana',
    terms: ['kirana', 'grocery', 'retail', 'credit customer'],
  },
  {
    label: 'agency',
    terms: ['agency', 'freelancer', 'client project', 'digital agency'],
  },
  {
    label: 'contractor',
    terms: ['contractor', 'construction', 'project', 'site'],
  },
  {
    label: 'workshop',
    terms: ['workshop', 'garage', 'mechanic', 'service center', 'job card'],
  },
  {
    label: 'logistics',
    terms: ['logistics', 'delivery', 'dispatch', 'courier', 'proof of delivery'],
  },
  {
    label: 'photography',
    terms: ['photographer', 'photography', 'wedding photographer'],
  },
]

const solutionProfiles = [
  {
    label: 'payment reminders',
    terms: ['payment', 'due', 'dues', 'overdue', 'renewal', 'credit', 'collections'],
  },
  {
    label: 'member management',
    terms: ['member', 'membership', 'attendance', 'renewal', 'inactive member'],
  },
  {
    label: 'crm',
    terms: ['lead', 'crm', 'pipeline', 'follow-up', 'follow up', 'conversion'],
  },
  {
    label: 'whatsapp automation',
    terms: ['whatsapp', 'bot', 'chatbot', 'broadcast', 'messages', 'faq'],
  },
  {
    label: 'booking',
    terms: ['appointment', 'booking', 'no-show', 'schedule'],
  },
  {
    label: 'loyalty',
    terms: ['loyalty', 'repeat customer', 'retention', 'reward'],
  },
  {
    label: 'dashboard',
    terms: ['dashboard', 'kpi', 'report', 'visibility', 'analytics'],
  },
  {
    label: 'website',
    terms: ['website', 'landing page', 'seo', 'google', 'ads'],
  },
  {
    label: 'inventory',
    terms: ['inventory', 'stock', 'stockout', 'reorder'],
  },
  {
    label: 'billing',
    terms: ['invoice', 'billing', 'receipt', 'gst'],
  },
  {
    label: 'ai assistant',
    terms: ['ai assistant', 'support bot', 'sales bot', 'voice agent'],
  },
]

const followUpSections = [
  {
    id: 'understanding_guide',
    title: 'Understanding Guide',
    required: true,
    patterns: [
      /^a$/,
      /^a[:.)-]\s*$/,
      /understanding guide/,
      /^understanding$/,
      /how the system works day to day/,
      /day to day/,
    ],
  },
  {
    id: 'implementation_guide',
    title: 'Implementation Guide',
    required: true,
    patterns: [
      /^b$/,
      /^b[:.)-]\s*$/,
      /implementation guide/,
      /step by step setup/,
      /setup instructions/,
    ],
  },
  {
    id: 'client_pitch_script',
    title: 'Client Pitch Script',
    required: true,
    patterns: [
      /^c$/,
      /^c[:.)-]\s*$/,
      /client pitch script/,
      /pitch script/,
      /sell this solution/,
    ],
  },
  {
    id: 'full_solution_document',
    title: 'Full Solution Document',
    required: true,
    patterns: [
      /^d$/,
      /^d[:.)-]\s*$/,
      /full solution document/,
      /full solution/,
      /detailed workflows/,
      /screenshots/,
      /sample or dummy/,
      /take sample/,
      /then create/,
    ],
  },
]

export const knowledgeFiles = [
  {
    name: 'SolutionArchitectGPT_Instructions_7900.md',
    content: masterInstructions,
    mode: 'full',
  },
]

export const starterPrompts = [
  'I run a gym with 180 members. Renewals are manual, payments come late, and many trial leads never convert.',
  'My clinic loses money because patients miss appointments and my receptionist handles everything on WhatsApp.',
  'I own a salon. Customers come once, then disappear. I need the right system, not just a website.',
]

export const sectionCatalog = {
  business_snapshot: 'Business Snapshot',
  real_problem_identified: 'Real Problem Identified',
  pain_point_breakdown: 'Pain Point Breakdown',
  primary_solution_recommended: 'Primary Solution Recommended',
  why_this_solution: 'Why This Solution',
  is_a_website_needed: 'Is a Website Needed',
  alternative_solutions: 'Alternative Solutions',
  tech_stack: 'Tech Stack',
  key_features_to_build: 'Key Features to Build',
  monetization_strategy: 'Monetization Strategy',
  best_offer_to_sell: 'Best Offer to Sell',
  recommended_next_steps: 'Recommended Next Steps',
  follow_up_options: 'A/B/C/D Follow-up Options',
  clarifying_questions: 'Clarifying Questions',
  understanding_guide: 'Understanding Guide',
  implementation_guide: 'Implementation Guide',
  client_pitch_script: 'Client Pitch Script',
  full_solution_document: 'Full Solution Document',
}

export function buildSystemPrompt({ messages = [] } = {}) {
  const conversationContext = buildConversationContext(messages)
  const plan = buildResponsePlan({ messages })

  const requestHints = [
    conversationContext.businessProfile
      ? `- Detected business type: ${conversationContext.businessProfile.label}`
      : null,
    conversationContext.solutionHints.length > 0
      ? `- Likely solution families: ${conversationContext.solutionHints
          .map((profile) => profile.label)
          .join(', ')}`
      : null,
    `- Response mode: ${plan.mode}`,
    `- Required sections: ${plan.sections.map((section) => section.title).join(', ')}`,
    conversationContext.followUpRequest
      ? `- This user message is a follow-up request: ${conversationContext.followUpRequest.title}`
      : null,
    conversationContext.hasPriorContext
      ? '- Use the established same-chat context. Do not restart discovery unless the user clearly changes topic.'
      : null,
  ]
    .filter(Boolean)
    .join('\n')

  return `${SYSTEM_HEADER}

REQUEST-SPECIFIC HINTS:
${requestHints}

MASTER INSTRUCTION FILE:
===== BEGIN FILE: SolutionArchitectGPT_Instructions_7900.md =====
${masterInstructions.trim()}
===== END FILE: SolutionArchitectGPT_Instructions_7900.md =====`
}

export function buildResponsePlan({ messages = [] } = {}) {
  const conversationContext = buildConversationContext(messages)

  if (conversationContext.followUpRequest && conversationContext.hasPriorContext) {
    return {
      mode: 'analysis',
      businessType: conversationContext.businessProfile?.label || '',
      solutionHints: conversationContext.solutionHints.map((profile) => profile.label),
      sections: [
        {
          id: conversationContext.followUpRequest.id,
          title: conversationContext.followUpRequest.title,
          required: true,
        },
      ],
    }
  }

  if (shouldAskClarifyingQuestions(conversationContext)) {
    return {
      mode: 'clarify',
      businessType: conversationContext.businessProfile?.label || '',
      solutionHints: conversationContext.solutionHints.map((profile) => profile.label),
      sections: [
        {
          id: 'clarifying_questions',
          title: sectionCatalog.clarifying_questions,
          required: true,
          guidance:
            'Ask 2-3 short clarifying questions before giving the full analysis. Do not generate the rest of the solution sections yet.',
        },
      ],
    }
  }

  return {
    mode: 'analysis',
    businessType: conversationContext.businessProfile?.label || '',
    solutionHints: conversationContext.solutionHints.map((profile) => profile.label),
    sections: [
      { id: 'business_snapshot', title: sectionCatalog.business_snapshot, required: true },
      {
        id: 'real_problem_identified',
        title: sectionCatalog.real_problem_identified,
        required: true,
      },
      {
        id: 'pain_point_breakdown',
        title: sectionCatalog.pain_point_breakdown,
        required: true,
      },
      {
        id: 'primary_solution_recommended',
        title: sectionCatalog.primary_solution_recommended,
        required: true,
      },
      { id: 'why_this_solution', title: sectionCatalog.why_this_solution, required: true },
      { id: 'is_a_website_needed', title: sectionCatalog.is_a_website_needed, required: true },
      {
        id: 'alternative_solutions',
        title: sectionCatalog.alternative_solutions,
        required: true,
      },
      { id: 'tech_stack', title: sectionCatalog.tech_stack, required: true },
      {
        id: 'key_features_to_build',
        title: sectionCatalog.key_features_to_build,
        required: true,
      },
      {
        id: 'monetization_strategy',
        title: sectionCatalog.monetization_strategy,
        required: true,
      },
      { id: 'best_offer_to_sell', title: sectionCatalog.best_offer_to_sell, required: true },
      {
        id: 'recommended_next_steps',
        title: sectionCatalog.recommended_next_steps,
        required: true,
      },
      { id: 'follow_up_options', title: sectionCatalog.follow_up_options, required: true },
    ],
  }
}

function getLatestUserInput(messages) {
  return (
    [...messages]
      .reverse()
      .find((message) => message?.role === 'user')
      ?.content || ''
  )
}

function getUserMessages(messages) {
  return messages.filter((message) => message?.role === 'user' && message?.content?.trim())
}

function buildConversationContext(messages) {
  const latestUserInput = getLatestUserInput(messages)
  const userMessages = getUserMessages(messages)
  const previousUserText = userMessages
    .slice(0, -1)
    .map((message) => message.content)
    .join('\n')
  const fullUserText = userMessages.map((message) => message.content).join('\n')
  const normalizedLatestInput = normalizeText(latestUserInput)
  const normalizedPreviousInput = normalizeText(previousUserText)
  const normalizedConversationInput = normalizeText(fullUserText)
  const latestBusinessProfile = matchBestProfile(businessProfiles, normalizedLatestInput)
  const previousBusinessProfile = matchBestProfile(businessProfiles, normalizedPreviousInput)
  const latestSolutionHints = matchSolutionProfiles(normalizedLatestInput, { allowFallback: false })
  const previousSolutionHints = matchSolutionProfiles(normalizedPreviousInput, { allowFallback: false })

  return {
    latestUserInput,
    normalizedLatestInput,
    normalizedPreviousInput,
    normalizedConversationInput,
    hasPriorContext:
      userMessages.length > 1 || Boolean(previousBusinessProfile) || previousSolutionHints.length > 0,
    businessProfile:
      latestBusinessProfile ||
      previousBusinessProfile ||
      matchBestProfile(businessProfiles, normalizedConversationInput),
    solutionHints:
      latestSolutionHints.length > 0
        ? latestSolutionHints
        : previousSolutionHints.length > 0
          ? previousSolutionHints
          : matchSolutionProfiles(normalizedConversationInput),
    followUpRequest: detectFollowUpRequest(normalizedLatestInput),
  }
}

function matchBestProfile(profiles, queryText) {
  let bestProfile = null
  let bestScore = 0

  for (const profile of profiles) {
    const score = profile.terms.reduce(
      (total, term) => total + (queryText.includes(normalizeText(term)) ? 1 : 0),
      0,
    )

    if (score > bestScore) {
      bestProfile = profile
      bestScore = score
    }
  }

  return bestProfile
}

function matchSolutionProfiles(queryText, { allowFallback = true } = {}) {
  const matches = solutionProfiles
    .map((profile) => ({
      profile,
      score: profile.terms.reduce(
        (total, term) => total + (queryText.includes(normalizeText(term)) ? 1 : 0),
        0,
      ),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((entry) => entry.profile)

  if (matches.length > 0 || !allowFallback) {
    return matches
  }

  return [
    solutionProfiles.find((profile) => profile.label === 'crm'),
    solutionProfiles.find((profile) => profile.label === 'payment reminders'),
  ].filter(Boolean)
}

function normalizeText(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^\w\s/+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function shouldAskClarifyingQuestions(conversationContext) {
  const { normalizedLatestInput, normalizedConversationInput, hasPriorContext, followUpRequest } =
    conversationContext

  if (!normalizedLatestInput) {
    return !hasPriorContext
  }

  if (followUpRequest && hasPriorContext) {
    return false
  }

  if (hasPriorContext && (hasBusinessSignal(normalizedConversationInput) || hasPainSignal(normalizedConversationInput))) {
    return false
  }

  const latestWords = normalizedLatestInput.split(' ').filter(Boolean)
  return latestWords.length < 8 || (!hasBusinessSignal(normalizedLatestInput) && !hasPainSignal(normalizedLatestInput))
}

function hasBusinessSignal(normalizedInput) {
  if (!normalizedInput) {
    return false
  }

  return businessProfiles.some((profile) =>
    profile.terms.some((term) => normalizedInput.includes(normalizeText(term))),
  )
}

function hasPainSignal(normalizedInput) {
  if (!normalizedInput) {
    return false
  }

  return solutionProfiles.some((profile) =>
    profile.terms.some((term) => normalizedInput.includes(normalizeText(term))),
  )
}

function detectFollowUpRequest(normalizedInput) {
  if (!normalizedInput) {
    return null
  }

  return (
    followUpSections.find((section) =>
      section.patterns.some((pattern) =>
        typeof pattern === 'string' ? normalizedInput.includes(pattern) : pattern.test(normalizedInput),
      ),
    ) || null
  )
}
