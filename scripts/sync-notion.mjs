import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LATEST_FILE = path.join(ROOT, "data", "latest.json");
const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = process.env.NOTION_VERSION || "2026-03-11";
const REQUEST_DELAY_MS = Number(process.env.NOTION_REQUEST_DELAY_MS || 360);
const DRY_RUN = process.env.NOTION_DRY_RUN === "1";

const REQUIRED_ENV = [
  "NOTION_TOKEN",
  "NOTION_DAILY_DATA_SOURCE_ID",
  "NOTION_ITEMS_DATA_SOURCE_ID",
  "NOTION_KEYWORDS_DATA_SOURCE_ID"
];

const KEYWORD_POOL_LABELS = {
  flowHot: "高热度信息流标签",
  searchValue: "高商业价值 Search 关键词",
  longTail: "长尾机会词",
  brandProduct: "品牌/产品相关词"
};

async function main() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    const message = `Notion sync skipped: missing ${missing.join(", ")}.`;
    if (process.env.NOTION_SKIP_IF_MISSING === "1") {
      console.log(message);
      return;
    }
    throw new Error(message);
  }

  const issue = JSON.parse(await fs.readFile(LATEST_FILE, "utf8"));
  const issueTitle = `${issue.id} · ${issue.title}`;
  const items = flattenItems(issue);
  const keywords = flattenKeywords(issue);

  if (DRY_RUN) {
    console.log(`Dry run: ${issueTitle}`);
    console.log(`Would sync 1 issue, ${items.length} items, ${keywords.length} keywords.`);
    return;
  }

  const existingIssue = await findIssue(issueTitle);
  if (existingIssue) {
    console.log(`Notion already has ${issueTitle}; skip duplicate sync.`);
    return;
  }

  const dailyPage = await createPage({
    parent: dataSourceParent(process.env.NOTION_DAILY_DATA_SOURCE_ID),
    icon: { type: "emoji", emoji: "📌" },
    properties: buildDailyProperties(issue, issueTitle),
    children: buildDailyChildren(issue)
  });

  for (const item of items) {
    await sleep(REQUEST_DELAY_MS);
    await createPage({
      parent: dataSourceParent(process.env.NOTION_ITEMS_DATA_SOURCE_ID),
      properties: buildItemProperties(issue, item, dailyPage.id)
    });
  }

  for (const keyword of keywords) {
    await sleep(REQUEST_DELAY_MS);
    await createPage({
      parent: dataSourceParent(process.env.NOTION_KEYWORDS_DATA_SOURCE_ID),
      properties: buildKeywordProperties(issue, keyword, dailyPage.id)
    });
  }

  console.log(`Synced ${issueTitle} to Notion: ${items.length} items, ${keywords.length} keywords.`);
}

async function findIssue(issueTitle) {
  const data = await notionFetch(`/data_sources/${cleanId(process.env.NOTION_DAILY_DATA_SOURCE_ID)}/query`, {
    method: "POST",
    body: {
      page_size: 1,
      filter: {
        property: "期次",
        title: {
          equals: issueTitle
        }
      }
    }
  });
  return data.results?.[0] ?? null;
}

async function createPage(payload) {
  return notionFetch("/pages", {
    method: "POST",
    body: payload
  });
}

