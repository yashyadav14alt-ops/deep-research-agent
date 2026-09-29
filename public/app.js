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
  const sources = data.sources.map((source) => `<article class="source-item"><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">[${escapeHtml(source.id)}] ${escapeHtml(source.title)}</a><p>${escapeHtml(source.snippet.slice(0, 220))}${source.snippet.length > 220 ? '…' : ''}</p></article>`).join('');
  result.innerHTML = `<div class="report-head"><p class="eyebrow">RESEARCH BRIEFING · ${escapeHtml(data.provider || 'Research mode')} · ${new Date(data.generated_at).toLocaleString()}</p><h2>${escapeHtml(topic)}</h2><p>${escapeHtml(report.executive_summary || '')}</p></div><div class="report-grid"><div>${section('Key findings', findings)}${section('Deep dive', deepDive)}${section('Debates & evidence limits', debates)}${section('Related topics', `<ul>${related}</ul>`)}${section('Open questions', `<ul>${questions}</ul>`)}${section('Conclusion', `<p>${escapeHtml(report.conclusion || '')}</p>`)}</div><aside class="sources-panel"><h3>Sources <span class="source-tag">${data.sources.length} FOUND</span></h3>${sources}</aside></div>`;
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
