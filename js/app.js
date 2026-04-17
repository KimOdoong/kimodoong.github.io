let allPosts = [];
let currentPage = 1;
let currentKeyword = "";
let currentTagFilter = "";
let currentCategoryFilter = "";
let configData = null;

function filterPosts(posts, keyword, tagFilter, categoryFilter) {
  const trimmed = keyword.trim().toLowerCase();

  return posts.filter(post => {
    const keywordMatch = !trimmed || (
      post.title.toLowerCase().includes(trimmed) ||
      post.excerpt.toLowerCase().includes(trimmed) ||
      post.category.toLowerCase().includes(trimmed) ||
      (post.tags || []).some(tag => tag.toLowerCase().includes(trimmed))
    );

    const tagMatch = !tagFilter || (post.tags || []).includes(tagFilter);
    const categoryMatch = !categoryFilter || post.category === categoryFilter;

    return keywordMatch && tagMatch && categoryMatch;
  });
}

function renderActiveFilterBar() {
  const bar = document.getElementById("activeFilterBar");

  const items = [];
  if (currentTagFilter) {
    items.push({ type: "태그", value: currentTagFilter, key: "tag" });
  }
  if (currentCategoryFilter) {
    items.push({ type: "카테고리", value: currentCategoryFilter, key: "category" });
  }

  if (items.length === 0) {
    bar.classList.add("hidden");
    bar.innerHTML = "";
    return;
  }

  bar.classList.remove("hidden");
  bar.innerHTML = `
    <div class="active-filter-label">현재 필터</div>
    <div class="active-filter-items">
      ${items.map(item => `
        <button class="active-filter-chip" data-clear-key="${item.key}">
          <span>${escapeHtml(item.type)}: ${escapeHtml(item.value)}</span>
          <span class="active-filter-remove">×</span>
        </button>
      `).join("")}
      <button class="active-filter-reset" id="resetAllFilters">전체 해제</button>
    </div>
  `;

  bar.querySelectorAll("[data-clear-key]").forEach(button => {
    button.addEventListener("click", () => {
      const key = button.dataset.clearKey;

      if (key === "tag") {
        currentTagFilter = "";
      }
      if (key === "category") {
        currentCategoryFilter = "";
      }

      currentPage = 1;
      syncUrl();
      updateList();
    });
  });

  document.getElementById("resetAllFilters").addEventListener("click", () => {
    currentTagFilter = "";
    currentCategoryFilter = "";
    currentKeyword = "";
    currentPage = 1;
    document.getElementById("searchInput").value = "";
    syncUrl();
    updateList();
  });
}

function syncUrl() {
  const url = updateQueryParams({
    tag: currentTagFilter || null,
    category: currentCategoryFilter || null,
    q: currentKeyword || null,
    page: currentPage > 1 ? String(currentPage) : null
  });

  window.history.replaceState({}, "", url);
}

function renderPostList(posts, currentPageValue, postsPerPage) {
  const postList = document.getElementById("postList");

  if (posts.length === 0) {
    postList.innerHTML = `<div class="empty-state">조건에 맞는 포스트가 없습니다.</div>`;
    return;
  }

  const startIndex = (currentPageValue - 1) * postsPerPage;
  const visiblePosts = posts.slice(startIndex, startIndex + postsPerPage);

  postList.innerHTML = visiblePosts.map(post => `
    <a class="post-card-link" href="${buildPostUrl(post.relativePath)}">
      <article class="post-card">
        <h2 class="post-title"><span class="gradient-title-text">${escapeHtml(post.title)}</span></h2>

        <p class="post-excerpt">${escapeHtml(post.excerpt)}</p>

        <div class="post-footer">
          <div class="post-info">
            <span>${escapeHtml(post.date)}</span>
            <a class="category-link" href="${buildFilterLink("category", post.category)}">${escapeHtml(post.category)}</a>
          </div>
        </div>

        <div class="post-tags-row">
          <span class="meta-label-inline">Tags</span>
          <div class="post-inline-chips">
            ${renderTagLinks(post.tags || [], 5)}
          </div>
        </div>
      </article>
    </a>
  `).join("");

  postList.querySelectorAll(".category-link, .mini-chip-link").forEach(link => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.location.href = link.href;
    });
  });
}

