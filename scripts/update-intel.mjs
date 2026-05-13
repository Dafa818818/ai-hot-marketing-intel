import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const ARCHIVE_DIR = path.join(DATA_DIR, "archive");
const HOLIDAY_FILE = path.join(DATA_DIR, "holidays-cn-2026.json");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const INDEX_FILE = path.join(DATA_DIR, "index.json");
const LATEST_FILE = path.join(DATA_DIR, "latest.json");
const BJT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const AIHOT_BASE = "https://aihot.virxact.com";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const CATEGORY_LABELS = {
  "ai-models": "模型发布/更新",
  "ai-products": "产品发布/更新",
  industry: "行业动态",
  paper: "论文研究",
  tip: "技巧与观点",
  marketing: "投放洞察"
};

const DAILY_LABEL_TO_CATEGORY = {
  "模型发布/更新": "ai-models",
  "产品发布/更新": "ai-products",
  "行业动态": "industry",
  "行业热点": "industry",
  "论文研究": "paper",
  "技巧与观点": "tip",
  "值得关注的观点": "tip",
  "AI Agent 动态": "ai-products"
};

const EXTENDED_FEEDS = [
  {
    name: "OpenAI News",
    url: "https://openai.com/news/rss.xml",
    weight: 1.25
  },
  {
    name: "Google AI Blog",
    url: "https://blog.google/innovation-and-ai/technology/ai/rss/",
    weight: 1.1
  },
  {
    name: "Google Research Blog",
    url: "https://research.google/blog/rss/",
    weight: 1.05
  },
  {
    name: "Hugging Face Blog",
    url: "https://huggingface.co/blog/feed.xml",
    weight: 1
  },
  {
    name: "Microsoft Research",
    url: "https://www.microsoft.com/en-us/research/feed/",
    weight: 0.95
  },
  {
    name: "Meta AI Blog",
    url: "https://ai.meta.com/blog/rss/",
    weight: 0.95
  },
  {
    name: "VentureBeat AI",
    url: "https://venturebeat.com/category/ai/feed/",
    weight: 0.85
  },
  {
    name: "arXiv cs.AI",
    url: "http://export.arxiv.org/rss/cs.AI",
    weight: 0.75
  },
  {
    name: "arXiv cs.CL",
    url: "http://export.arxiv.org/rss/cs.CL",
    weight: 0.75
  }
];

const BRAND_RULES = [
  ["OpenAI", ["OpenAI", "ChatGPT", "GPT", "Sora", "Codex"]],
  ["Anthropic", ["Anthropic", "Claude"]],
  ["Google", ["Google", "Gemini", "DeepMind", "Vertex AI"]],
  ["Meta", ["Meta", "Llama"]],
  ["Microsoft", ["Microsoft", "Copilot", "Azure AI"]],
  ["百度", ["百度", "Baidu", "文心", "ERNIE"]],
  ["阿里云", ["阿里", "Alibaba", "Qwen", "通义", "夸克"]],
  ["腾讯混元", ["腾讯", "Hunyuan", "混元"]],
  ["字节跳动", ["字节", "ByteDance", "豆包"]],
  ["智谱", ["智谱", "GLM"]],
  ["阶跃星辰", ["阶跃", "StepFun", "Step"]],
  ["商汤", ["商汤", "SenseTime", "SenseNova"]],
  ["Hugging Face", ["Hugging Face", "Transformers", "Diffusers"]],
  ["GitHub", ["GitHub", "Copilot"]],
  ["Luma", ["Luma"]],
  ["Runway", ["Runway"]],
  ["Midjourney", ["Midjourney"]],
  ["Mistral", ["Mistral"]],
  ["xAI", ["xAI", "Grok"]]
];

