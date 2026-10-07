# Fieldnotes user guide

Fieldnotes helps you explore a research question and organize source leads into a structured briefing. Use it to get oriented and plan follow-up research. Open the original sources and verify important claims before relying on them.

## Start a briefing

1. Start the app with `npm start` and open `http://localhost:3000`.
2. Enter a focused question. Example: `What limits sodium-ion batteries for grid storage?`
3. Optionally add an angle, such as `manufacturing cost compared with lithium-ion`.
4. Choose a research mode and click **Start research**.

Short, specific questions make it easier to judge whether results are relevant. For a broad topic, explore one angle at a time.

## Choose a research mode

- **Automatic:** uses OpenAI + Tavily if both keys are configured; otherwise uses the no-key source briefing.
- **No-key source briefing:** searches public Wikipedia and Crossref records and organizes the available excerpts and metadata. It does not use an LLM to synthesize sources. It needs internet access.
- **Local Ollama model:** searches public sources, then asks your local Ollama server to organize the excerpts. Ollama must be running and the selected model installed. Defaults are `http://127.0.0.1:11434` and `llama3.2`.
- **OpenAI + Tavily:** uses Tavily search and asks OpenAI to synthesize the returned excerpts. Both `OPENAI_API_KEY` and `TAVILY_API_KEY` must be set in the server environment.

See [the README](../README.md#quick-start) for startup and key setup. The app reads environment variables directly; it does not load `.env` files.

## Read the briefing

- **Key findings / deep dive:** scan the source-linked excerpts and, in model modes, the synthesis.
- **Debates & evidence limits:** note what the available search could not establish.
- **Sources:** open the original link and check its date, methods, and context.
- **Related topics / open questions:** use these to plan the next search.

The MVP uses search excerpts and scholarly metadata, not full papers or webpages. Results may be incomplete, outdated, or unrelated, and the app does not independently verify source claims. Reports are not saved.

## Data handling

- No-key and Ollama modes send search queries to public Wikipedia and Crossref endpoints.
- Hosted mode sends queries to Tavily; returned excerpts are sent to OpenAI for synthesis.
- Ollama synthesis is sent to the configured local Ollama server.
- API keys are read by the server process. Keep them out of the browser, source files, and Git history.

## Good research habits

Treat Fieldnotes as a starting map, not a final answer. Confirm key claims in primary sources, compare independent evidence, and check publication dates. Do not use a generated briefing as professional medical, legal, or financial advice.
