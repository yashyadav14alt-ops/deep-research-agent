import test from 'node:test';
import assert from 'node:assert/strict';
import { formatReportAsMarkdown, markdownFilename, safeSourceUrl } from '../public/report-export.js';

const sample = {
  provider: 'OpenAI + Tavily',
  generated_at: '2026-10-09T12:00:00.000Z',
  report: {
    executive_summary: 'A short overview.',
    key_findings: [{ title: 'Finding one', detail: 'Supported detail.', source_ids: ['S1'] }],
    deep_dive: [{ heading: 'Context', detail: 'More detail.', source_ids: ['S1', 'S2'] }],
    debates_and_limits: [{ point: 'Coverage', detail: 'Search results may be incomplete.' }],
    related_topics: [{ topic: 'Related field', why_it_matters: 'It provides context.' }],
    open_questions: ['What evidence is missing?'],
    conclusion: 'A starting point.'
  },
  sources: [
    { id: 'S1', title: 'Primary source', url: 'https://example.org/paper?id=1', snippet: 'Abstract excerpt.' },
    { id: 'S2', title: 'Unsafe source', url: 'javascript:alert(1)', snippet: 'Untrusted excerpt.' }
  ]
};

test('exports report sections, citations, and only safe source links', () => {
  const markdown = formatReportAsMarkdown(sample, 'Research topic');

  for (const heading of ['# Research topic', '## Key findings', '## Deep dive', '## Debates and evidence limits', '## Related topics', '## Open questions', '## Conclusion', '## Sources']) {
    assert.ok(markdown.includes(heading), `missing ${heading}`);
  }
  assert.match(markdown, /Sources: \[S1\]/);
  assert.match(markdown, /\[S1\] \[Primary source\]\(<https:\/\/example\.org\/paper\?id=1>\)/);
  assert.doesNotMatch(markdown, /javascript:/i);
});

test('escapes Markdown control characters in generated report text', () => {
  const markdown = formatReportAsMarkdown({ report: { executive_summary: '# injected heading' }, sources: [] }, 'A [topic]');

  assert.ok(markdown.includes('# A \\[topic\\]'));
  assert.ok(markdown.includes('\\# injected heading'));
});

test('sanitizes filenames and falls back for empty or non-Latin topics', () => {
  assert.equal(markdownFilename('Café: AI / Science?'), 'cafe-ai-science.md');
  assert.equal(markdownFilename('研究'), 'research-briefing.md');
});

test('rejects non-HTTP source links', () => {
  assert.equal(safeSourceUrl('javascript:alert(1)'), '');
  assert.equal(safeSourceUrl('https://example.org/path'), 'https://example.org/path');
});
