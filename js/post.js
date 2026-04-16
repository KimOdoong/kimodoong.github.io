async function initPostPage() {
  const contentElement = document.getElementById("postContent");
  const titleElement = document.getElementById("postTitle");
  const metaElement = document.getElementById("postMeta");
  const tagsElement = document.getElementById("postTags");
  const categoryElement = document.getElementById("postCategory");

  try {
    const config = await fetchJson("./config/site.json");
    const posts = await loadAllPosts();

    applyTheme(config);
    renderTopbarBrand(config);
    renderFavicon(config);
    renderFooter(config);
    createStars(config.effects?.starCount ?? 260);

    const rawPath = getQueryParam("path");

    if (!rawPath) {
      renderSidebar(config, posts, {
        showLinks: false,
        showTags: false,
        showCategories: false,
        profileHref: "./blog.html"
      });

      titleElement.textContent = "포스트 경로가 없습니다.";
      contentElement.innerHTML = `
        <div class="inline-error-box">
          URL에 <code>path</code> 파라미터가 없습니다.
        </div>
      `;
      initProtectedImages();
      return;
    }

    const normalizedPath = decodeURIComponent(rawPath).replace(/^\.?\/?posts\//, "");
    const post = posts.find(item => item.relativePath === normalizedPath);

    if (!post) {
      renderSidebar(config, posts, {
        showLinks: false,
        showTags: false,
        showCategories: false,
        profileHref: "./blog.html"
      });

      titleElement.textContent = "포스트를 찾을 수 없습니다.";
      metaElement.innerHTML = "";
      tagsElement.innerHTML = "";
      categoryElement.innerHTML = "";
      contentElement.innerHTML = `
        <div class="inline-error-box">
          요청한 포스트를 찾지 못했습니다.<br>
          <strong>path:</strong> ${escapeHtml(normalizedPath)}
        </div>
      `;
      initProtectedImages();
      return;
    }

    document.title = `${post.title} - ${config.siteTitle}`;

    titleElement.textContent = post.title;
    metaElement.innerHTML = `<span>${escapeHtml(post.date)}</span>`;

    categoryElement.innerHTML = `
      <a class="mini-chip mini-chip-link" href="${buildFilterLink("category", post.category)}">${escapeHtml(post.category)}</a>
    `;

    tagsElement.innerHTML = (post.tags || [])
      .map(tag => `<a class="mini-chip mini-chip-link" href="${buildFilterLink("tag", tag)}">${escapeHtml(tag)}</a>`)
      .join("");

    contentElement.innerHTML = marked.parse(post.content);

    const tocHtml = buildSidebarTableOfContents(contentElement);

    renderSidebar(config, posts, {
      showLinks: false,
      showTags: false,
      showCategories: false,
      extraHtml: tocHtml,
      profileHref: "./blog.html"
    });

    bindActiveSidebarToc(contentElement);
    initProtectedImages();
  } catch (error) {
    console.error(error);

    titleElement.textContent = "포스트 로드 실패";
    metaElement.innerHTML = "";
    tagsElement.innerHTML = "";
    categoryElement.innerHTML = "";
    contentElement.innerHTML = `
      <div class="inline-error-box">
        <p><strong>포스트를 불러오는 중 오류가 발생했습니다.</strong></p>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

function buildSidebarTableOfContents(contentElement) {
  const headings = Array.from(contentElement.querySelectorAll("h1, h2, h3"));

  if (headings.length === 0) {
    return "";
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

  return `
    <section class="sidebar-card post-sidebar-toc-card">
      <h2 class="sidebar-section-title">목차</h2>
      <div class="toc-list">
        ${itemsHtml}
      </div>
    </section>
  `;
}

function bindActiveSidebarToc(contentElement) {
  const headings = Array.from(contentElement.querySelectorAll("h1, h2, h3"));
  const tocLinks = Array.from(document.querySelectorAll(".toc-item"));

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

initPostPage();