const TECH_RULES = [
  ["AI Agent", ["Agent", "智能体", "agents", "agentic"]],
  ["多模态 AI", ["multimodal", "多模态", "vision-language", "VLM", "视觉语言"]],
  ["视频生成", ["video", "视频", "Sora", "Luma", "Runway"]],
  ["图像生成", ["image", "图像", "文生图", "ComfyUI", "Diffusion"]],
  ["AI 编程", ["Codex", "Claude Code", "coding", "编程", "代码", "developer"]],
  ["RAG", ["RAG", "retrieval", "检索增强"]],
  ["MCP", ["MCP", "connector", "连接器"]],
  ["长上下文", ["long context", "上下文", "context window", "256K", "1M"]],
  ["模型评测", ["benchmark", "eval", "评测", "排行榜", "FrontierMath"]],
  ["开源模型", ["open-source", "开源", "Hugging Face", "GitHub"]],
  ["AI 安全", ["safety", "security", "安全", "监管", "合规"]],
  ["AI 搜索", ["search", "搜索", "SEO", "问答"]],
  ["AI 办公", ["office", "办公", "Gmail", "Outlook", "Word", "workspace"]]
];

const CATEGORY_FLOW_TAGS = {
  "ai-models": ["大模型更新", "模型评测", "AI 开发者", "企业 AI 选型", "国产大模型", "开源模型", "低成本推理", "多模态能力"],
  "ai-products": ["AI 工具", "效率工具", "智能办公", "内容创作", "运营自动化", "AI 工作流", "创意生产", "企业软件"],
  industry: ["AI 行业动态", "融资并购", "AI 监管合规", "AI 芯片", "企业数字化", "AI 商业化", "平台生态", "数据安全"],
  paper: ["AI 论文", "模型评测", "研究前沿", "算法创新", "科研工具", "多模态研究", "Agent 评估", "开源基准"],
  tip: ["AI 使用技巧", "提示词工程", "AI 提效", "运营方法论", "开发者经验", "内容生产", "成本优化", "工作流优化"],
  marketing: ["营销机会", "投放洞察", "关键词策略", "内容选题", "品牌增长", "AI 营销工具", "广告创意", "SEO/SEM"]
};

const CATEGORY_SEARCH_SEEDS = {
  "ai-models": ["大模型选型", "模型 API", "模型价格", "中文能力对比", "开源模型部署", "企业大模型方案"],
  "ai-products": ["AI 工具推荐", "AI 办公自动化", "AI 内容创作工具", "AI 产品教程", "AI 工作流搭建", "企业 AI 工具"],
  industry: ["AI 行业趋势", "AI 监管政策", "AI 融资新闻", "AI 商业化案例", "AI 芯片公司", "生成式 AI 合规"],
  paper: ["AI 论文解读", "最新 AI 论文", "模型评测基准", "AI 研究趋势", "多模态论文", "Agent 论文"],
  tip: ["AI 提效方法", "提示词教程", "AI 工作流案例", "AI 降本增效", "AI 运营技巧", "AI 自动化教程"],
  marketing: ["AI 营销投放", "AI 关键词策略", "AI 广告创意", "AI SEO 选题", "信息流投放标签", "SEM 长尾词"]
};

