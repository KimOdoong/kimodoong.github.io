async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`JSON 로드 실패: ${path}`);
  }
  return response.json();
}

async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`텍스트 로드 실패: ${path}`);
  }
  return response.text();
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
  } catch (error) {
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

async function loadAllPosts() {
  const manifest = await fetchJson("./posts/index.json");

  const posts = await Promise.all(
    manifest.posts.map(async (relativePath) => {
      const markdownText = await fetchText(resolvePostPath(relativePath));
      const parsed = parseJsonFrontMatter(markdownText);

      return {
        relativePath,
        title: parsed.meta.title,
        date: parsed.meta.date,
        category: parsed.meta.category,
        tags: parsed.meta.tags,
        excerpt: parsed.meta.excerpt || createExcerptFromMarkdown(parsed.body),
        content: parsed.body
      };
    })
  );

  posts.sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    return bTime - aTime;
  });

  return posts;
}

function uniqueCategories(posts) {
  return [...new Set(posts.map(post => post.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
}

function uniqueTags(posts) {
  return [...new Set(posts.flatMap(post => post.tags || []).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
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
        ${config.footer.items.map(item => `
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(item.label)}
          </a>
        `).join("")}
      </div>
      <div class="footer-copy">${escapeHtml(config.footer.copyright)}</div>
    </div>
  `;
}

function createStars(count = 260) {
  const stars = document.getElementById("stars");
  if (!stars) return;

  stars.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const star = document.createElement("span");
    star.className = "star";

    const size = Math.random() * 2.8 + 0.8;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.animationDuration = `${1.8 + Math.random() * 4.5}s`;
    star.style.animationDelay = `${Math.random() * 4}s`;

    stars.appendChild(star);
  }
}

function renderLimitedList(items, type, limit) {
  const visibleItems = items.slice(0, limit);
  const hasMore = items.length > limit;

  const chips = visibleItems.map(item => `
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

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`JSON 로드 실패: ${path}`);
  }
  return response.json();
}

async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`텍스트 로드 실패: ${path}`);
  }
  return response.text();
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
  } catch (error) {
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

async function loadAllPosts() {
  const manifest = await fetchJson("./posts/index.json");

  const posts = await Promise.all(
    manifest.posts.map(async (relativePath) => {
      const markdownText = await fetchText(resolvePostPath(relativePath));
      const parsed = parseJsonFrontMatter(markdownText);

      return {
        relativePath,
        title: parsed.meta.title,
        date: parsed.meta.date,
        category: parsed.meta.category,
        tags: parsed.meta.tags,
        excerpt: parsed.meta.excerpt || createExcerptFromMarkdown(parsed.body),
        content: parsed.body
      };
    })
  );

  posts.sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    return bTime - aTime;
  });

  return posts;
}

