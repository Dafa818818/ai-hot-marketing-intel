const state = {
  index: null,
  issue: null
};

const keywordTitles = {
  flowHot: "高热度信息流标签",
  searchValue: "高商业价值 Search 关键词",
  longTail: "长尾机会词",
  brandProduct: "品牌/产品相关词"
};

const groupOrder = ["ai-models", "ai-products", "industry", "paper", "tip", "marketing"];

const $ = (selector) => document.querySelector(selector);

init();

async function init() {
  try {
    state.index = await loadJson("data/index.json");
    const latest = state.index.latest || state.index.archives?.[0]?.id;
    await loadIssue(latest);
    renderArchiveTabs();
  } catch (error) {
    renderError(error);
  }
}

async function loadIssue(issueId) {
  if (!issueId) throw new Error("暂无可展示的数据");
  state.issue = await loadJson(`data/archive/${issueId}.json`);
  renderIssue();
  renderArchiveTabs();
}

async function loadJson(url) {
  const response = await fetch(`${url}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`无法读取 ${url}`);
  return response.json();
}

function renderIssue() {
  const issue = state.issue;
  document.title = `${issue.id} · AI 热点与营销投放情报`;
  $("#statusPill").textContent = issue.autoStatus || "自动更新已开启";
  $("#issueDate").textContent = `本期日期 ${issue.id}`;
  $("#updatedAt").textContent = `更新时间 ${issue.updatedAtBJT}`;
  $("#coverageLabel").textContent = issue.coverage?.label || "";
  $("#headline").textContent = issue.summary?.headline || "";
  $("#metricItems").textContent = issue.stats?.totalItems ?? "--";
  $("#metricSources").textContent = issue.stats?.sourceCount ?? "--";
  $("#metricCategories").textContent = issue.stats?.categories ?? "--";
  renderSummary(issue.summary?.bullets || []);
  renderKeywordPool(issue.keywordPool || {});
  renderSignals(issue.summary?.marketingSignals || []);
  renderGroups(issue.groups || []);
}

function renderArchiveTabs() {
  const container = $("#archiveTabs");
  if (!container || !state.index) return;
  container.innerHTML = "";
  for (const archive of state.index.archives || []) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `archive-tab${state.issue?.id === archive.id ? " is-active" : ""}`;
    button.textContent = archive.id;
    button.title = archive.coverageLabel || archive.id;
    button.addEventListener("click", () => loadIssue(archive.id));
    container.appendChild(button);
  }
}

function renderSummary(bullets) {
  const container = $("#summaryGrid");
  container.innerHTML = "";
  for (const bullet of bullets.slice(0, 3)) {
    const item = document.createElement("div");
    item.className = "summary-chip";
    item.textContent = bullet;
    container.appendChild(item);
  }
}

function renderKeywordPool(pool) {
  const container = $("#keywordColumns");
  container.innerHTML = "";
  for (const [key, title] of Object.entries(keywordTitles)) {
    const column = document.createElement("article");
    column.className = "keyword-column";
    const words = pool[key] || [];
    column.innerHTML = `
      <h3>${escapeHtml(title)}</h3>
      <div class="chips">${words.map((word) => chip(word, key === "flowHot" ? "flow" : "search")).join("")}</div>
    `;
    container.appendChild(column);
  }
  $("#copyAllKeywords").onclick = () => copyText(formatKeywordPool(pool), "已复制本期全部关键词");
}

function renderSignals(signals) {
  const container = $("#signalList");
  container.innerHTML = "";
  if (!signals.length) {
    container.innerHTML = `<div class="empty">本期暂无额外投放洞察。</div>`;
    return;
  }
  for (const signal of signals) {
    const item = document.createElement("div");
    item.className = "signal";
    item.textContent = signal;
    container.appendChild(item);
  }
}

function renderGroups(groups) {
  const container = $("#groupStack");
  container.innerHTML = "";
  const ordered = [...groups].sort((a, b) => groupOrder.indexOf(a.id) - groupOrder.indexOf(b.id));
  for (const group of ordered) {
    if (!group.items?.length) continue;
    const section = document.createElement("section");
    section.className = "news-group";
    section.innerHTML = `
      <div class="group-title-row">
        <h3>${escapeHtml(group.label)} <span class="muted-count">${group.items.length}</span></h3>
        <button class="copy-group" type="button">复制本组关键词</button>
      </div>
      <div class="card-grid"></div>
    `;
    const grid = section.querySelector(".card-grid");
    for (const item of group.items) {
      grid.appendChild(renderCard(item));
    }
    section.querySelector(".copy-group").addEventListener("click", () => {
      const text = group.items.flatMap((item) => [...item.flowTags, ...item.searchKeywords]).join("、");
      copyText(text, "已复制本组关键词");
    });
    container.appendChild(section);
  }
  if (!container.children.length) {
    container.innerHTML = `<div class="empty">本期暂无热点数据，请稍后查看自动更新结果。</div>`;
  }
}

function renderCard(item) {
  const card = document.createElement("article");
  card.className = "news-card";
  const badgeClass = item.sourceTypeKey === "extended" ? "source-badge extended" : "source-badge";
  card.innerHTML = `
    <div class="card-meta">
      <span class="${badgeClass}">${escapeHtml(item.sourceType)}</span>
      <span>${escapeHtml(item.source)}</span>
      <span>${escapeHtml(item.publishedAt)}</span>
    </div>
    <h3>${escapeHtml(item.title)}</h3>
    <p class="card-summary">${escapeHtml(item.summary)}</p>
    <p class="marketing-angle">${escapeHtml(item.marketingAngle || "")}</p>
    <div class="keyword-block">
      <div>
        <strong>信息流广告标签</strong>
        <div class="chips">${(item.flowTags || []).map((word) => chip(word, "flow")).join("")}</div>
      </div>
      <div>
        <strong>Search 关键词</strong>
        <div class="chips">${(item.searchKeywords || []).map((word) => chip(word, "search")).join("")}</div>
      </div>
    </div>
    <div class="card-actions">
      <a class="source-link" href="${escapeAttribute(item.url)}" target="_blank" rel="noopener noreferrer">打开原文</a>
      <button class="copy-card" type="button">复制关键词</button>
    </div>
  `;
  card.querySelector(".copy-card").addEventListener("click", () => {
    copyText([...item.flowTags, ...item.searchKeywords].join("、"), "已复制该条热点关键词");
  });
  return card;
}

function chip(word, type) {
  return `<span class="chip ${type}">${escapeHtml(word)}</span>`;
}

function formatKeywordPool(pool) {
  return Object.entries(keywordTitles)
    .map(([key, title]) => `${title}\n${(pool[key] || []).join("、")}`)
    .join("\n\n");
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  showToast(message);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 1600);
}

function renderError(error) {
  $("#statusPill").textContent = "数据读取异常";
  $("#headline").textContent = error.message || "页面暂时无法读取数据。";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