async function main() {
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
  const holidays = await readJson(HOLIDAY_FILE);
  const state = await readJson(STATE_FILE, { lastSuccessfulWindowEndISO: null, lastSuccessfulIssueId: null });
  const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
  const windowEnd = scheduledCutoff(now);
  const issueId = bjtDateKey(windowEnd);
  const force = process.env.FORCE_UPDATE === "1" || process.argv.includes("--force");

  if (!force && !isBusinessDate(issueId, holidays)) {
    console.log(`Skip ${issueId}: weekend or China public holiday.`);
    return;
  }

  const windowStart = resolveWindowStart(state, windowEnd, holidays);
  if (!force && state.lastSuccessfulWindowEndISO && new Date(state.lastSuccessfulWindowEndISO) >= windowEnd) {
    console.log(`Skip ${issueId}: already updated through ${state.lastSuccessfulWindowEndISO}.`);
    return;
  }

  const [aiHotItems, extendedItems] = await Promise.all([
    fetchAihotItems(windowStart, windowEnd),
    fetchExtendedItems(windowStart, windowEnd)
  ]);

  const normalizedAihot = normalizeAihotItems(aiHotItems, windowStart, windowEnd).slice(0, 46);
  const normalizedExtended = normalizeExtendedItems(extendedItems, normalizedAihot, windowStart, windowEnd).slice(0, 10);
  const enriched = [...normalizedAihot, ...normalizedExtended]
    .map(enrichItem)
    .sort((a, b) => new Date(b.publishedAtISO) - new Date(a.publishedAtISO));

  const grouped = groupItems(enriched);
  const issue = {
    id: issueId,
    title: "AI 热点与营销投放情报",
    updatedAtISO: windowEnd.toISOString(),
    updatedAtBJT: formatBjt(windowEnd),
    autoStatus: "本期内容已于北京时间 09:00 自动更新",
    coverage: {
      startISO: windowStart.toISOString(),
      endISO: windowEnd.toISOString(),
      startBJT: formatBjt(windowStart),
      endBJT: formatBjt(windowEnd),
      label: `本期覆盖：${formatBjtCompact(windowStart)} 至 ${formatBjtCompact(windowEnd)}`
    },
    summary: buildSummary(enriched, normalizedAihot.length, normalizedExtended.length),
    keywordPool: buildKeywordPool(enriched),
    groups: grouped,
    stats: {
      totalItems: enriched.length,
      aiHotItems: normalizedAihot.length,
      extendedItems: normalizedExtended.length,
      categories: grouped.filter((group) => group.items.length > 0).length,
      sourceCount: new Set(enriched.map((item) => item.source)).size
    },
    sources: {
      primary: {
        name: "AI HOT",
        url: AIHOT_BASE
      },
      extendedFeeds: EXTENDED_FEEDS.map(({ name, url }) => ({ name, url })),
      holidayCalendar: {
        name: holidays.sourceName,
        url: holidays.sourceUrl
      }
    }
  };

  await writeJson(path.join(ARCHIVE_DIR, `${issueId}.json`), issue);
  await writeJson(LATEST_FILE, issue);
  await updateArchiveIndex(issue);
  await writeJson(STATE_FILE, {
    lastSuccessfulWindowEndISO: windowEnd.toISOString(),
    lastSuccessfulIssueId: issueId,
    updatedAtISO: new Date().toISOString()
  });
  console.log(`Updated ${issueId}: ${issue.stats.totalItems} items, ${issue.coverage.label}`);
}

function scheduledCutoff(now) {
  const parts = bjtParts(now);
  let cutoff = fromBjt(parts.year, parts.month, parts.day, 9, 0, 0);
  if (now < cutoff) {
    const previousKey = addDaysToKey(dateKey(parts.year, parts.month, parts.day), -1);
    const [year, month, day] = previousKey.split("-").map(Number);
    cutoff = fromBjt(year, month, day, 9, 0, 0);
  }
  return cutoff;
}

function resolveWindowStart(state, windowEnd, holidays) {
  if (state.lastSuccessfulWindowEndISO) {
    const previous = new Date(state.lastSuccessfulWindowEndISO);
    if (!Number.isNaN(previous.getTime()) && previous < windowEnd) return previous;
  }
  let cursor = addDaysToKey(bjtDateKey(windowEnd), -1);
  while (!isBusinessDate(cursor, holidays)) {
    cursor = addDaysToKey(cursor, -1);
  }
  const [year, month, day] = cursor.split("-").map(Number);
  return fromBjt(year, month, day, 9, 0, 0);
}

