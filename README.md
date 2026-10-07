# Fieldnotes — Deep Research Agent

Fieldnotes turns a research question into a structured briefing with source links, evidence limits, and follow-up questions. It is an exploratory research aid: open the original sources and verify important claims before relying on them.

[Read the user guide](docs/user-guide.md) · [Open the in-app guide](public/guide.html) · [UGC ad scripts](marketing/ugc-ad-scripts.md) · [Star this project on GitHub](https://github.com/yashyadav14alt-ops/deep-research-agent)

## Quick start

Requires Node.js 20 or newer. The no-key source briefing needs an internet connection to search Wikipedia and Crossref.

```sh
git clone https://github.com/yashyadav14alt-ops/deep-research-agent.git
cd deep-research-agent
npm start
```

Open [http://localhost:3000](http://localhost:3000), enter a question, optionally add an angle, choose a research mode, and select **Start research**.

## Research modes

| Mode | What it does | Setup |
| --- | --- | --- |
| Automatic | Uses OpenAI + Tavily when both keys are configured; otherwise creates a no-key source briefing. | None for no-key mode; configure both keys for hosted synthesis. |
| No-key source briefing | Searches public Wikipedia pages and Crossref scholarly records, then organizes available excerpts and metadata. It does not use an LLM to synthesize the sources. | Internet access. |
| Local Ollama model | Searches the same public sources, then asks a locally running Ollama model to organize the excerpts. | Ollama running locally, with the selected model installed. Defaults to `http://127.0.0.1:11434` and `llama3.2`. |
| OpenAI + Tavily | Searches with Tavily and asks OpenAI to produce a source-grounded briefing from the returned excerpts. | `OPENAI_API_KEY` and `TAVILY_API_KEY`. |

To enable hosted mode, set the keys in the environment where the server runs, then restart the app:

```powershell
$env:OPENAI_API_KEY = "your-openai-key"
$env:TAVILY_API_KEY = "your-tavily-key"
npm start
```

macOS/Linux:

```sh
export OPENAI_API_KEY="your-openai-key"
export TAVILY_API_KEY="your-tavily-key"
npm start
```

The server reads environment variables directly; it does not load a `.env` file. Never commit real keys. Optional settings: `OPENAI_MODEL`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and `PORT`.

## What you get

Briefings include key findings, a deeper dive, debates and evidence limits, related topics, open questions, a conclusion, and links to the collected sources. The optional angle helps narrow the search. The app currently uses search excerpts and scholarly metadata rather than fetching full webpages or papers; reports are not saved.

## Data and limitations

- No-key and Ollama modes send search queries to public Wikipedia and Crossref endpoints.
- Hosted mode sends queries to Tavily; the returned excerpts are then sent to OpenAI for synthesis.
- Ollama synthesis is sent to the configured local Ollama server.
- The app does not save reports. Search results can be incomplete, outdated, or unrelated; abstracts are not full papers.
- Source links are research leads. Check original sources, methods, dates, and context before citing or making decisions.

See the [full user guide](public/guide.html) for examples and a step-by-step workflow.

## Development

```sh
npm start
```

The app uses Node's built-in HTTP server and has no runtime npm dependencies. Its API accepts `POST /api/research` with `topic`, optional `focus`, and `provider` (`auto`, `sources`, `ollama`, or `openai`).

## Roadmap

- Fetch and extract full pages, with claim-to-source provenance.
- Add source quality signals, retries, budgets, and clear failure states.
- Add saved research projects and Markdown export.
- Evaluate citation support and evidence coverage.
