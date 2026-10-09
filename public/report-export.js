function plainText(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim();
}

function markdownText(value) {
  return plainText(value).replace(/([\\`*_{}\[\]()#+\-.!|>])/g, '\\$1');
}

function sourceReferences(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return '';
  return `\n\nSources: ${ids.map((id) => `[${markdownText(id)}]`).join(', ')}`;
}

function appendEntries(lines, heading, entries, titleField) {
  lines.push(`## ${heading}`, '');
  if (!Array.isArray(entries) || entries.length === 0) {
    lines.push('_No items were returned._', '');
    return;
  }

  for (const item of entries) {
    lines.push(`### ${markdownText(item?.[titleField] || 'Untitled')}`, '');
    if (item?.detail) lines.push(markdownText(item.detail), '');
    if (item?.why_it_matters) lines.push(markdownText(item.why_it_matters), '');
    const references = sourceReferences(item?.source_ids);
    if (references) lines.push(references.trim(), '');
  }
}

export function safeSourceUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

export function formatReportAsMarkdown(data, topic) {
  const report = data?.report || {};
  const generatedAt = new Date(data?.generated_at || '');
  const timestamp = Number.isNaN(generatedAt.getTime()) ? 'Unavailable' : generatedAt.toISOString();
  const lines = [
    `# ${markdownText(topic)}`,
    '',
    `> Generated: ${timestamp}`,
    `> Research mode: ${markdownText(data?.provider || 'Research mode')}`,
    '',
    markdownText(report.executive_summary || ''),
    ''
  ];

  appendEntries(lines, 'Key findings', report.key_findings, 'title');
  appendEntries(lines, 'Deep dive', report.deep_dive, 'heading');
  appendEntries(lines, 'Debates and evidence limits', report.debates_and_limits, 'point');

  lines.push('## Related topics', '');
  if (Array.isArray(report.related_topics) && report.related_topics.length) {
    for (const item of report.related_topics) {
      lines.push(`- **${markdownText(item?.topic || 'Untitled')}** — ${markdownText(item?.why_it_matters || '')}`);
    }
    lines.push('');
  } else {
    lines.push('_No items were returned._', '');
  }

  lines.push('## Open questions', '');
  if (Array.isArray(report.open_questions) && report.open_questions.length) {
    for (const question of report.open_questions) lines.push(`- ${markdownText(question)}`);
    lines.push('');
  } else {
    lines.push('_No items were returned._', '');
  }

  lines.push('## Conclusion', '', markdownText(report.conclusion || '_No conclusion was returned._'), '');
  lines.push('## Sources', '');
  const sources = Array.isArray(data?.sources) ? data.sources : [];
  if (sources.length) {
    for (const source of sources) {
      const id = markdownText(source?.id || 'Source');
      const title = markdownText(source?.title || source?.url || 'Untitled source');
      const url = safeSourceUrl(source?.url);
      lines.push(url ? `- [${id}] [${title}](<${url}>)` : `- [${id}] ${title}`);
      if (source?.snippet) lines.push(`  - ${markdownText(source.snippet)}`);
    }
  } else {
    lines.push('_No source records were returned._');
  }

  return `${lines.join('\n').trim()}\n`;
}

export function markdownFilename(topic) {
  const slug = String(topic ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return `${slug || 'research-briefing'}.md`;
}
