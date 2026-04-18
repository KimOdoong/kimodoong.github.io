const __jsonCache = new Map();
const __textCache = new Map();
let __allPostsPromise = null;
let __protectedImageBlockHandler = null;

function __fetchCached(path, parser, cache) {
  if (cache.has(path)) {
    return cache.get(path);
  }

  const promise = fetch(path).then((response) => {
    if (!response.ok) {
      throw new Error(`로드 실패: ${path}`);
    }
    return parser(response);
  });

  cache.set(path, promise);
  return promise;
}

async function fetchJson(path) {
  return __fetchCached(
    path,
    (response) => response.json(),
    __jsonCache
  );
}

async function fetchText(path) {
  return __fetchCached(
    path,
    (response) => response.text(),
    __textCache
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function updateQueryParams(updates) {
  const url = new URL(window.location.href);

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  });

  return url;
}

function buildPostUrl(relativePath) {
  return `./post.html?path=${encodeURIComponent(relativePath)}`;
}

function resolvePostPath(relativePath) {
  return `./posts/${relativePath}`;
}

function buildAllPageUrl(type) {
  return `./all.html?type=${encodeURIComponent(type)}`;
}

function buildFilterLink(type, value) {
  const url = new URL("./blog.html", window.location.href);
  url.searchParams.set(type, value);
  return url.pathname + url.search;
}

function normalizeRelativePostPath(rawPath) {
  return decodeURIComponent(String(rawPath || "")).replace(/^\.?\/?posts\//, "");
}

function parseJsonFrontMatter(markdownText) {
  const normalized = markdownText.replace(/\r\n/g, "\n");
  const separator = "\n---\n";
  const separatorIndex = normalized.indexOf(separator);

  if (separatorIndex === -1) {
    throw new Error("JSON front matter 구분선(---)을 찾을 수 없습니다.");
  }

  const jsonPart = normalized.slice(0, separatorIndex).trim();
  const body = normalized.slice(separatorIndex + separator.length).trim();

  let meta;
  try {
    meta = JSON.parse(jsonPart);
  } catch {
    throw new Error("JSON front matter 파싱 실패");
  }

  return {
    meta: {
      title: meta.title ?? "제목 없음",
      date: meta.date ?? "",
      category: meta.category ?? "",
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      excerpt: meta.excerpt ?? ""
    },
    body
  };
}

function createExcerptFromMarkdown(markdownText) {
  const plain = markdownText
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\!\[.*?\]\(.*?\)/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[*_>~-]/g, "")
    .replace(/\n+/g, " ")
    .trim();

  return plain.length > 140 ? `${plain.slice(0, 140)}...` : plain;
}

function __buildPostRecord(relativePath, parsed) {
  const title = parsed.meta.title;
  const excerpt = parsed.meta.excerpt || createExcerptFromMarkdown(parsed.body);
  const category = parsed.meta.category;
  const tags = parsed.meta.tags;

  return {
    relativePath,
    title,
    date: parsed.meta.date,
    category,
    tags,
    excerpt,
    content: parsed.body,
    searchText: `${title} ${excerpt} ${category} ${tags.join(" ")}`.toLowerCase()
  };
}

async function loadPostByRelativePath(relativePath) {
  const normalizedPath = normalizeRelativePostPath(relativePath);
  const markdownText = await fetchText(resolvePostPath(normalizedPath));
  return __buildPostRecord(normalizedPath, parseJsonFrontMatter(markdownText));
}

async function __mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

async function loadAllPosts() {
  if (__allPostsPromise) {
    return __allPostsPromise;
  }

  __allPostsPromise = (async () => {
    const manifest = await fetchJson("./posts/index.json");
    const paths = Array.isArray(manifest?.posts) ? manifest.posts : [];

    const posts = await __mapWithConcurrency(paths, 6, async (relativePath) => {
      const normalizedPath = normalizeRelativePostPath(relativePath);
      const markdownText = await fetchText(resolvePostPath(normalizedPath));
      return __buildPostRecord(normalizedPath, parseJsonFrontMatter(markdownText));
    });

    posts.sort((a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      return bTime - aTime;
    });

    return posts;
  })();

  return __allPostsPromise;
}

