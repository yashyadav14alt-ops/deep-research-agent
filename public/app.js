import { formatReportAsMarkdown, markdownFilename, safeSourceUrl } from './report-export.js';

const form = document.querySelector('#research-form');
const result = document.querySelector('#result');
const topicField = document.querySelector('#topic');
const focusField = document.querySelector('#focus');

document.querySelectorAll('.chips button').forEach((button) => {
  button.addEventListener('click', () => {
    topicField.value = button.textContent;
    topicField.focus();
  });
});

function section(title, content) {
  return `<section class="report-section"><h3>${escapeHtml(title)}</h3>${content}</section>`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function sourceTags(ids = []) {
  return ids.map((id) => `<span class="source-tag">[${escapeHtml(id)}]</span>`).join(' ');
}

function renderReport(data, topic) {
  const report = data.report;
  const findings = (report.key_findings || []).map((item) => `<h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.detail)} ${sourceTags(item.source_ids)}</p>`).join('');
  const deepDive = (report.deep_dive || []).map((item) => `<h4>${escapeHtml(item.heading)}</h4><p>${escapeHtml(item.detail)} ${sourceTags(item.source_ids)}</p>`).join('');
  const debates = (report.debates_and_limits || []).map((item) => `<h4>${escapeHtml(item.point)}</h4><p>${escapeHtml(item.detail)} ${sourceTags(item.source_ids)}</p>`).join('');
  const related = (report.related_topics || []).map((item) => `<li><strong>${escapeHtml(item.topic)}</strong> — ${escapeHtml(item.why_it_matters)}</li>`).join('');
  const questions = (report.open_questions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const sourceItems = Array.isArray(data.sources) ? data.sources : [];
  const sources = sourceItems.map((source) => {
    const url = safeSourceUrl(source.url);
    const title = `[${escapeHtml(source.id)}] ${escapeHtml(source.title)}`;
    const label = url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${title}</a>` : `<span>${title}</span>`;
    const snippet = String(source.snippet || '');
    return `<article class="source-item">${label}<p>${escapeHtml(snippet.slice(0, 220))}${snippet.length > 220 ? '…' : ''}</p></article>`;
  }).join('');
  result.innerHTML = `<div class="report-head"><p class="eyebrow">RESEARCH BRIEFING · ${escapeHtml(data.provider || 'Research mode')} · ${new Date(data.generated_at).toLocaleString()}</p><h2>${escapeHtml(topic)}</h2><p>${escapeHtml(report.executive_summary || '')}</p><div class="report-actions"><button class="export-button" type="button" data-export="download">Download Markdown</button><button class="export-button export-button-secondary" type="button" data-export="copy">Copy Markdown</button><span class="export-status" role="status" aria-live="polite"></span></div></div><div class="report-grid"><div>${section('Key findings', findings)}${section('Deep dive', deepDive)}${section('Debates & evidence limits', debates)}${section('Related topics', `<ul>${related}</ul>`)}${section('Open questions', `<ul>${questions}</ul>`)}${section('Conclusion', `<p>${escapeHtml(report.conclusion || '')}</p>`)}</div><aside class="sources-panel"><h3>Sources <span class="source-tag">${sourceItems.length} FOUND</span></h3>${sources}</aside></div>`;

  const markdown = formatReportAsMarkdown(data, topic);
  const status = result.querySelector('.export-status');
  const downloadButton = result.querySelector('[data-export="download"]');
  const copyButton = result.querySelector('[data-export="copy"]');
  downloadButton.addEventListener('click', () => {
    const objectUrl = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = markdownFilename(topic);
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    status.textContent = 'Markdown file downloaded.';
  });
  copyButton.addEventListener('click', async () => {
    if (!navigator.clipboard?.writeText) {
      status.textContent = 'Clipboard unavailable here. Use Download Markdown instead.';
      return;
    }
    try {
      await navigator.clipboard.writeText(markdown);
      status.textContent = 'Briefing copied as Markdown.';
    } catch {
      status.textContent = 'Could not access the clipboard. Use Download Markdown instead.';
    }
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const topic = topicField.value.trim();
  if (!topic) return;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.querySelector('span:first-child').textContent = 'Researching…';
  result.innerHTML = '<div class="loading-card"><span class="spinner"></span><span>Searching sources and assembling your briefing…</span></div>';
  result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    const response = await fetch('/api/research', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic, focus: focusField.value.trim(), provider: document.querySelector('#provider').value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Research failed.');
    renderReport(data, topic);
  } catch (error) {
    result.innerHTML = `<div class="error-card">${escapeHtml(error.message)}</div>`;
  } finally {
    button.disabled = false;
    button.querySelector('span:first-child').textContent = 'Start research';
  }
});
