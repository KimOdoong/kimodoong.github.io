(function (global) {
  "use strict";

  const ATTR_REGEX = /([a-zA-Z0-9_-]+)=(".*?"|'.*?'|[^\s]+)/g;
  const YT_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeHtmlAttr(value) {
    return escapeHtml(value);
  }

  function parseAttributes(raw) {
    const attrs = Object.create(null);
    if (!raw) return attrs;

    ATTR_REGEX.lastIndex = 0;

    let match;
    while ((match = ATTR_REGEX.exec(raw)) !== null) {
      const key = match[1].toLowerCase();
      let value = match[2];

      const first = value.charCodeAt(0);
      const last = value.charCodeAt(value.length - 1);
      const quoted =
        (first === 34 && last === 34) ||
        (first === 39 && last === 39);

      if (quoted) {
        value = value.slice(1, -1);
      }

      attrs[key] = value;
    }

    return attrs;
  }

  function normalizeSize(value, fallback) {
    if (value == null || value === "") return fallback;

    const v = String(value).trim();

    if (/^\d+%$/.test(v)) return v;
    if (/^\d+px$/.test(v)) return v;
    if (/^\d+$/.test(v)) return v + "px";

    return fallback;
  }

  function normalizeAlign(value) {
    if (value == null || value === "") return false;

    const v = String(value).trim().toLowerCase();

    if (v === "false" || v === "none") return false;
    if (v === "left" || v === "center" || v === "right") return v;

    return false;
  }

  function normalizeBoolean(value, fallback) {
    if (value == null || value === "") return fallback;

    const v = String(value).trim().toLowerCase();

    if (v === "true" || v === "1" || v === "yes" || v === "y" || v === "open") {
      return true;
    }

    if (v === "false" || v === "0" || v === "no" || v === "n" || v === "closed") {
      return false;
    }

    return fallback;
  }

  function getIframeMargin(align) {
    if (align === "center") return "0 auto";
    if (align === "right") return "0 0 0 auto";
    return "0";
  }

  function buildInlineStyle(styleMap) {
    let out = "";

    for (const key in styleMap) {
      if (!Object.prototype.hasOwnProperty.call(styleMap, key)) continue;

      const value = styleMap[key];
      if (value == null || value === "") continue;

      out += key + ":" + value + ";";
    }

    return out;
  }

  function extractYouTubeVideoId(input) {
    if (!input) return null;

    const trimmed = input.trim();
    if (YT_ID_REGEX.test(trimmed)) {
      return trimmed;
    }

    if (
      trimmed.indexOf("youtu.be/") === -1 &&
      trimmed.indexOf("youtube.com/") === -1 &&
      trimmed.indexOf("m.youtube.com/") === -1
    ) {
      return null;
    }

    try {
      const url = new URL(trimmed);
      const host = url.hostname.replace(/^www\./, "");

      if (host === "youtu.be") {
        const id = url.pathname.slice(1).split("/")[0];
        return YT_ID_REGEX.test(id) ? id : null;
      }

      if (host === "youtube.com" || host === "m.youtube.com") {
        if (url.pathname === "/watch") {
          const id = url.searchParams.get("v");
          return YT_ID_REGEX.test(id) ? id : null;
        }

        if (url.pathname.startsWith("/embed/")) {
          const id = url.pathname.slice(7).split("/")[0];
          return YT_ID_REGEX.test(id) ? id : null;
        }

        if (url.pathname.startsWith("/shorts/")) {
          const id = url.pathname.slice(8).split("/")[0];
          return YT_ID_REGEX.test(id) ? id : null;
        }
      }
    } catch {
      return null;
    }

    return null;
  }

  function renderMarkdownSafely(markdown, renderMarkdown) {
    if (!markdown) return "";
    if (typeof renderMarkdown !== "function") {
      return escapeHtml(markdown);
    }
    return renderMarkdown(markdown);
  }

  function findMatchingCloseTag(source, tagName, startIndex) {
    const lowerSource = source.toLowerCase();
    const lowerTagName = String(tagName).toLowerCase();

    const openToken = "[" + lowerTagName;
    const closeToken = "[/" + lowerTagName + "]";

    let depth = 1;
    let index = startIndex;

    while (index < source.length) {
      const nextOpen = lowerSource.indexOf(openToken, index);
      const nextClose = lowerSource.indexOf(closeToken, index);

      if (nextClose === -1) {
        return -1;
      }

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        index = nextOpen + openToken.length;
        continue;
      }

      depth--;
      if (depth === 0) {
        return nextClose;
      }

      index = nextClose + closeToken.length;
    }

    return -1;
  }

  function createProcessor() {
    const blockHandlers = Object.create(null);
    const inlineHandlers = Object.create(null);

    function registerBlock(tagName, handler) {
      blockHandlers[String(tagName).toLowerCase()] = handler;
    }

    function registerInline(tagName, handler) {
      inlineHandlers[String(tagName).toLowerCase()] = handler;
    }

    function replaceInlineShortcodes(markdown, renderMarkdown) {
      if (!markdown || markdown.indexOf("[") === -1) return markdown;

      return markdown.replace(
        /\[([a-zA-Z0-9_-]+)([^\]]*)\]([\s\S]*?)\[\/([a-zA-Z0-9_-]+)\]/gi,
        function (fullMatch, openTagName, rawAttrs, content, closeTagName) {
          const openName = String(openTagName).toLowerCase();
          const closeName = String(closeTagName).toLowerCase();

          if (openName !== closeName) {
            return fullMatch;
          }

          const handler = inlineHandlers[openName];
          if (!handler) return fullMatch;

          const attrs = parseAttributes(rawAttrs);
          return handler(content, attrs, renderMarkdown, processAll);
        }
      );
    }

    function replaceColumnsBlocks(markdown, renderMarkdown) {
  if (!markdown || markdown.indexOf("[columns") === -1) return markdown;

  return markdown.replace(
    /\[columns([^\]]*)\]([\s\S]*?)\[\/columns\]/gi,
    function (fullMatch, rawAttrs, content) {
      const attrs = parseAttributes(rawAttrs);
      const gap = normalizeSize(attrs.gap, "1rem");
      const cols = attrs.cols && /^\d+$/.test(attrs.cols) ? Math.max(1, Number(attrs.cols)) : null;

      const itemRegex = /\[item\]([\s\S]*?)\[\/item\]/gi;
      const items = [];
      let match;

      while ((match = itemRegex.exec(content)) !== null) {
        const rawItem = match[1].trim();
        const itemHtml = renderMarkdownSafely(
          processAll(rawItem, renderMarkdown),
          renderMarkdown
        );
        items.push(`<div class="sc-column">${itemHtml}</div>`);
      }

      if (items.length === 0) {
        return fullMatch;
      }

      const gridTemplateColumns = cols
        ? `repeat(${cols}, minmax(0, 1fr))`
        : `repeat(${items.length}, minmax(0, 1fr))`;

      return (
        `<div class="sc-columns" style="gap:${escapeHtmlAttr(gap)};grid-template-columns:${escapeHtmlAttr(gridTemplateColumns)};">` +
          items.join("") +
        `</div>`
      );
    }
  );
}

    function replaceBlockShortcodes(markdown, renderMarkdown) {
      if (!markdown || markdown.indexOf("[") === -1) return markdown;

      let result = "";
      let cursor = 0;

      while (cursor < markdown.length) {
        const openIndex = markdown.indexOf("[", cursor);
        if (openIndex === -1) {
          result += markdown.slice(cursor);
          break;
        }

        result += markdown.slice(cursor, openIndex);

        const headerMatch = /^\[([a-zA-Z0-9_-]+)([^\]]*)\]/i.exec(markdown.slice(openIndex));
        if (!headerMatch) {
          result += markdown[openIndex];
          cursor = openIndex + 1;
          continue;
        }

        const tagName = headerMatch[1].toLowerCase();
        const handler = blockHandlers[tagName];
        if (!handler) {
          result += markdown[openIndex];
          cursor = openIndex + 1;
          continue;
        }

        const openTagFull = headerMatch[0];
        const rawAttrs = headerMatch[2] || "";
        const contentStart = openIndex + openTagFull.length;
        const closeIndex = findMatchingCloseTag(markdown, tagName, contentStart);

        if (closeIndex === -1) {
          result += markdown.slice(openIndex, contentStart);
          cursor = contentStart;
          continue;
        }

        const closeToken = "[/" + tagName + "]";
        const rawContent = markdown.slice(contentStart, closeIndex);
        const attrs = parseAttributes(rawAttrs);

        const replaced = handler(rawContent, attrs, renderMarkdown, processAll);
        result += replaced;
        cursor = closeIndex + closeToken.length;
      }

      return result;
    }

    function processAll(markdown, renderMarkdown) {
      if (!markdown || typeof markdown !== "string") return markdown;

      let output = markdown;

      output = replaceColumnsBlocks(output, renderMarkdown);
      output = replaceBlockShortcodes(output, renderMarkdown);
      output = replaceInlineShortcodes(output, renderMarkdown);

      return output;
    }

    function render(markdown, renderMarkdown) {
      const processed = processAll(markdown, renderMarkdown);
      return renderMarkdownSafely(processed, renderMarkdown);
    }

    return {
      registerBlock,
      registerInline,
      render,
      processAll
    };
  }

  function initFoldSummaries(root) {
    const base = root || document;
    const folds = base.querySelectorAll(".sc-fold");

    for (const fold of folds) {
      const summary = fold.querySelector(".sc-fold-summary");
      if (!summary) continue;

      const closedText = fold.dataset.closedText || "자세한 내용";
      const openedText = fold.dataset.openedText || "접기";

      function updateSummaryText() {
        summary.textContent = fold.open ? openedText : closedText;
      }

      updateSummaryText();
      fold.addEventListener("toggle", updateSummaryText);
    }
  }

  const processor = createProcessor();

  processor.registerBlock("youtube", function (content, attrs) {
  const videoId = extractYouTubeVideoId(content);
  if (!videoId) {
    return `<div class="shortcode-error">유효하지 않은 YouTube 링크입니다: ${escapeHtml(content)}</div>`;
  }

  const width = normalizeSize(attrs.width, "100%");
  const height = normalizeSize(attrs.height, null);
  const align = normalizeAlign(attrs.align);

  let margin = "1.2rem 0";
  if (align === "center") margin = "1.2rem auto";
  else if (align === "right") margin = "1.2rem 0 1.2rem auto";

  const wrapperStyle = {
    "width": width,
    "margin": margin
  };

  if (height) {
    wrapperStyle["height"] = height;
  } else {
    wrapperStyle["aspect-ratio"] = "16 / 9";
  }

  return (
    `<div class="youtube-embed" style="${buildInlineStyle(wrapperStyle)}">` +
      `<iframe ` +
        `src="https://www.youtube.com/embed/${videoId}" ` +
        `title="YouTube video player" ` +
        `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ` +
        `allowfullscreen>` +
      `</iframe>` +
    `</div>`
  );
});

  function makeMessageBox(typeName, titleText) {
    return function (content, attrs, renderMarkdown, processAll) {
      const raw = processAll(content.trim(), renderMarkdown);
      const innerHtml = renderMarkdownSafely(raw, renderMarkdown);

      const customTitle = attrs.title ? escapeHtml(attrs.title) : titleText;

      return (
        `<div class="sc-message sc-message-${typeName}">` +
          `<div class="sc-message-title">${customTitle}</div>` +
          `<div class="sc-message-body">${innerHtml}</div>` +
        `</div>`
      );
    };
  }

  processor.registerBlock("note", makeMessageBox("note", "Note"));
  processor.registerBlock("tip", makeMessageBox("tip", "Tip"));
  processor.registerBlock("warning", makeMessageBox("warning", "Warning"));
  processor.registerBlock("danger", makeMessageBox("danger", "Danger"));

  processor.registerBlock("fold", function (content, attrs, renderMarkdown, processAll) {
    const closedText = attrs.closed || attrs.title || "자세한 내용";
    const openedText = attrs.opened || "접기";

    const defaultOpen =
      normalizeBoolean(attrs.open, null) ??
      normalizeBoolean(attrs.defaultopen, null) ??
      normalizeBoolean(attrs.expanded, false);

    const openAttr = defaultOpen ? " open" : "";

    const raw = processAll(content.trim(), renderMarkdown);
    const innerHtml = renderMarkdownSafely(raw, renderMarkdown);

    return (
      `<details class="sc-fold"${openAttr} ` +
        `data-closed-text="${escapeHtmlAttr(closedText)}" ` +
        `data-opened-text="${escapeHtmlAttr(openedText)}">` +
        `<summary class="sc-fold-summary">${escapeHtml(defaultOpen ? openedText : closedText)}</summary>` +
        `<div class="sc-fold-body">${innerHtml}</div>` +
      `</details>`
    );
  });

  processor.registerInline("kbd", function (content) {
    return `<kbd class="sc-kbd">${escapeHtml(content.trim())}</kbd>`;
  });

  processor.registerInline("spoiler", function (content) {
    return `<span class="sc-spoiler">${escapeHtml(content.trim())}</span>`;
  });

  processor.registerBlock("linkcard", function (content, attrs) {
    const href = attrs.href ? attrs.href.trim() : "";
    const title = attrs.title ? attrs.title.trim() : content.trim() || href;
    const desc = attrs.desc ? attrs.desc.trim() : "";
    const target = attrs.target ? attrs.target.trim() : "_blank";

    if (!href) {
      return `<div class="shortcode-error">linkcard에 href가 없습니다.</div>`;
    }

    const safeHref = escapeHtmlAttr(href);
    const safeTitle = escapeHtml(title);
    const safeDesc = escapeHtml(desc);
    const safeTarget = escapeHtmlAttr(target);

    return (
      `<a class="sc-linkcard" href="${safeHref}" target="${safeTarget}" rel="noopener noreferrer">` +
        `<div class="sc-linkcard-title">${safeTitle}</div>` +
        (safeDesc ? `<div class="sc-linkcard-desc">${safeDesc}</div>` : "") +
        `<div class="sc-linkcard-url">${safeHref}</div>` +
      `</a>`
    );
  });

  global.MarkdownShortcodes = {
    render: processor.render,
    processAll: processor.processAll,
    registerBlock: processor.registerBlock,
    registerInline: processor.registerInline,
    parseAttributes,
    extractYouTubeVideoId,
    initFoldSummaries
  };
})(window);