function uniqueCategories(posts) {
  return [...new Set(posts.map(post => post.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
}

function uniqueTags(posts) {
  return [...new Set(posts.flatMap(post => post.tags || []).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
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
        ${config.footer.items.map(item => `
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(item.label)}
          </a>
        `).join("")}
      </div>
      <div class="footer-copy">${escapeHtml(config.footer.copyright)}</div>
    </div>
  `;
}

function createStars(count = 260) {
  const stars = document.getElementById("stars");
  if (!stars) return;

  stars.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const star = document.createElement("span");
    star.className = "star";

    const size = Math.random() * 2.8 + 0.8;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.animationDuration = `${1.8 + Math.random() * 4.5}s`;
    star.style.animationDelay = `${Math.random() * 4}s`;

    stars.appendChild(star);
  }
}

function renderLimitedList(items, type, limit) {
  const visibleItems = items.slice(0, limit);
  const hasMore = items.length > limit;

  const chips = visibleItems.map(item => `
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

function renderSidebar(config, posts, options = {}) {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  const tags = uniqueTags(posts);
  const categories = uniqueCategories(posts);

  const showLinks = options.showLinks ?? config.sidebar.showLinks;
  const showTags = options.showTags ?? config.sidebar.showTags;
  const showCategories = options.showCategories ?? config.sidebar.showCategories;
  const extraHtml = options.extraHtml ?? "";
  const profileHref = options.profileHref ?? "./blog.html";

  const linksHtml = showLinks
    ? `
      <section class="sidebar-card">
        <h2 class="sidebar-section-title">링크</h2>
        <div class="link-list">
          ${config.links.map(link => `
            <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="link-button">
              <span class="link-button-left">
                <img
                  class="link-icon protected-image"
                  src="${escapeHtml(link.iconPath)}"
                  alt="${escapeHtml(link.label)}"
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

function buildTableOfContents(contentElement, tocElement) {
  const headings = Array.from(contentElement.querySelectorAll("h1, h2, h3"));

  if (headings.length === 0) {
    tocElement.innerHTML = "";
    return;
  }

  const usedIds = new Set();

  const itemsHtml = headings.map((heading, index) => {
    let id = heading.id || slugifyHeading(heading.textContent, index);

    while (usedIds.has(id)) {
      id = `${id}-${index}`;
    }

    usedIds.add(id);
    heading.id = id;

    const level = Number(heading.tagName.replace("H", ""));

    return `
      <a class="toc-item level-${level}" data-target-id="${escapeHtml(id)}" href="#${escapeHtml(id)}">
        ${escapeHtml(heading.textContent)}
      </a>
    `;
  }).join("");

  tocElement.innerHTML = `
    <div class="toc-card">
      <h2 class="toc-title">목차</h2>
      <div class="toc-list">
        ${itemsHtml}
      </div>
    </div>
  `;
}

function bindActiveToc(contentElement, tocElement) {
  const headings = Array.from(contentElement.querySelectorAll("h1, h2, h3"));
  const tocLinks = Array.from(tocElement.querySelectorAll(".toc-item"));

  if (headings.length === 0 || tocLinks.length === 0) {
    return;
  }

  const linkMap = new Map();
  tocLinks.forEach(link => {
    linkMap.set(link.dataset.targetId, link);
  });

  function updateActiveToc() {
    let currentHeading = headings[0];

    for (const heading of headings) {
      const rect = heading.getBoundingClientRect();
      if (rect.top <= 140) {
        currentHeading = heading;
      } else {
        break;
      }
    }

    tocLinks.forEach(link => link.classList.remove("active"));

    const activeLink = linkMap.get(currentHeading.id);
    if (activeLink) {
      activeLink.classList.add("active");
    }
  }

  updateActiveToc();
  window.addEventListener("scroll", updateActiveToc, { passive: true });
}

function createPaginationItems(totalPages, currentPage) {
  const items = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
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

  let html = visible.map(tag => `
    <a class="mini-chip mini-chip-link" href="${buildFilterLink("tag", tag)}">${escapeHtml(tag)}</a>
  `).join("");

  if (hiddenCount > 0) {
    html += `<span class="mini-chip mini-chip-muted">...</span>`;
  }

  return html;
}

function renderTopbarBrand(config) {
  const brandElement = document.getElementById("topbarBrand");
  if (!brandElement) {
    return;
  }

  const fallbackTitle =
    config?.branding?.title?.trim() ||
    config?.profile?.name?.trim() ||
    "김오둥";

  const logoPath = config?.branding?.logoPath?.trim();
  const logoAlt = config?.branding?.logoAlt?.trim() || fallbackTitle;

  if (!logoPath) {
    brandElement.innerHTML = `
      <span class="topbar-brand-text">${escapeHtml(fallbackTitle)}</span>
    `;
    return;
  }

  brandElement.innerHTML = `
    <span class="topbar-brand-logo-wrap">
      <img
        class="topbar-brand-logo protected-image"
        src="${escapeHtml(logoPath)}"
        alt="${escapeHtml(logoAlt)}"
      >
    </span>
    <span class="topbar-brand-text">${escapeHtml(fallbackTitle)}</span>
  `;

  const img = brandElement.querySelector(".topbar-brand-logo");
  if (!img) {
    brandElement.innerHTML = `
      <span class="topbar-brand-text">${escapeHtml(fallbackTitle)}</span>
    `;
    return;
  }

  img.addEventListener("error", () => {
    brandElement.innerHTML = `
      <span class="topbar-brand-text">${escapeHtml(fallbackTitle)}</span>
    `;
  });
}
function renderFavicon(config) {
  const faviconElement = document.getElementById("dynamicFavicon");
  if (!faviconElement) {
    return;
  }

  const logoPath = config?.branding?.logoPath?.trim();
  const fallbackPath = config?.profile?.imagePath?.trim();

  const iconPath = logoPath || fallbackPath;
  if (!iconPath) {
    return;
  }

  faviconElement.setAttribute("href", `${iconPath}?v=${Date.now()}`);
}


function initProtectedImages() {
  const images = document.querySelectorAll("img.protected-image");

  images.forEach((img) => {
    if (img.closest(".protected-image-wrap")) {
      return;
    }

    const wrapper = document.createElement("span");
    wrapper.className = "protected-image-wrap";

    const shield = document.createElement("span");
    shield.className = "protected-image-shield";

    img.parentNode.insertBefore(wrapper, img);
    wrapper.appendChild(img);
    wrapper.appendChild(shield);

    img.setAttribute("draggable", "false");

    const block = (event) => {
      event.preventDefault();
      event.stopPropagation();
      return false;
    };

    img.addEventListener("dragstart", block);
    img.addEventListener("contextmenu", block);
    img.addEventListener("selectstart", block);

    shield.addEventListener("contextmenu", block);
    shield.addEventListener("dragstart", block);
    shield.addEventListener("mousedown", block);
    shield.addEventListener("selectstart", block);
  });
}

function slugifyHeading(text, fallbackIndex) {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s가-힣-]/g, "")
    .replace(/\s+/g, "-");

  return slug || `heading-${fallbackIndex}`;
}

function buildTableOfContents(contentElement, tocElement) {
  const headings = Array.from(contentElement.querySelectorAll("h1, h2, h3"));

  if (headings.length === 0) {
    tocElement.innerHTML = "";
    return;
  }

  const usedIds = new Set();

  const itemsHtml = headings.map((heading, index) => {
    let id = heading.id || slugifyHeading(heading.textContent, index);

    while (usedIds.has(id)) {
      id = `${id}-${index}`;
    }

    usedIds.add(id);
    heading.id = id;

    const level = Number(heading.tagName.replace("H", ""));

    return `
      <a class="toc-item level-${level}" data-target-id="${escapeHtml(id)}" href="#${escapeHtml(id)}">
        ${escapeHtml(heading.textContent)}
      </a>
    `;
  }).join("");

  tocElement.innerHTML = `
    <div class="toc-card">
      <h2 class="toc-title">목차</h2>
      <div class="toc-list">
        ${itemsHtml}
      </div>
    </div>
  `;
}

function bindActiveToc(contentElement, tocElement) {
  const headings = Array.from(contentElement.querySelectorAll("h1, h2, h3"));
  const tocLinks = Array.from(tocElement.querySelectorAll(".toc-item"));

  if (headings.length === 0 || tocLinks.length === 0) {
    return;
  }

  const linkMap = new Map();
  tocLinks.forEach(link => {
    linkMap.set(link.dataset.targetId, link);
  });

  function updateActiveToc() {
    let currentHeading = headings[0];

    for (const heading of headings) {
      const rect = heading.getBoundingClientRect();
      if (rect.top <= 140) {
        currentHeading = heading;
      } else {
        break;
      }
    }

    tocLinks.forEach(link => link.classList.remove("active"));

    const activeLink = linkMap.get(currentHeading.id);
    if (activeLink) {
      activeLink.classList.add("active");
    }
  }

  updateActiveToc();
  window.addEventListener("scroll", updateActiveToc, { passive: true });
}

function createPaginationItems(totalPages, currentPage) {
  const items = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
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

  let html = visible.map(tag => `
    <a class="mini-chip mini-chip-link" href="${buildFilterLink("tag", tag)}">${escapeHtml(tag)}</a>
  `).join("");

  if (hiddenCount > 0) {
    html += `<span class="mini-chip mini-chip-muted">...</span>`;
  }

  return html;
}

function renderTopbarBrand(config) {
  const brandElement = document.getElementById("topbarBrand");
  if (!brandElement) {
    return;
  }

  const fallbackTitle =
    config?.branding?.title?.trim() ||
    config?.profile?.name?.trim() ||
    "김오둥";

  const logoPath = config?.branding?.logoPath?.trim();
  const logoAlt = config?.branding?.logoAlt?.trim() || fallbackTitle;

  if (!logoPath) {
    brandElement.innerHTML = `
      <span class="topbar-brand-text">${escapeHtml(fallbackTitle)}</span>
    `;
    return;
  }

  brandElement.innerHTML = `
    <span class="topbar-brand-logo-wrap">
      <img
        class="topbar-brand-logo protected-image"
        src="${escapeHtml(logoPath)}"
        alt="${escapeHtml(logoAlt)}"
      >
    </span>
    <span class="topbar-brand-text">${escapeHtml(fallbackTitle)}</span>
  `;

  const img = brandElement.querySelector(".topbar-brand-logo");
  if (!img) {
    brandElement.innerHTML = `
      <span class="topbar-brand-text">${escapeHtml(fallbackTitle)}</span>
    `;
    return;
  }

  img.addEventListener("error", () => {
    brandElement.innerHTML = `
      <span class="topbar-brand-text">${escapeHtml(fallbackTitle)}</span>
    `;
  });
}
function renderFavicon(config) {
  const faviconElement = document.getElementById("dynamicFavicon");
  if (!faviconElement) {
    return;
  }

  const logoPath = config?.branding?.logoPath?.trim();
  const fallbackPath = config?.profile?.imagePath?.trim();

  const iconPath = logoPath || fallbackPath;
  if (!iconPath) {
    return;
  }

  faviconElement.setAttribute("href", `${iconPath}?v=${Date.now()}`);
}


function initProtectedImages() {
  const images = document.querySelectorAll("img.protected-image");

  images.forEach((img) => {
    if (img.closest(".protected-image-wrap")) {
      return;
    }

    const wrapper = document.createElement("span");
    wrapper.className = "protected-image-wrap";

    const shield = document.createElement("span");
    shield.className = "protected-image-shield";

    img.parentNode.insertBefore(wrapper, img);
    wrapper.appendChild(img);
    wrapper.appendChild(shield);

    img.setAttribute("draggable", "false");

    const block = (event) => {
      event.preventDefault();
      event.stopPropagation();
      return false;
    };

    img.addEventListener("dragstart", block);
    img.addEventListener("contextmenu", block);
    img.addEventListener("selectstart", block);

    shield.addEventListener("contextmenu", block);
    shield.addEventListener("dragstart", block);
    shield.addEventListener("mousedown", block);
    shield.addEventListener("selectstart", block);
  });
}



