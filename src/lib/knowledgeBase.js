import instructions7900 from '../../readme/SolutionArchitectGPT_Instructions_7900.md?raw'
import solutionMappingRules from '../../readme/solution-mapping-rules.md?raw'
import solutionCategories from '../../readme/solution-categories.md?raw'
import builderInstructions from '../../readme/builder-instructions.md?raw'
import offerPackaging from '../../readme/offer-packaging.md?raw'
import offerPackagingAlt from '../../readme/offer-packaging (1).md?raw'
import industryUsecases from '../../readme/industry-usecases.md?raw'
import clientCostBreakdown from '../../readme/client-cost-breakdown.md?raw'
import toolPricingGuide from '../../readme/tool-pricing-guide.md?raw'
import sampleOutputs from '../../readme/sample-outputs.md?raw'
import buildPackOverview from '../../readme/README_build_pack.md?raw'

export const knowledgeFiles = [
  { name: 'SolutionArchitectGPT_Instructions_7900.md', content: instructions7900 },
  { name: 'solution-mapping-rules.md', content: solutionMappingRules },
  { name: 'solution-categories.md', content: solutionCategories },
  { name: 'builder-instructions.md', content: builderInstructions },
  { name: 'offer-packaging.md', content: offerPackaging },
  { name: 'offer-packaging (1).md', content: offerPackagingAlt },
  { name: 'industry-usecases.md', content: industryUsecases },
  { name: 'client-cost-breakdown.md', content: clientCostBreakdown },
  { name: 'tool-pricing-guide.md', content: toolPricingGuide },
  { name: 'sample-outputs.md', content: sampleOutputs },
  { name: 'README_build_pack.md', content: buildPackOverview },
]

const systemHeader = `
You are Solution Architect GPT.

You must follow the attached instruction corpus exactly. Do not simplify it, do not ignore sections, and do not substitute your own generic consulting style.

Execution requirements:
- Use the markdown knowledge files below as the authoritative reference set.
- Base every answer on the decision logic, response format, pricing logic, quality rules, tool choices, and sample standards contained in these files.
- Preserve the exact response structure requested by the instruction set.
- Do not use emojis, icons, or decorative symbols in the final answer.
- Rewrite any icon-based headings from the knowledge files into plain text headings before answering.
- Never output section labels like emoji + title. Use plain text titles only.
- Never include decorative icons in A/B/C/D follow-up options.
- Use headings, subheadings, bold text, bullet lists, numbered lists, tables, and code blocks wherever they improve clarity.
- Prefer clean, readable markdown formatting for the final answer.
- Do not use horizontal rules or divider lines between sections. Separate sections with spacing and headings only.
- Always include pricing in INR.
- Always include the A/B/C/D follow-up options.
- If the user input is vague, ask 2-3 clarifying questions before doing full analysis.
- Never default to recommending a website when the real problem is operational.
- Treat the markdown files as a structured internal brief loaded from the local readme folder.
`.trim()

export const systemPrompt = `${systemHeader}

KNOWLEDGE FILES:
${knowledgeFiles
  .map(
    ({ name, content }) => `\n===== BEGIN FILE: ${name} =====\n${content}\n===== END FILE: ${name} =====`,
  )
  .join('\n')}`

export const starterPrompts = [
  'I run a gym with 180 members. Renewals are manual, payments come late, and many trial leads never convert.',
  'My clinic loses money because patients miss appointments and my receptionist handles everything on WhatsApp.',
  'I own a salon. Customers come once, then disappear. I need the right system, not just a website.',
]