async function notionFetch(endpoint, { method = "GET", body } = {}, attempt = 1) {
  const response = await fetch(`${NOTION_API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (response.status === 429 && attempt <= 5) {
    const retryAfter = Number(response.headers.get("retry-after") || 1);
    await sleep(Math.max(retryAfter * 1000, REQUEST_DELAY_MS));
    return notionFetch(endpoint, { method, body }, attempt + 1);
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = data.message || text || `${response.status} ${response.statusText}`;
    throw new Error(`Notion API ${method} ${endpoint} failed: ${message}`);
  }
  return data;
}

function buildDailyProperties(issue, issueTitle) {
  const githubTag = `https://github.com/Dafa818818/ai-hot-marketing-intel/releases/tag/ai-intel-${issue.id}`;
  return {
    "期次": title(issueTitle),
    "更新日期": date(issue.id),
    "覆盖开始": date(issue.coverage?.startISO),
    "覆盖结束": date(issue.coverage?.endISO),
    "自动更新时间": date(issue.updatedAtISO),
    "热点总数": number(issue.stats?.totalItems),
    "AI HOT精选数": number(issue.stats?.aiHotItems),
    "扩展热点数": number(issue.stats?.extendedItems),
    "公开来源数": number(issue.stats?.sourceCount),
    "覆盖分类数": number(issue.stats?.categories),
    "核心摘要": richText(issue.summary?.headline),
    "重点分布": richText(issue.summary?.bullets?.[0]),
    "高频品牌": richText(stripPrefix(issue.summary?.bullets?.[1])),
    "高频技术线索": richText(stripPrefix(issue.summary?.bullets?.[2])),
    "页面链接": url("https://dafa818818.github.io/ai-hot-marketing-intel/"),
    "GitHub版本": url(githubTag),
    "状态": select("已导入")
  };
}

function buildItemProperties(issue, item, dailyPageId) {
  return {
    "热点标题": title(item.title),
    "更新日期": date(issue.id),
    "内容分类": select(item.groupLabel),
    "来源类型": select(item.sourceTypeKey === "aihot" ? "AI HOT 精选" : "扩展热点观察"),
    "来源名称": richText(item.source),
    "发布时间": date(item.publishedAtISO),
    "原文链接": url(item.url),
    "品牌/产品": richText(join(item.brands)),
    "技术线索": richText(join(item.technologies)),
    "信息流广告标签": richText(join(item.flowTags)),
    "Search关键词": richText(join(item.searchKeywords)),
    "营销机会": richText(item.marketingAngle),
    "摘要": richText(item.summary),
    "期次": relation(dailyPageId)
  };
}

function buildKeywordProperties(issue, keyword, dailyPageId) {
  return {
    "关键词": title(keyword.value),
    "更新日期": date(issue.id),
    "词库类型": select(keyword.type),
    "排序": number(keyword.order),
    "期次": relation(dailyPageId)
  };
}

function buildDailyChildren(issue) {
  const bullets = issue.summary?.bullets ?? [];
  const watchlist = issue.summary?.watchlist ?? [];
  const signals = issue.summary?.marketingSignals ?? [];
  return [
    heading("本期概览"),
    paragraph(issue.summary?.headline),
    paragraph(issue.coverage?.label),
    heading("核心摘要"),
    ...bullets.map((text) => bulleted(text)),
    heading("重点关注"),
    ...watchlist.map((text) => bulleted(text)),
    heading("投放洞察"),
    ...signals.map((text) => bulleted(text)),
    heading("线上链接"),
    paragraph("https://dafa818818.github.io/ai-hot-marketing-intel/")
  ];
}

function flattenItems(issue) {
  return (issue.groups ?? []).flatMap((group) =>
    (group.items ?? []).map((item) => ({
      ...item,
      groupLabel: group.label
    }))
  );
}

function flattenKeywords(issue) {
  return Object.entries(KEYWORD_POOL_LABELS).flatMap(([key, type]) =>
    (issue.keywordPool?.[key] ?? []).map((value, index) => ({
      value,
      type,
      order: index + 1
    }))
  );
}

function title(value) {
  return { title: [{ type: "text", text: { content: truncate(value, 2000) } }] };
}

function richText(value) {
  const content = truncate(value, 2000);
  return { rich_text: content ? [{ type: "text", text: { content } }] : [] };
}

function date(value) {
  return value ? { date: { start: value } } : { date: null };
}

function number(value) {
  return { number: Number.isFinite(value) ? value : 0 };
}

function url(value) {
  return value ? { url: value } : { url: null };
}

function select(value) {
  return value ? { select: { name: value } } : { select: null };
}

function relation(pageId) {
  return { relation: [{ id: pageId }] };
}

function dataSourceParent(value) {
  return {
    type: "data_source_id",
    data_source_id: cleanId(value)
  };
}

function heading(value) {
  return {
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: [{ type: "text", text: { content: value } }] }
  };
}

function paragraph(value) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: value ? [{ type: "text", text: { content: truncate(value, 2000) } }] : [] }
  };
}

function bulleted(value) {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [{ type: "text", text: { content: truncate(value, 2000) } }] }
  };
}

function stripPrefix(value = "") {
  return String(value).replace(/^.*?：/, "").replace(/[。.]$/, "");
}

function join(value) {
  return Array.isArray(value) ? value.join("、") : "";
}

function cleanId(value) {
  return String(value || "").replace(/^collection:\/\//, "").trim();
}

function truncate(value = "", max = 2000) {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
