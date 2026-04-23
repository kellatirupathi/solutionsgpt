# Solution Architect GPT

Frontend-only React application for the `Solution Architect GPT` workflow.

## Stack

- React + Vite
- Tailwind CSS
- OpenAI Responses API
- Model: `gpt-4.1`

## Knowledge Source

The app imports the markdown files from [`readme/`](./readme) at build time and combines them into the system prompt used for analysis.

## Run

```bash
npm install
npm run dev
```

## Notes

- This build intentionally has no backend.
- Provider config is read from `.env`.
- Supported providers: Mistral, Groq, and OpenAI.
- Use `VITE_AI_PROVIDER=mistral`, `VITE_AI_PROVIDER=groq`, or `VITE_AI_PROVIDER=openai` to choose the primary provider.
- If the primary provider is unavailable but the other key exists, the app will fall back automatically.