async function fetchAihotItems(windowStart, windowEnd) {
  const since = windowEnd.getTime() - windowStart.getTime() > 7 * DAY_MS
    ? new Date(windowEnd.getTime() - 7 * DAY_MS)
    : windowStart;
  const selectedItems = [];
  let cursor = "";
  for (let page = 0; page < 3; page += 1) {
    const url = new URL(`${AIHOT_BASE}/api/public/items`);
    url.searchParams.set("mode", "selected");
    url.searchParams.set("since", since.toISOString());
    url.searchParams.set("take", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const payload = await fetchJson(url.toString(), { headers: { "User-Agent": USER_AGENT } });
    selectedItems.push(...(payload.items ?? []));
    if (!payload.hasNext || !payload.nextCursor) break;
    cursor = payload.nextCursor;
  }

  const needsDailyBackfill = windowEnd.getTime() - windowStart.getTime() > 6 * DAY_MS;
  const dailyItems = needsDailyBackfill ? await fetchDailyBackfill(windowStart, windowEnd) : [];
  return dedupeByUrlAndTitle([...selectedItems, ...dailyItems]);
}

async function fetchDailyBackfill(windowStart, windowEnd) {
  const startKey = bjtDateKey(windowStart);
  const endKey = bjtDateKey(windowEnd);
  const dates = dateRangeKeys(startKey, endKey);
  const out = [];
  for (const key of dates) {
    try {
      const daily = await fetchJson(`${AIHOT_BASE}/api/public/daily/${key}`, { headers: { "User-Agent": USER_AGENT } });
      for (const section of daily.sections ?? []) {
        const category = DAILY_LABEL_TO_CATEGORY[section.label] ?? "industry";
        for (const item of section.items ?? []) {
          out.push({
            title: item.title,
            summary: item.summary,
            source: item.sourceName,
            url: item.sourceUrl,
            publishedAt: daily.generatedAt ?? fromBjt(...key.split("-").map(Number), 9, 0, 0).toISOString(),
            category,
            fromDaily: true
          });
        }
      }
    } catch (error) {
      console.warn(`Daily backfill failed for ${key}: ${error.message}`);
    }
  }
  return out;
}

async function fetchExtendedItems(windowStart, windowEnd) {
  const batches = await Promise.allSettled(EXTENDED_FEEDS.map(async (feed) => {
    const xml = await fetchText(feed.url, { headers: { "User-Agent": USER_AGENT } });
    return parseFeed(xml, feed).map((item) => ({ ...item, feedWeight: feed.weight ?? 1 }));
  }));
  return batches
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((item) => isWithinWindow(item.publishedAtISO, windowStart, windowEnd))
    .filter((item) => isAiRelevant(`${item.title} ${item.summary}`))
    .map((item) => ({ ...item, category: classifyItem(item) }))
    .sort((a, b) => scoreExtendedItem(b) - scoreExtendedItem(a));
}

function normalizeAihotItems(items, windowStart, windowEnd) {
  return items
    .map((item) => {
      const publishedAtISO = normalizeDate(item.publishedAt) ?? windowEnd.toISOString();
      return {
        id: stableId(item.url || item.title),
        title: cleanText(item.title),
        summary: cleanText(item.summary),
        source: cleanText(item.source ?? item.sourceName ?? "AI HOT"),
        publishedAtISO,
        publishedAt: formatBjt(new Date(publishedAtISO)),
        url: item.url ?? item.sourceUrl,
        category: item.category ?? "industry",
        sourceType: "AI HOT 精选",
        sourceTypeKey: "aihot"
      };
    })
    .filter((item) => item.title && item.url)
    .filter((item) => item.fromDaily || isWithinWindow(item.publishedAtISO, windowStart, windowEnd))
    .sort((a, b) => new Date(b.publishedAtISO) - new Date(a.publishedAtISO));
}

function normalizeExtendedItems(items, aiHotItems, windowStart, windowEnd) {
  const aiHotUrls = new Set(aiHotItems.map((item) => normalizeUrl(item.url)));
  const aiHotTitles = aiHotItems.map((item) => normalizeTitle(item.title));
  return dedupeByUrlAndTitle(items)
    .filter((item) => item.url && !aiHotUrls.has(normalizeUrl(item.url)))
    .filter((item) => !aiHotTitles.some((title) => title && similarity(title, normalizeTitle(item.title)) > 0.82))
    .filter((item) => isWithinWindow(item.publishedAtISO, windowStart, windowEnd))
    .map((item) => ({
      id: stableId(item.url || item.title),
      title: cleanText(item.title),
      summary: makeExtendedSummary(item),
      source: item.source,
      publishedAtISO: item.publishedAtISO,
      publishedAt: formatBjt(new Date(item.publishedAtISO)),
      url: item.url,
      category: item.category,
      sourceType: "扩展热点观察",
      sourceTypeKey: "extended"
    }));
}

function enrichItem(item) {
  const brands = detectBrands(item);
  const techs = detectTechnologies(item);
  const flowTags = buildFlowTags(item, brands, techs);
  const searchKeywords = buildSearchKeywords(item, brands, techs);
  return {
    ...item,
    brands,
    technologies: techs,
    flowTags,
    searchKeywords,
    marketingAngle: buildMarketingAngle(item, brands, techs)
  };
}

function groupItems(items) {
  return Object.entries(CATEGORY_LABELS).map(([id, label]) => ({
    id,
    label,
    items: items.filter((item) => item.category === id).slice(0, 18)
  }));
}

function buildSummary(items, aiHotCount, extendedCount) {
  const categoryCounts = countBy(items, (item) => item.category);
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, count]) => `${CATEGORY_LABELS[category]} ${count} 条`);
  const topBrands = topTerms(items.flatMap((item) => item.brands), 5);
  const topTechs = topTerms(items.flatMap((item) => item.technologies), 5);
  const leadItems = items.slice(0, 4).map((item) => item.title);
  return {
    headline: `本期收录 ${items.length} 条热点，其中 AI HOT 精选 ${aiHotCount} 条，扩展公开来源 ${extendedCount} 条。`,
    bullets: [
      topCategories.length ? `重点分布：${topCategories.join("、")}。` : "本期热点分布较均衡。",
      topBrands.length ? `高频品牌/产品：${topBrands.join("、")}。` : "本期品牌集中度不高，适合按场景选题。",
      topTechs.length ? `高频技术线索：${topTechs.join("、")}。` : "本期技术线索以应用落地和生态变化为主。"
    ],
    watchlist: leadItems,
    marketingSignals: buildMarketingSignals(items)
  };
}

