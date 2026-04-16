async function initAllPage() {
  const config = await fetchJson("./config/site.json");
  const posts = await loadAllPosts();

  applyTheme(config);
  renderTopbarBrand(config);
  renderFavicon(config);
  renderSidebar(config, posts);
  renderFooter(config);
  createStars(config.effects?.starCount ?? 260);

  const type = getQueryParam("type");
  const titleElement = document.getElementById("allPageTitle");
  const gridElement = document.getElementById("allItemsGrid");

  if (type !== "tag" && type !== "category") {
    titleElement.textContent = "잘못된 요청";
    gridElement.innerHTML = `<div class="empty-state">type은 tag 또는 category 여야 합니다.</div>`;
    return;
  }

  const items = type === "tag" ? uniqueTags(posts) : uniqueCategories(posts);
  titleElement.textContent = type === "tag" ? "전체 태그" : "전체 카테고리";

  gridElement.innerHTML = items.map(item => `
    <a class="all-item-card" href="${buildFilterLink(type, item)}">
      <span class="all-item-label">${escapeHtml(item)}</span>
    </a>
  `).join("");
}

initAllPage().catch(error => {
  console.error(error);
  document.body.innerHTML = `
    <div style="padding:24px;color:white;font-family:sans-serif;">
      초기화 중 오류가 발생했습니다.<br>
      ${escapeHtml(error.message)}
    </div>
  `;
});