function renderPagination(posts, currentPageValue, postsPerPage) {
  const pagination = document.getElementById("pagination");
  const totalPages = Math.ceil(posts.length / postsPerPage);

  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  const items = createPaginationItems(totalPages, currentPageValue);
  const prevDisabled = currentPageValue <= 1;
  const nextDisabled = currentPageValue >= totalPages;

  pagination.innerHTML = `
    <button class="page-segment nav ${prevDisabled ? "disabled" : ""}" data-page="${currentPageValue - 1}" ${prevDisabled ? "disabled" : ""}>
      이전
    </button>

    ${items.map(item => {
      if (item === "ellipsis") {
        return `<span class="page-segment ellipsis">···</span>`;
      }

      return `
        <button class="page-segment number ${item === currentPageValue ? "active" : ""}" data-page="${item}">
          ${item}
        </button>
      `;
    }).join("")}

    <button class="page-segment nav ${nextDisabled ? "disabled" : ""}" data-page="${currentPageValue + 1}" ${nextDisabled ? "disabled" : ""}>
      다음
    </button>
  `;

  pagination.querySelectorAll("button[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      currentPage = Number(button.dataset.page);
      syncUrl();
      updateList();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function updateList() {
  const filteredPosts = filterPosts(allPosts, currentKeyword, currentTagFilter, currentCategoryFilter);
  renderActiveFilterBar();
  renderPostList(filteredPosts, currentPage, configData.postsPerPage);
  renderPagination(filteredPosts, currentPage, configData.postsPerPage);
  initProtectedImages();
}

function bindSearch() {
  const searchInput = document.getElementById("searchInput");

  searchInput.addEventListener("input", (event) => {
    currentKeyword = event.target.value;
    currentPage = 1;
    syncUrl();
    updateList();
  });
}

function bindSidebarFilters() {
  document.querySelectorAll('.chip-link[href*="tag="]').forEach(link => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const url = new URL(link.href, window.location.href);
      currentTagFilter = url.searchParams.get("tag") || "";
      currentCategoryFilter = "";
      currentPage = 1;
      syncUrl();
      updateList();
    });
  });

  document.querySelectorAll('.chip-link[href*="category="]').forEach(link => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const url = new URL(link.href, window.location.href);
      currentCategoryFilter = url.searchParams.get("category") || "";
      currentTagFilter = "";
      currentPage = 1;
      syncUrl();
      updateList();
    });
  });
}

function restoreStateFromUrl() {
  currentTagFilter = getQueryParam("tag") || "";
  currentCategoryFilter = getQueryParam("category") || "";
  currentKeyword = getQueryParam("q") || "";
  currentPage = Number(getQueryParam("page") || "1");

  if (currentPage < 1 || Number.isNaN(currentPage)) {
    currentPage = 1;
  }
}

async function init() {
  configData = await fetchJson("./config/site.json");
  allPosts = await loadAllPosts();

  restoreStateFromUrl();

  applyTheme(configData);
  renderTopbarBrand(configData);
  renderFavicon(configData);
  renderSidebar(configData, allPosts);
  renderFooter(configData);
  initProtectedImages();

  document.getElementById("pageTitle").textContent = configData.pageTitle;
  document.getElementById("searchInput").value = currentKeyword;

  bindSearch();
  bindSidebarFilters();
  updateList();
  createStars(configData.effects?.starCount ?? 260);
}

init().catch(error => {
  console.error(error);
  document.body.innerHTML = `
    <div style="padding:24px;color:white;font-family:sans-serif;">
      초기화 중 오류가 발생했습니다.<br>
      ${escapeHtml(error.message)}
    </div>
  `;
});