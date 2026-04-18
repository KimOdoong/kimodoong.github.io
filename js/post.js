let __giscusLoaded = false;
let __giscusMessageBound = false;

function renderGiscus() {
  if (__giscusLoaded) return;

  const container = document.getElementById("giscusContainer");
  if (!container) return;

  __giscusLoaded = true;
  container.innerHTML = "";

  const script = document.createElement("script");
  script.src = "https://giscus.app/client.js";
  script.async = true;
  script.crossOrigin = "anonymous";
  script.setAttribute("data-repo", "kimodoong/kimodoong.github.io");
  script.setAttribute("data-repo-id", "R_kgDOSEKH8w");
  script.setAttribute("data-category", "Announcements");
  script.setAttribute("data-category-id", "DIC_kwDOSEKH884C697E");
  script.setAttribute("data-mapping", "url");
  script.setAttribute("data-strict", "0");
  script.setAttribute("data-reactions-enabled", "1");
  script.setAttribute("data-emit-metadata", "1");
  script.setAttribute("data-input-position", "bottom");
  script.setAttribute("data-theme", "preferred_color_scheme");
  script.setAttribute("data-lang", "ko");

  container.appendChild(script);
}

function deferGiscusLoad() {
  const commentsSection = document.getElementById("commentsSection");
  if (!commentsSection) return;

  if (!("IntersectionObserver" in window)) {
    renderGiscus();
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) {
      return;
    }

    observer.disconnect();
    renderGiscus();
  }, {
    rootMargin: "300px 0px"
  });

  observer.observe(commentsSection);
}

function bindGiscusManageLink() {
  if (__giscusMessageBound) return;

  const manageLink = document.getElementById("giscusManageLink");
  if (!manageLink) return;

  __giscusMessageBound = true;
  const fallbackUrl = "https://github.com/kimodoong/kimodoong.github.io/discussions";

  manageLink.href = fallbackUrl;
  manageLink.classList.remove("hidden");
  manageLink.textContent = "GitHub Discussions에서 댓글 관리하기 ↗";

  window.addEventListener("message", (event) => {
    if (event.origin !== "https://giscus.app") return;
    if (!(typeof event.data === "object" && event.data?.giscus)) return;

    const discussion = event.data.giscus?.discussion;
    const discussionUrl =
      discussion?.url ||
      discussion?.html_url ||
      discussion?.browserUrl ||
      "";

    if (typeof discussionUrl === "string" && discussionUrl.startsWith("https://github.com/")) {
      manageLink.href = discussionUrl;
      manageLink.textContent = "GitHub에서 이 글 댓글 관리하기 ↗";
    }
  });
}

function buildSidebarTableOfContents(contentElement) {
  const headings = Array.from(contentElement.querySelectorAll("h1, h2, h3"));
  if (headings.length === 0) return "";

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

  return `
    <section class="sidebar-card post-sidebar-toc-card">
      <h2 class="sidebar-section-title">목차</h2>
      <div class="toc-list">${itemsHtml}</div>
    </section>
  `;
}

function bindActiveSidebarToc(contentElement) {
  const headings = Array.from(contentElement.querySelectorAll("h1, h2, h3"));
  const tocLinks = Array.from(document.querySelectorAll(".toc-item"));
  const sidebarScroll = document.querySelector(".sidebar-scroll");

  if (headings.length === 0 || tocLinks.length === 0 || !sidebarScroll) {
    return;
  }

  const linkMap = new Map();
  tocLinks.forEach((link) => {
    linkMap.set(link.dataset.targetId, link);
  });

  function keepActiveLinkVisible(activeLink) {
    const containerRect = sidebarScroll.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    const padding = 12;
    const topLimit = containerRect.top + padding;
    const bottomLimit = containerRect.bottom - padding;

    if (linkRect.top < topLimit) {
      sidebarScroll.scrollTop -= (topLimit - linkRect.top);
    } else if (linkRect.bottom > bottomLimit) {
      sidebarScroll.scrollTop += (linkRect.bottom - bottomLimit);
    }
  }

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

    tocLinks.forEach((link) => link.classList.remove("active"));

    const activeLink = linkMap.get(currentHeading.id);
    if (activeLink) {
      activeLink.classList.add("active");
      keepActiveLinkVisible(activeLink);
    }
  }

  let scheduled = false;
  const onScroll = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      updateActiveToc();
    });
  };

  updateActiveToc();
  window.addEventListener("scroll", onScroll, { passive: true });
}

async function initPostPage() {
  const contentElement = document.getElementById("postContent");
  const titleElement = document.getElementById("postTitle");
  const metaElement = document.getElementById("postMeta");
  const tagsElement = document.getElementById("postTags");
  const categoryElement = document.getElementById("postCategory");

  try {
    const config = await fetchJson("./config/site.json");

    applyTheme(config);
    renderTopbarBrand(config);
    renderFavicon(config);
    renderFooter(config);

    const rawPath = getQueryParam("path");

    if (!rawPath) {
      renderSidebar(config, [], {
        showLinks: false,
        showTags: false,
        showCategories: false,
        profileHref: "./blog.html"
      });

      if (titleElement) titleElement.textContent = "포스트 경로가 없습니다.";
      if (contentElement) {
        contentElement.innerHTML = `
          <div class="inline-error-box">
            URL에 <code>path</code> 파라미터가 없습니다.
          </div>
        `;
      }

      initProtectedImages();
      return;
    }

    const post = await loadPostByRelativePath(rawPath);
    document.title = `${post.title} - ${config.siteTitle}`;

    if (titleElement) {
      titleElement.innerHTML = `<span class="gradient-title-text">${escapeHtml(post.title)}</span>`;
    }
    if (metaElement) {
      metaElement.innerHTML = `<span>${escapeHtml(post.date)}</span>`;
    }
    if (categoryElement) {
      categoryElement.innerHTML = `
        <a class="mini-chip mini-chip-link" href="${buildFilterLink("category", post.category)}">${escapeHtml(post.category)}</a>
      `;
    }
    if (tagsElement) {
      tagsElement.innerHTML = (post.tags || [])
        .map((tag) => `<a class="mini-chip mini-chip-link" href="${buildFilterLink("tag", tag)}">${escapeHtml(tag)}</a>`)
        .join("");
    }
    if (contentElement) {
      contentElement.innerHTML = MarkdownShortcodes.render(post.content, marked.parse);
      MarkdownShortcodes.initFoldSummaries(contentElement);
    }

    const tocHtml = contentElement ? buildSidebarTableOfContents(contentElement) : "";
    renderSidebar(config, [], {
      showLinks: false,
      showTags: false,
      showCategories: false,
      extraHtml: tocHtml,
      profileHref: "./blog.html"
    });

    if (contentElement) {
      bindActiveSidebarToc(contentElement);
    }

    bindGiscusManageLink();
    deferGiscusLoad();
    initProtectedImages();

    window.requestAnimationFrame(() => {
      createStars(config.effects?.starCount ?? 260);
    });
  } catch (error) {
    console.error(error);

    if (titleElement) titleElement.textContent = "포스트 로드 실패";
    if (metaElement) metaElement.innerHTML = "";
    if (tagsElement) tagsElement.innerHTML = "";
    if (categoryElement) categoryElement.innerHTML = "";
    if (contentElement) {
      contentElement.innerHTML = `
        <div class="inline-error-box">
          <p><strong>포스트를 불러오는 중 오류가 발생했습니다.</strong></p>
          <p>${escapeHtml(error.message)}</p>
        </div>
      `;
    }
  }
}

initPostPage();