function buildMarketingSignals(items) {
  const signals = [];
  if (items.some((item) => item.category === "ai-products")) {
    signals.push("产品更新适合做“上手教程、替代方案、场景清单”型内容。");
  }
  if (items.some((item) => item.category === "ai-models")) {
    signals.push("模型发布适合覆盖品牌词、API 词、价格词、对比词和中文教程词。");
  }
  if (items.some((item) => /合规|监管|判决|安全|security|policy/i.test(`${item.title} ${item.summary}`))) {
    signals.push("合规与安全议题适合面向企业客户做风险提示和采购评估内容。");
  }
  if (items.some((item) => /image|video|图像|视频|创意|广告|content/i.test(`${item.title} ${item.summary}`))) {
    signals.push("多模态与创意工具可转化为信息流兴趣标签和内容生产解决方案选题。");
  }
  return signals.slice(0, 4);
}

function buildKeywordPool(items) {
  const flowHot = rankKeywords(items.flatMap((item) => item.flowTags), "flow").slice(0, 28);
  const allSearch = items.flatMap((item) => item.searchKeywords);
  const searchValue = rankKeywords(
    allSearch.filter((word) => /价格|API|方案|企业|服务|工具|教程|对比|替代|部署|选型|平台|软件|系统/.test(word)),
    "search"
  ).slice(0, 28);
  const longTail = rankKeywords(
    allSearch.filter((word) => word.length >= 8 || /怎么|如何|哪家|哪个好|适合|教程|案例|多少钱/.test(word)),
    "longtail"
  ).slice(0, 28);
  const brandProduct = rankKeywords(
    items.flatMap((item) => [
      ...item.brands,
      ...item.searchKeywords.filter((word) => item.brands.some((brand) => word.toLowerCase().includes(brand.toLowerCase())))
    ]),
    "brand"
  ).slice(0, 28);

  return {
    flowHot,
    searchValue,
    longTail,
    brandProduct
  };
}

