async function renderTabHtml(profileData, currentTabId) {
  const tabContentPanel = document.getElementById("tabContentPanel");
  const currentTab = profileData.tabs.find(tab => tab.id === currentTabId);

  if (!currentTab) {
    tabContentPanel.innerHTML = "";
    return;
  }

  try {
    const html = await fetchText(currentTab.htmlPath);

    tabContentPanel.innerHTML = `
      <div class="simple-tab-head">
        <h2 class="simple-tab-title">${escapeHtml(currentTab.title)}</h2>
      </div>
      <div class="simple-tab-html">
        ${html}
      </div>
    `;
  } catch (error) {
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
  let currentTabId = profileData.tabs[0]?.id ?? "";

  async function renderButtons() {
    tabButtonRow.innerHTML = profileData.tabs.map(tab => `
      <button class="tab-button ${tab.id === currentTabId ? "active" : ""}" data-tab-id="${escapeHtml(tab.id)}">
        ${escapeHtml(tab.label)}
      </button>
    `).join("");

    tabButtonRow.querySelectorAll("[data-tab-id]").forEach(button => {
      button.addEventListener("click", async () => {
        currentTabId = button.dataset.tabId;
        await renderButtons();
        await renderTabHtml(profileData, currentTabId);
      });
    });
  }

  await renderButtons();
  await renderTabHtml(profileData, currentTabId);
}

async function initHomePage() {
  const siteConfig = await fetchJson("./config/site.json");
  const profileData = await fetchJson("./config/profile.json");

  applyTheme(siteConfig);
  renderTopbarBrand(siteConfig);
  renderFavicon(siteConfig);
  renderFooter(siteConfig);
  createStars(siteConfig.effects?.starCount ?? 260);

  document.getElementById("heroTitle").textContent = profileData.hero.title;
  document.getElementById("heroSubtitle").textContent = profileData.hero.subtitle;
  document.getElementById("heroDescription").textContent = profileData.hero.description;

  const heroProfileImage = document.getElementById("heroProfileImage");
    heroProfileImage.innerHTML = `
    <img
        class="protected-image"
        src="${escapeHtml(siteConfig.profile.imagePath)}"
        alt="${escapeHtml(siteConfig.profile.name)}"
        onerror="this.remove(); this.parentNode.innerHTML='<div class=&quot;profile-fallback&quot;>K</div>';"
    >
    `;

  await renderHomeTabs(profileData);
  initProtectedImages();
}

initHomePage().catch(error => {
  console.error(error);
  document.body.innerHTML = `
    <div style="padding:24px;color:white;font-family:sans-serif;">
      메인 페이지 초기화 중 오류가 발생했습니다.<br>
      ${escapeHtml(error.message)}
    </div>
  `;
});