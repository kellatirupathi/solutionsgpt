# Solution Architect GPT Build Pack

## Current Architecture

This application now uses a single master instruction file:

- `SolutionArchitectGPT_Instructions_7900.md`

That file is the only runtime prompt and knowledge document used by the app.

The application still keeps small planning heuristics in code:
- `src/lib/knowledgeBase.js` decides clarify mode vs analysis mode
- `src/lib/knowledgeBase.js` decides which response sections are required
- `src/lib/openai.js` handles provider calls, streaming, validation, and fallback behavior

## Active Prompt Flow

1. User enters the business problem
2. The app checks whether the input is clear enough for full analysis
3. The app builds a response plan in code
4. The app sends the user input, the response plan context, and the single master instruction file to the selected model
5. The model returns either clarifying questions or the structured business solution response

## Why This Changed

The old setup used multiple markdown knowledge files:
- harder to maintain
- more prompt assembly complexity
- more ambiguity about which file was authoritative
- larger runtime context

The new setup keeps one maintained source of truth and reduces prompt-management overhead.

## Legacy Prompt Pack

The previous multi-file prompt pack is archived here:

- `readme/archive/legacy-prompt-pack/`

Those files are kept only for historical reference. They are not part of the active runtime prompt path anymore.

Archived files:
- `builder-instructions.md`
- `client-cost-breakdown.md`
- `industry-usecases.md`
- `offer-packaging.md`
- `offer-packaging (1).md`
- `sample-outputs.md`
- `solution-categories.md`
- `solution-mapping-rules.md`
- `tool-pricing-guide.md`

## Maintenance Rule

If you want to improve solution quality, update the master file first:

- `readme/SolutionArchitectGPT_Instructions_7900.md`

Only change code when the behavior itself must change, such as:
- response section selection
- clarify-mode thresholds
- provider behavior
- validation and fallback rules

This keeps instruction maintenance and application logic cleanly separated.