function buildFlowTags(item, brands, techs) {
  const base = [
    ...(CATEGORY_FLOW_TAGS[item.category] ?? CATEGORY_FLOW_TAGS.industry),
    ...brands.map((brand) => `${brand} 关注者`),
    ...techs.map((tech) => `${tech} 人群`)
  ];
  if (/营销|广告|投放|SEO|SEM|content|创意/i.test(`${item.title} ${item.summary}`)) {
    base.push("营销增长", "广告投放", "内容运营", "品牌创意");
  }
  if (/企业|business|enterprise|platform|AWS|Azure|云/i.test(`${item.title} ${item.summary}`)) {
    base.push("企业服务", "SaaS 采购", "数字化转型");
  }
  return unique(base).slice(0, 10);
}

function buildSearchKeywords(item, brands, techs) {
  const seeds = CATEGORY_SEARCH_SEEDS[item.category] ?? CATEGORY_SEARCH_SEEDS.industry;
  const out = [...seeds];
  for (const brand of brands.slice(0, 3)) {
    out.push(`${brand} 最新消息`, `${brand} 怎么用`, `${brand} 价格`, `${brand} API`, `${brand} 替代方案`, `${brand} 中文教程`);
  }
  for (const tech of techs.slice(0, 3)) {
    out.push(`${tech} 工具`, `${tech} 方案`, `${tech} 教程`, `${tech} 应用场景`, `${tech} 对比`);
  }
  const titleNouns = extractChineseNouns(item.title);
  for (const noun of titleNouns.slice(0, 3)) {
    out.push(`${noun} 是什么`, `${noun} 怎么用`);
  }
  return unique(out).filter((word) => word.length >= 3).slice(0, 10);
}

function buildMarketingAngle(item, brands, techs) {
  const brandText = brands[0] ? `${brands[0]}相关` : CATEGORY_LABELS[item.category];
  if (item.category === "ai-models") {
    return `可围绕${brandText}的能力更新、价格/API、中文体验和替代方案做搜索承接。`;
  }
  if (item.category === "ai-products") {
    return `适合拆成上手教程、场景清单和效率工具对比，服务内容运营与信息流测试。`;
  }
  if (item.category === "paper") {
    return `适合做研究解读、评测对比和“趋势是否可商用”的专业内容。`;
  }
  if (item.category === "tip") {
    return `适合沉淀成操作方法、模板下载、团队提效和成本优化类长尾内容。`;
  }
  if (techs.includes("AI 安全")) {
    return `适合面向企业客户输出合规、安全和采购风险提示。`;
  }
  return `可转化为行业趋势解读、竞品观察和企业 AI 落地选题。`;
}

function rankKeywords(words, type) {
  const scores = new Map();
  for (const word of words.map(cleanKeyword).filter(Boolean)) {
    const commercialBoost = /价格|API|方案|企业|服务|工具|教程|对比|替代|部署|选型|平台|软件|系统/.test(word) ? 1.4 : 1;
    const longTailBoost = /怎么|如何|哪家|哪个好|适合|案例|多少钱|最新/.test(word) ? 1.25 : 1;
    const brandBoost = BRAND_RULES.some(([brand]) => word.toLowerCase().includes(brand.toLowerCase())) ? 1.2 : 1;
    const typeBoost = type === "longtail" ? longTailBoost : type === "brand" ? brandBoost : commercialBoost;
    scores.set(word, (scores.get(word) ?? 0) + typeBoost);
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"))
    .map(([word]) => word);
}

function detectBrands(item) {
  const text = `${item.title} ${item.summary} ${item.source}`;
  const found = [];
  for (const [label, needles] of BRAND_RULES) {
    if (needles.some((needle) => new RegExp(escapeRegExp(needle), "i").test(text))) found.push(label);
  }
  return unique(found).slice(0, 4);
}

function detectTechnologies(item) {
  const text = `${item.title} ${item.summary}`;
  const found = [];
  for (const [label, needles] of TECH_RULES) {
    if (needles.some((needle) => new RegExp(escapeRegExp(needle), "i").test(text))) found.push(label);
  }
  if (!found.length && item.category === "ai-models") found.push("大模型");
  if (!found.length && item.category === "ai-products") found.push("AI 工具");
  return unique(found).slice(0, 4);
}

function parseFeed(xml, feed) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  return blocks.map((block) => {
    const title = tag(block, "title");
    const link = tag(block, "link") || attr(block, "link", "href") || tag(block, "guid");
    const published = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated") || tag(block, "dc:date");
    const summary = tag(block, "description") || tag(block, "summary") || tag(block, "content:encoded") || "";
    return {
      title: cleanText(title),
      url: cleanUrl(link),
      summary: stripHtml(summary),
      source: feed.name,
      publishedAtISO: normalizeDate(published) ?? new Date(0).toISOString()
    };
  }).filter((item) => item.title && item.url);
}

