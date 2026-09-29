# Deep Research Agent

A source-grounded AI research assistant. Enter a topic and optional angle to find public sources and produce a detailed, cited briefing.

## Research modes

- Automatic: uses OpenAI and Tavily when configured; otherwise uses the no-key source briefing.
- No-key source briefing: searches public Wikipedia and Crossref records and organizes source excerpts. This mode is not an LLM synthesis.
- Local Ollama: uses a model running on your machine to synthesize retrieved sources.
- OpenAI + Tavily: uses hosted search and model APIs. Keys stay on the server.

## Run locally

Requires Node.js 20 or newer. The default mode works without API keys if the machine can reach Wikipedia and Crossref.

Set OPENAI_API_KEY and TAVILY_API_KEY to enable hosted synthesis. Optionally set OPENAI_MODEL, OLLAMA_BASE_URL, OLLAMA_MODEL, or PORT. The app reads environment variables; it does not load a .env file itself.

Start the app with npm start and open http://localhost:3000.

## Current limits

Search snippets and scholarly metadata are used as evidence; the MVP does not fetch and parse full webpages. No-key mode organizes source excerpts and clearly identifies itself as a source briefing, not an AI-generated synthesis. Reports are not saved yet.

## Next milestones

1. Fetch and extract full pages, with claim-to-source provenance.
2. Add source quality signals, retries, budgets, and clear failure states.
3. Add saved research projects and Markdown export.
4. Evaluate citation support and evidence coverage.