function uniqueCategories(posts) {
  return [...new Set(posts.map((post) => post.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ko"));
}

function uniqueTags(posts) {
  return [...new Set(posts.flatMap((post) => post.tags || []).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ko"));
}

function applyTheme(config) {
  const root = document.documentElement;
  const theme = config.theme;

  root.style.setProperty("--bg-top", theme.bgTop);
  root.style.setProperty("--bg-mid", theme.bgMid);
  root.style.setProperty("--bg-bottom", theme.bgBottom);
  root.style.setProperty("--accent-1", theme.accent1);
  root.style.setProperty("--accent-2", theme.accent2);
  root.style.setProperty("--accent-3", theme.accent3);
  root.style.setProperty("--accent-4", theme.accent4);
  root.style.setProperty("--text-main", theme.textMain);
  root.style.setProperty("--text-soft", theme.textSoft);
  root.style.setProperty("--text-dim", theme.textDim);
  root.style.setProperty("--border", theme.border);
  root.style.setProperty("--panel", theme.panel);

  document.title = config.siteTitle;
}

function renderFooter(config) {
  const footer = document.getElementById("footer");
  if (!footer) return;

  footer.innerHTML = `
    <div class="footer-inner">
      <div class="footer-follow">
        <span>${escapeHtml(config.footer.followLabel)}</span>
        ${config.footer.items.map((item) => `
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(item.label)}
          </a>
        `).join("")}
      </div>
      <div class="footer-copy">${escapeHtml(config.footer.copyright)}</div>
    </div>
  `;
}

function getOptimizedStarCount(configuredCount = 260) {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = Boolean(connection?.saveData);
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  const narrowViewport = window.innerWidth <= 700;
  const deviceMemory = navigator.deviceMemory || 8;
  const cpuThreads = navigator.hardwareConcurrency || 8;

  if (saveData || reducedMotion) {
    return 0;
  }

  if (deviceMemory <= 2 || cpuThreads <= 2) {
    return Math.min(configuredCount, 18);
  }

  if (narrowViewport || coarsePointer || deviceMemory <= 4 || cpuThreads <= 4) {
    return Math.min(configuredCount, 40);
  }

  return Math.min(configuredCount, 120);
}

function createStars(count = 260) {
  const stars = document.getElementById("stars");
  if (!stars) return;

  const optimizedCount = getOptimizedStarCount(count);
  stars.replaceChildren();

  if (optimizedCount <= 0) {
    return;
  }

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < optimizedCount; i += 1) {
    const star = document.createElement("span");
    const size = Math.random() * 2 + 0.7;

    star.className = "star";
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.animationDuration = `${2.6 + Math.random() * 3.8}s`;
    star.style.animationDelay = `${Math.random() * 3.2}s`;

    fragment.appendChild(star);
  }

  stars.appendChild(fragment);
}

function renderLimitedList(items, type, limit) {
  const visibleItems = items.slice(0, limit);
  const hasMore = items.length > limit;

  const chips = visibleItems.map((item) => `
    <a class="chip chip-link" href="${buildFilterLink(type, item)}">${escapeHtml(item)}</a>
  `).join("");

  const moreButton = hasMore
    ? `<a class="more-link" href="${buildAllPageUrl(type)}">더보기</a>`
    : "";

  return `
    <div class="chip-list">
      ${chips}
    </div>
    ${moreButton}
  `;
}

function renderSidebar(config, posts = [], options = {}) {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  const showLinks = options.showLinks ?? config.sidebar.showLinks;
  const showTags = options.showTags ?? config.sidebar.showTags;
  const showCategories = options.showCategories ?? config.sidebar.showCategories;
  const extraHtml = options.extraHtml ?? "";
  const profileHref = options.profileHref ?? "./blog.html";

  const tags = showTags ? uniqueTags(posts) : [];
  const categories = showCategories ? uniqueCategories(posts) : [];

  const linksHtml = showLinks
    ? `
      <section class="sidebar-card">
        <h2 class="sidebar-section-title">링크</h2>
        <div class="link-list">
          ${config.links.map((link) => `
            <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="link-button">
              <span class="link-button-left">
                <img
                  class="link-icon protected-image"
                  src="${escapeHtml(link.iconPath)}"
                  alt="${escapeHtml(link.label)}"
                  loading="lazy"
                  decoding="async"
                >
                <span class="link-label">${escapeHtml(link.label)}</span>
              </span>
              <span class="link-arrow">↗</span>
            </a>
          `).join("")}
        </div>
      </section>
    `
    : "";

  const tagsHtml = showTags
    ? `
      <section class="sidebar-card">
        <h2 class="sidebar-section-title">태그</h2>
        ${renderLimitedList(tags, "tag", 10)}
      </section>
    `
    : "";

  const categoriesHtml = showCategories
    ? `
      <section class="sidebar-card">
        <h2 class="sidebar-section-title">카테고리</h2>
        ${renderLimitedList(categories, "category", 10)}
      </section>
    `
    : "";

  sidebar.innerHTML = `
    <div class="sidebar-profile">
      <a href="${escapeHtml(profileHref)}" class="sidebar-card profile-card profile-card-link">
        <div class="profile-image">
          <img
            class="protected-image"
            src="${escapeHtml(config.profile.imagePath)}"
            alt="프로필 사진"
            loading="lazy"
            decoding="async"
            onerror="this.remove(); this.parentNode.innerHTML='<div class=&quot;profile-fallback&quot;>K</div>';"
          >
        </div>
        <div class="profile-name"><span class="gradient-title-text">${escapeHtml(config.profile.name)}</span></div>
        ${config.profile.showDescription ? `<p class="profile-desc">${escapeHtml(config.profile.description)}</p>` : ""}
      </a>
    </div>

    <div class="sidebar-scroll">
      ${extraHtml}
      ${linksHtml}
      ${tagsHtml}
      ${categoriesHtml}
    </div>
  `;
}

function slugifyHeading(text, fallbackIndex) {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s가-힣-]/g, "")
    .replace(/\s+/g, "-");

  return slug || `heading-${fallbackIndex}`;
}

function createPaginationItems(totalPages, currentPage) {
  const items = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i += 1) {
      items.push(i);
    }
    return items;
  }

  items.push(1);

  if (currentPage <= 4) {
    items.push(2, 3, 4, 5, "ellipsis", totalPages);
    return items;
  }

  if (currentPage >= totalPages - 3) {
    items.push("ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    return items;
  }

  items.push("ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages);
  return items;
}

function renderTagLinks(tags, maxVisible = 5) {
  const visible = tags.slice(0, maxVisible);
  const hiddenCount = Math.max(0, tags.length - maxVisible);

  let html = visible.map((tag) => `
    <a class="mini-chip mini-chip-link" href="${buildFilterLink("tag", tag)}">${escapeHtml(tag)}</a>
  `).join("");

  if (hiddenCount > 0) {
    html += `<span class="mini-chip mini-chip-muted">...</span>`;
  }

  return html;
}

function renderTopbarBrand(config) {
  const brandElement = document.getElementById("topbarBrand");
  if (!brandElement) return;

  const fallbackTitle =
    config?.branding?.title?.trim() ||
    config?.profile?.name?.trim() ||
    "김오둥";

  const logoPath = config?.branding?.logoPath?.trim();
  const logoAlt = config?.branding?.logoAlt?.trim() || fallbackTitle;

  if (!logoPath) {
    brandElement.innerHTML = `<span class="topbar-brand-text">${escapeHtml(fallbackTitle)}</span>`;
    return;
  }

  brandElement.innerHTML = `
    <span class="topbar-brand-logo-wrap">
      <img
        class="topbar-brand-logo protected-image"
        src="${escapeHtml(logoPath)}"
        alt="${escapeHtml(logoAlt)}"
        decoding="async"
      >
    </span>
    <span class="topbar-brand-text">${escapeHtml(fallbackTitle)}</span>
  `;

  const img = brandElement.querySelector(".topbar-brand-logo");
  if (!img) return;

  img.addEventListener("error", () => {
    brandElement.innerHTML = `<span class="topbar-brand-text">${escapeHtml(fallbackTitle)}</span>`;
  }, { once: true });
}

function renderFavicon(config) {
  const faviconElement = document.getElementById("dynamicFavicon");
  if (!faviconElement) return;

  const logoPath = config?.branding?.logoPath?.trim();
  const fallbackPath = config?.profile?.imagePath?.trim();
  const iconPath = logoPath || fallbackPath;

  if (!iconPath) return;
  faviconElement.setAttribute("href", iconPath);
}

function initProtectedImages() {
  const images = document.querySelectorAll("img.protected-image:not([data-protected='true'])");
  if (images.length === 0) return;

  if (!__protectedImageBlockHandler) {
    __protectedImageBlockHandler = (event) => {
      event.preventDefault();
      event.stopPropagation();
      return false;
    };
  }

  images.forEach((img) => {
    const parent = img.parentNode;
    if (!parent) return;

    const wrapper = document.createElement("span");
    wrapper.className = "protected-image-wrap";

    const shield = document.createElement("span");
    shield.className = "protected-image-shield";

    parent.insertBefore(wrapper, img);
    wrapper.appendChild(img);
    wrapper.appendChild(shield);

    img.dataset.protected = "true";
    img.setAttribute("draggable", "false");

    wrapper.addEventListener("contextmenu", __protectedImageBlockHandler);
    wrapper.addEventListener("dragstart", __protectedImageBlockHandler);
    wrapper.addEventListener("mousedown", __protectedImageBlockHandler);
    wrapper.addEventListener("selectstart", __protectedImageBlockHandler);
  });
}

function debounce(fn, wait = 120) {
  let timeoutId = 0;

  return function debounced(...args) {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      fn.apply(this, args);
    }, wait);
  };
}