function tag(block, tagName) {
  const escaped = escapeRegExp(tagName);
  const regex = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i");
  const match = block.match(regex);
  return match ? decodeEntities(match[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "")) : "";
}

function attr(block, tagName, attrName) {
  const escaped = escapeRegExp(tagName);
  const regex = new RegExp(`<${escaped}\\b[^>]*\\s${attrName}=["']([^"']+)["'][^>]*>`, "i");
  const match = block.match(regex);
  return match ? decodeEntities(match[1]) : "";
}

function classifyItem(item) {
  const text = `${item.title} ${item.summary} ${item.source}`;
  if (/paper|arxiv|research|benchmark|eval|dataset|论文|研究|算法|数据集|评测/i.test(text)) return "paper";
  if (/model|gpt|claude|gemini|llama|qwen|hunyuan|mistral|模型|大模型|多模态|reasoning|llm|vlm/i.test(text)) return "ai-models";
  if (/launch|release|app|platform|tool|agent|plugin|api|product|copilot|产品|工具|上线|发布|集成|连接器/i.test(text)) return "ai-products";
  if (/policy|regulat|funding|ipo|acquisition|lawsuit|security|copyright|投资|融资|并购|监管|判决|安全|版权|芯片/i.test(text)) return "industry";
  if (/how to|guide|best practice|tutorial|prompt|analysis|观点|技巧|教程|方法|提示词/i.test(text)) return "tip";
  return "industry";
}

function makeExtendedSummary(item) {
  const source = item.source || "公开来源";
  const category = CATEGORY_LABELS[item.category] ?? "AI 行业动态";
  const summary = stripHtml(item.summary);
  if (containsChinese(summary)) return clip(summary, 160);
  const detail = summary ? `原文摘要提到：${clip(summary, 120)}` : `原文标题为：${item.title}`;
  return `${source} 发布了与${category}相关的新动态。${detail}`;
}

function isAiRelevant(text) {
  return /AI|artificial intelligence|machine learning|LLM|large language|model|agent|GPT|Claude|Gemini|Llama|OpenAI|Anthropic|DeepMind|Hugging Face|生成式|大模型|智能体|多模态|机器学习|人工智能/i.test(text);
}

function scoreExtendedItem(item) {
  const text = `${item.title} ${item.summary}`;
  let score = item.feedWeight ?? 1;
  if (/launch|release|announce|发布|推出|上线|open-source|开源/i.test(text)) score += 2;
  if (/OpenAI|Anthropic|Google|DeepMind|Meta|Microsoft|NVIDIA|Hugging Face|Claude|GPT|Gemini|Llama/i.test(text)) score += 1.6;
  if (/policy|regulat|funding|acquisition|lawsuit|security|监管|融资|并购|安全|合规/i.test(text)) score += 1.2;
  if (/paper|research|benchmark|论文|研究|评测/i.test(text)) score += 0.8;
  score += Math.max(0, 1 - (Date.now() - new Date(item.publishedAtISO).getTime()) / (7 * DAY_MS));
  return score;
}

function isWithinWindow(iso, start, end) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date <= end;
}

function isBusinessDate(key, holidays) {
  const weekday = weekdayFromKey(key);
  if (weekday === 0 || weekday === 6) return false;
  return !(holidays.nonWorking ?? []).includes(key);
}

function bjtParts(date) {
  const shifted = new Date(date.getTime() + BJT_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds()
  };
}

function bjtDateKey(date) {
  const { year, month, day } = bjtParts(date);
  return dateKey(year, month, day);
}

