const __homeTabHtmlCache = new Map();

async function renderTabHtml(profileData, currentTabId) {
  const tabContentPanel = document.getElementById("tabContentPanel");
  const currentTab = profileData.tabs.find((tab) => tab.id === currentTabId);

  if (!tabContentPanel || !currentTab) {
    if (tabContentPanel) tabContentPanel.innerHTML = "";
    return;
  }

  try {
    let html = __homeTabHtmlCache.get(currentTab.htmlPath);
    if (!html) {
      html = await fetchText(currentTab.htmlPath);
      __homeTabHtmlCache.set(currentTab.htmlPath, html);
    }

    tabContentPanel.innerHTML = `
      <div class="simple-tab-head">
        <h2 class="simple-tab-title">${escapeHtml(currentTab.title)}</h2>
      </div>
      <div class="simple-tab-html">${html}</div>
    `;
  } catch {
    tabContentPanel.innerHTML = `
      <div class="inline-error-box">
        <strong>탭 내용을 불러오지 못했습니다.</strong><br>
        ${escapeHtml(currentTab.htmlPath)}
      </div>
    `;
  }
}

async function renderHomeTabs(profileData) {
  const tabButtonRow = document.getElementById("tabButtonRow");
  if (!tabButtonRow) return;

  let currentTabId = profileData.tabs[0]?.id ?? "";

  function renderButtons() {
    tabButtonRow.innerHTML = profileData.tabs.map((tab) => `
      <button class="tab-button ${tab.id === currentTabId ? "active" : ""}" data-tab-id="${escapeHtml(tab.id)}">
        ${escapeHtml(tab.label)}
      </button>
    `).join("");
  }

  renderButtons();
  await renderTabHtml(profileData, currentTabId);

  tabButtonRow.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-tab-id]");
    if (!button) return;

    const nextTabId = button.dataset.tabId;
    if (!nextTabId || nextTabId === currentTabId) return;

    currentTabId = nextTabId;
    renderButtons();
    await renderTabHtml(profileData, currentTabId);
  });
}

async function initHomePage() {
  const siteConfig = await fetchJson("./config/site.json");
  const profileData = await fetchJson("./config/profile.json");

  applyTheme(siteConfig);
  renderTopbarBrand(siteConfig);
  renderFavicon(siteConfig);
  renderFooter(siteConfig);

  const title = document.getElementById("heroTitle");
  const subtitle = document.getElementById("heroSubtitle");
  const description = document.getElementById("heroDescription");
  const heroProfileImage = document.getElementById("heroProfileImage");

  if (title) title.textContent = profileData.hero.title;
  if (subtitle) subtitle.textContent = profileData.hero.subtitle;
  if (description) description.textContent = profileData.hero.description;

  if (heroProfileImage) {
    heroProfileImage.innerHTML = `
      <img
        class="protected-image"
        src="${escapeHtml(siteConfig.profile.imagePath)}"
        alt="${escapeHtml(siteConfig.profile.name)}"
        loading="eager"
        decoding="async"
        onerror="this.remove(); this.parentNode.innerHTML='<div class=&quot;profile-fallback&quot;>K</div>';"
      >
    `;
  }

  await renderHomeTabs(profileData);
  initProtectedImages();

  window.requestAnimationFrame(() => {
    createStars(siteConfig.effects?.starCount ?? 260);
  });
}

initHomePage().catch((error) => {
  console.error(error);
  document.body.innerHTML = `
    <div style="padding:24px;color:white;font-family:sans-serif;">
      메인 페이지 초기화 중 오류가 발생했습니다.<br>
      ${escapeHtml(error.message)}
    </div>
  `;
});
