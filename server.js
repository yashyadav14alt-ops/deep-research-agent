import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(root, 'public');
const port = Number(process.env.PORT || 3000);

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readRequestBody(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 20_000) throw new Error('Request is too large.');
  }
  return JSON.parse(raw || '{}');
}

async function searchWeb(query) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'advanced',
      max_results: 6,
      include_answer: false,
      include_raw_content: false
    })
  });
  if (!response.ok) throw new Error(`Web search failed (${response.status}).`);
  const data = await response.json();
  return data.results || [];
}

async function searchOpenSources(query) {
  const encoded = encodeURIComponent(query);
  const headers = { 'user-agent': 'FieldnotesResearchAgent/0.1 (local research tool)' };
  const [wikiResponse, papersResponse] = await Promise.all([
    fetch(`https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encoded}&limit=5`, { headers }),
    fetch(`https://api.crossref.org/works?query.bibliographic=${encoded}&rows=5&select=title,author,URL,published,abstract,container-title,subject,DOI`, { headers })
  ]);
  if (!wikiResponse.ok && !papersResponse.ok) throw new Error('Open research sources are temporarily unavailable. Try again shortly.');
  const results = [];
  if (wikiResponse.ok) {
    const wiki = await wikiResponse.json();
    for (const page of wiki.pages || []) {
      results.push({ title: page.title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`, content: page.description || page.excerpt || '', source_type: 'Reference overview' });
    }
  }
  if (papersResponse.ok) {
    const papers = await papersResponse.json();
    for (const work of papers.message?.items || []) {
      const title = work.title?.[0];
      if (!title || !work.URL) continue;
      const abstract = (work.abstract || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const authors = (work.author || []).slice(0, 3).map((author) => [author.given, author.family].filter(Boolean).join(' ')).join(', ');
      const year = work.published?.['date-parts']?.[0]?.[0];
      const journal = work['container-title']?.[0];
      const details = [authors, journal, year].filter(Boolean).join(' · ');
      results.push({ title, url: work.URL, content: [details, abstract || (work.subject || []).slice(0, 5).join(', ')].filter(Boolean).join('. '), source_type: 'Scholarly record' });
    }
  }
  return results;
}

async function openSourceReport(topic, focus, sources) {
  const usable = sources.filter((source) => source.snippet.trim());
  const papers = usable.filter((source) => source.source_type === 'Scholarly record');
  const references = usable.filter((source) => source.source_type === 'Reference overview');
  const findings = usable.slice(0, 8).map((source) => ({
    title: source.title,
    detail: `${source.snippet.slice(0, 900)}${source.snippet.length > 900 ? '…' : ''}`,
    source_ids: [source.id]
  }));
  const deepDive = [
    { heading: 'Foundational context', items: references.slice(0, 3) },
    { heading: 'Research literature', items: papers.slice(0, 5) }
  ].filter((group) => group.items.length).map((group) => ({
    heading: group.heading,
    detail: group.items.map((item) => `${item.title}: ${item.snippet.slice(0, 480)}${item.snippet.length > 480 ? '…' : ''} [${item.id}]`).join('\n\n'),
    source_ids: group.items.map((item) => item.id)
  }));
  const related = sources.slice(8, 13).map((source) => ({ topic: source.title, why_it_matters: `This appeared in the same source search for “${topic}”; open the source to judge how closely it connects.` }));
  const report = {
    executive_summary: `This key-based-free briefing gathers public reference pages and scholarly records for “${topic}”. It organizes source descriptions and abstracts for exploration; it is not an AI-generated synthesis, and it does not independently verify the claims in those sources.`,
    key_findings: findings,
    deep_dive: deepDive,
    debates_and_limits: [{
      point: 'Evidence and coverage limits',
      detail: `This no-key mode searches public reference and Crossref scholarly metadata. It may miss paywalled or newer material, and abstracts are not full papers. Treat each source as a lead and open the original before relying on a claim.${focus ? ` Your requested angle was: ${focus}.` : ''}`,
      source_ids: usable.slice(0, 4).map((source) => source.id)
    }],
    related_topics: related,
    open_questions: [
      `Which claims in the sources have independent replication or confirmation?`,
      `What important evidence is missing from the abstracts and search snippets?`,
      focus ? `What evidence most directly addresses “${focus}”?` : `Which recent primary studies most change the picture?`
    ],
    conclusion: `The source set gives you a starting map of “${topic}”. For a deeper, model-written synthesis with cross-source comparison, configure an OpenAI key or run a local Ollama model.`
  };
  return { report, sources, generated_at: new Date().toISOString(), provider: 'Open public sources (no LLM)' };
}

async function generateWithOllama(topic, focus, sources) {
  const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'llama3.2';
  const sourceText = sources.map((source) => `[${source.id}] ${source.title}\nURL: ${source.url}\nExcerpt: ${source.snippet}`).join('\n\n');
  const response = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      messages: [
        { role: 'system', content: 'You are a careful research analyst. Use only supplied excerpts, cite factual claims with source IDs like [S1], and clearly explain uncertainty. Return JSON with executive_summary, key_findings[{title,detail,source_ids}], deep_dive[{heading,detail,source_ids}], debates_and_limits[{point,detail,source_ids}], related_topics[{topic,why_it_matters}], open_questions[], conclusion.' },
        { role: 'user', content: `Research topic: ${topic}\nFocus: ${focus || 'broad overview'}\n\nCreate a substantial, detailed source-grounded research report. Only cite supplied IDs.\n\n${sourceText}` }
      ],
      options: { temperature: 0.2 }
    })
  });
  if (!response.ok) throw new Error(`Local Ollama request failed (${response.status}); check that Ollama is running and the model is installed.`);
  const data = await response.json();
  let report;
  try { report = JSON.parse(data.message?.content || ''); }
  catch { throw new Error('Ollama returned an unexpected report format. Try another local model.'); }
  return { report, sources, generated_at: new Date().toISOString(), provider: `Local Ollama · ${model}` };
}

async function research(topic, focus, provider = 'auto') {
  const questions = [
    `${topic}: foundational concepts and current state`,
    `${topic}: strongest evidence, research findings, and examples`,
    `${topic}: limitations, risks, and competing viewpoints`,
    `${topic}: recent developments and future directions`,
    focus ? `${topic}: ${focus}` : `${topic}: related fields and open questions`
  ];
  if (provider === 'openai' && (!process.env.OPENAI_API_KEY || !process.env.TAVILY_API_KEY)) {
    throw new Error('OpenAI mode needs OPENAI_API_KEY and TAVILY_API_KEY. Choose Auto or No-key sources to research without keys.');
  }
  const useOpenAI = provider === 'openai' || (provider === 'auto' && process.env.OPENAI_API_KEY && process.env.TAVILY_API_KEY);
  const batches = await Promise.all(questions.map(useOpenAI ? searchWeb : searchOpenSources));
  const seen = new Set();
  const sources = batches.flat().filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  }).slice(0, 22).map((item, index) => ({
    id: `S${index + 1}`,
    title: item.title || item.url,
    url: item.url,
    snippet: item.content || '',
    source_type: item.source_type || 'Web search result'
  }));

  if (!sources.length) throw new Error('No usable sources found. Try a more specific topic.');
  if (provider === 'ollama') return generateWithOllama(topic, focus, sources);
  if (!useOpenAI) return openSourceReport(topic, focus, sources);

  const sourceText = sources.map((source) =>
    `[${source.id}] ${source.title}\nURL: ${source.url}\nSearch excerpt: ${source.snippet}`
  ).join('\n\n');
  const prompt = `Research topic: ${topic}\nRequested focus: ${focus || 'broad, detailed overview'}\n\nUse only the supplied source excerpts as evidence. Cite factual claims inline with source IDs like [S1]. Do not invent sources or claim to have read beyond the excerpts. Separate well-supported findings from uncertainty.\n\nReturn a JSON object with exactly these fields:\n{ "executive_summary": string, "key_findings": [{"title": string, "detail": string, "source_ids": [string]}], "deep_dive": [{"heading": string, "detail": string, "source_ids": [string]}], "debates_and_limits": [{"point": string, "detail": string, "source_ids": [string]}], "related_topics": [{"topic": string, "why_it_matters": string}], "open_questions": [string], "conclusion": string }\n\nMake this a substantial research briefing, not a short answer. Each finding and deep-dive section should explain context, mechanisms, and implications. Only cite IDs that appear in the sources below. If evidence is thin or search snippets disagree, say so explicitly.\n\nSOURCES\n${sourceText}`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: [
        { role: 'system', content: 'You are a careful research analyst. Ground every factual claim in the supplied material, cite it, and clearly label uncertainty.' },
        { role: 'user', content: prompt }
      ],
      text: { format: { type: 'json_object' } }
    })
  });
  if (!response.ok) throw new Error(`Report generation failed (${response.status}).`);
  const data = await response.json();
  const output = data.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text;
  if (!output) throw new Error('The research model returned an empty report.');
  let report;
  try { report = JSON.parse(output); }
  catch { throw new Error('The research model returned a report in an unexpected format. Please retry.'); }
  return { report, sources, generated_at: new Date().toISOString(), provider: 'OpenAI + Tavily' };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (request.method === 'POST' && url.pathname === '/api/research') {
    try {
      const body = await readRequestBody(request);
      const topic = String(body.topic || '').trim();
      const focus = String(body.focus || '').trim();
      const provider = String(body.provider || 'auto');
      if (topic.length < 4 || topic.length > 240) {
        return sendJson(response, 400, { error: 'Enter a topic between 4 and 240 characters.' });
      }
      if (!['auto', 'openai', 'ollama', 'sources'].includes(provider)) return sendJson(response, 400, { error: 'Unknown research provider.' });
      return sendJson(response, 200, await research(topic, focus.slice(0, 240), provider));
    } catch (error) {
      return sendJson(response, 502, { error: error.message || 'Research failed. Please try again.' });
    }
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }
  const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const file = normalize(join(publicDir, relative));
  if (!file.startsWith(publicDir)) return sendJson(response, 403, { error: 'Forbidden.' });
  try {
    const content = await readFile(file);
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
    response.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    sendJson(response, 404, { error: 'Not found.' });
  }
});

server.listen(port, () => console.log(`Deep Research Agent running at http://localhost:${port}`));