function dateKey(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function addDaysToKey(key, days) {
  const [year, month, day] = key.split("-").map(Number);
  const date = fromBjt(year, month, day, 12, 0, 0);
  return bjtDateKey(new Date(date.getTime() + days * DAY_MS));
}

function dateRangeKeys(startKey, endKey) {
  const keys = [];
  let cursor = startKey;
  while (cursor <= endKey) {
    keys.push(cursor);
    cursor = addDaysToKey(cursor, 1);
  }
  return keys;
}

function weekdayFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return fromBjt(year, month, day, 12, 0, 0).getUTCDay();
}

function fromBjt(year, month, day, hour = 0, minute = 0, second = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
}

function formatBjt(date) {
  const parts = bjtParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}`;
}

function formatBjtCompact(date) {
  const parts = bjtParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.searchParams.delete("utm_source");
    parsed.searchParams.delete("utm_medium");
    parsed.searchParams.delete("utm_campaign");
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url ?? "";
  }
}

function cleanUrl(url) {
  const cleaned = decodeEntities(String(url ?? "").trim());
  const match = cleaned.match(/https?:\/\/[^\s<>"']+/);
  return match ? match[0] : cleaned;
}

function normalizeTitle(title) {
  return cleanText(title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const short = a.length < b.length ? a : b;
  const long = a.length >= b.length ? a : b;
  if (long.includes(short)) return short.length / long.length;
  const grams = new Set(short.match(/.{1,3}/gu) ?? []);
  const matches = [...grams].filter((gram) => long.includes(gram)).length;
  return grams.size ? matches / grams.size : 0;
}

function dedupeByUrlAndTitle(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${normalizeUrl(item.url ?? item.sourceUrl)}|${normalizeTitle(item.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function countBy(items, fn) {
  const out = {};
  for (const item of items) {
    const key = fn(item);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function topTerms(words, take) {
  return rankKeywords(words, "term").slice(0, take);
}

function cleanKeyword(value) {
  return cleanText(value).replace(/[，。；;,.]+$/g, "").trim();
}

function cleanText(value) {
  return decodeEntities(String(value ?? ""))
    .replace(/\s+/g, " ")
    .replace(/\u0000/g, "")
    .trim();
}

function stripHtml(value) {
  return cleanText(String(value ?? "").replace(/<[^>]+>/g, " "));
}

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)));
}

function containsChinese(text) {
  return /[\u4e00-\u9fff]/.test(text);
}

function clip(text, length) {
  const cleaned = cleanText(text);
  return cleaned.length > length ? `${cleaned.slice(0, length - 1)}…` : cleaned;
}

function unique(items) {
  return [...new Set(items.map((item) => cleanText(item)).filter(Boolean))];
}

function extractChineseNouns(text) {
  return unique((text.match(/[\u4e00-\u9fffA-Za-z0-9]{2,12}/g) ?? [])
    .filter((word) => !/发布|更新|上线|开放|研究|预览|最新|支持|相关|动态/.test(word)));
}

function stableId(value) {
  let hash = 2166136261;
  const text = String(value ?? "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `item-${(hash >>> 0).toString(16)}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (fallback !== null) return fallback;
    throw error;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function updateArchiveIndex(issue) {
  const files = (await fs.readdir(ARCHIVE_DIR)).filter((file) => file.endsWith(".json")).sort().reverse();
  const entries = [];
  for (const file of files) {
    const payload = await readJson(path.join(ARCHIVE_DIR, file));
    entries.push({
      id: payload.id,
      title: payload.title,
      updatedAtBJT: payload.updatedAtBJT,
      coverageLabel: payload.coverage?.label,
      stats: payload.stats,
      file: `data/archive/${file}`
    });
  }
  const keep = entries.slice(0, 5);
  const remove = entries.slice(5);
  for (const entry of remove) {
    await fs.rm(path.join(ROOT, entry.file), { force: true });
  }
  await writeJson(INDEX_FILE, {
    latest: issue.id,
    generatedAtISO: new Date().toISOString(),
    archives: keep
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
