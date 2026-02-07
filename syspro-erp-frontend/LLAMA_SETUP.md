# Llama AI Draft Setup

The staff-reporting feature can tap a local Llama 3.1 model (via Ollama) to convert raw transcripts into fully structured report templates. This document covers the development setup.

## Requirements
- **Ollama** installed locally (https://ollama.com/download) 
- Hardware capable of running the chosen model:
  - `llama3.1:8b` works on modern CPUs with ≥16 GB RAM
  - `llama3.1:70b` requires a GPU box (or lots of RAM + patience); compressions like q4_K_M are recommended
- Node.js server can reach `http://localhost:11434`

## Quick start
```bash
# 1) Install Ollama and ensure the service is running
ollama --version

# 2) Pull the desired model (modify quantization if needed)
ollama pull llama3.1:70b

# 3) Keep the Ollama daemon running, then start the Next.js dev server
npm run dev
```

The API route `/api/hr/staff-reports/ai-draft` now calls Ollama first. If the local model is available and returns clean JSON, the component shows “Report structured by Llama …”. If the call fails, it automatically falls back to the lightweight heuristic chunker.

## Configuration
Environment variables (optional):

| Variable | Default | Purpose |
| --- | --- | --- |
| `LLAMA_API_URL` | `http://localhost:11434/api/generate` | Point to remote Ollama/Text-Generation endpoint |
| `LLAMA_MODEL` | `llama3.1:70b` | Model name passed to the endpoint |
| `LLAMA_TIMEOUT_MS` | `8000` | Abort request if Llama takes too long |
| `DISABLE_LLAMA_AGENT` | _(unset)_ | Set to `true` to bypass the Llama call entirely |

Set these in `.env.local` if you need non-default values.

## Notes
- The server asks Llama to return **only** JSON; if it emits anything else the backend discards it and falls back.
- Streaming is disabled for now to keep parsing simple. If we later switch to `/api/chat` streaming endpoints we’ll need a different parser.
- For production you’d likely host Llama behind an authenticated endpoint (e.g., TGI, vLLM). Wire the auth header in `route.ts` where the fetch call is made.
