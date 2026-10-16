let channelResults = [];
let searchQuery = "";
let mutedChannelsCache = [];
let statusResetTimer = null;

// Kontrol sıklığı ve bildirim sesi seçenekleri (background.js ile aynı olmalı)
const INTERVAL_OPTIONS = [1, 2, 5, 10];
const DEFAULT_CHECK_INTERVAL = 1;
const SOUND_OPTIONS = ["system", "chime", "silent"];

const BELL_ICON = '<svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>';
const BELL_OFF_ICON = '<svg viewBox="0 0 24 24"><path d="M20 18.69L7.84 6.14 5.27 3.49 4 4.76l2.8 2.8v.01c-.52.99-.8 2.16-.8 3.42v5l-2 2v1h13.73l2 2L21 19.72l-1-1.03zM12 22c1.11 0 2-.89 2-2h-4c0 1.11.89 2 2 2zm6-7.32V11c0-3.08-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68c-.15.03-.29.08-.42.12-.1.03-.2.07-.3.11h-.01c-.01 0-.01 0-.02.01-.23.09-.46.2-.68.31 0 0-.01 0-.01.01L18 14.68z"/></svg>';

document.addEventListener("DOMContentLoaded", async () => {
  await restoreLang();
  await restoreTheme();

  const currentLang = await getSavedLang();
  setupTabs();
  setupLangButtons(currentLang);
  setupThemeGrid();
  setupSuggestionsToggle();
  setupNotificationsToggle();
  setupNotifyHours();
  setupNotificationTest();
  setupSearch();
  setupBackup();
  setupRefresh();
  await setupIntervalSelect();
  await setupSoundSelect();
  loadChannels();
  chrome.runtime.sendMessage({ action: "updateBadge" });

  const addChannelBtn = document.getElementById("add-channel-btn");
  const channelInput = document.getElementById("channel-input");

  if (addChannelBtn && channelInput) {
    addChannelBtn.addEventListener("click", async () => {
      const channelName = channelInput.value.trim().toLowerCase();
      if (channelName) {
        await addChannel(channelName);
        channelInput.value = "";
      }
    });

    channelInput.addEventListener("keypress", async (e) => {
      if (e.key === "Enter") {
        const channelName = channelInput.value.trim().toLowerCase();
        if (channelName) {
          await addChannel(channelName);
          channelInput.value = "";
        }
      }
    });
  }
});

function setupSearch() {
  const searchInput = document.getElementById("search-input");
  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value.trim().toLowerCase();
    applySearchFilter();
  });
}

function applySearchFilter() {
  const container = document.getElementById("channel-list");
  const noResults = document.getElementById("search-no-results");
  if (!container) return;

  const cards = container.querySelectorAll(".channel-card");
  let visibleCount = 0;

  cards.forEach((card) => {
    const nameEl = card.querySelector(".channel-name, .live-name");
    const name = nameEl ? nameEl.textContent.toLowerCase() : "";
    const match = !searchQuery || name.includes(searchQuery);
    card.style.display = match ? "" : "none";
    if (match) visibleCount++;
  });

  if (noResults) {
    const hasQuery = searchQuery.length > 0;
    const visible = visibleCount > 0;
    noResults.classList.toggle("hidden", !hasQuery || visible);
    if (hasQuery && !visible) {
      getSavedLang().then((lang) => {
        noResults.textContent = t("no_results", lang);
      });
    } else {
      noResults.textContent = "";
    }
  }
}

function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".panel").forEach((panel) => {
        panel.classList.toggle("active", panel.id === tab.dataset.panel);
      });
      // İstatistik sekmesine geçildiğinde güncel sayıları hazırla
      if (tab.dataset.panel === "panel-stats") {
        renderStats();
      }
    });
  });
}

function setupLangButtons(currentLang) {
  const buttons = document.querySelectorAll(".lang-btn");
  buttons.forEach((button) => {
    button.classList.toggle("selected", button.dataset.lang === currentLang);
    button.addEventListener("click", async () => {
      const lang = button.dataset.lang;
      await saveLang(lang);
      applyLang(lang);
      buttons.forEach((b) => b.classList.toggle("selected", b.dataset.lang === lang));
      await restoreTheme();
      setupThemeGrid();
      await refreshStaticTexts();
      loadChannels();
    });
  });
}

// Dil değiştiğinde dinamik oluşturulan metinleri yenile
async function refreshStaticTexts() {
  await setupIntervalSelect();
  await setupSoundSelect();
  await updateRefreshStatus();
  renderStats();
}

async function setupThemeGrid() {
  const grid = document.getElementById("theme-grid");
  if (!grid) return;

  const currentTheme = await getSavedTheme();
  const lang = await getSavedLang();
  grid.textContent = "";

  Object.entries(THEMES).forEach(([id, theme]) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "theme-option" + (id === currentTheme ? " selected" : "");

    const swatch = document.createElement("span");
    swatch.className = "theme-swatch";
    theme.swatch.forEach((color) => {
      const dot = document.createElement("span");
      dot.style.backgroundColor = color;
      swatch.appendChild(dot);
    });

    const nameSpan = document.createElement("span");
    nameSpan.className = "theme-name";
    nameSpan.textContent = t(theme.label, lang);

    const check = document.createElement("span");
    check.className = "theme-check";
    check.textContent = id === currentTheme ? "\u2713" : "";

    option.appendChild(swatch);
    option.appendChild(nameSpan);
    option.appendChild(check);

    option.addEventListener("click", async () => {
      applyTheme(id);
      await saveTheme(id);
      grid.querySelectorAll(".theme-option").forEach((el) => {
        el.classList.remove("selected");
        const c = el.querySelector(".theme-check");
        if (c) c.textContent = "";
      });
      option.classList.add("selected");
      check.textContent = "\u2713";
    });

    grid.appendChild(option);
  });
}

async function setupNotificationsToggle() {
  const toggle = document.getElementById("toggle-notifications");
  if (!toggle) return;

  const data = await chrome.storage.local.get(["notificationsEnabled"]);
  toggle.checked = data.notificationsEnabled !== false;

  toggle.addEventListener("change", async () => {
    await chrome.storage.local.set({ notificationsEnabled: toggle.checked });
  });
}

async function setupNotifyHours() {
  const startSelect = document.getElementById("notify-start-hour");
  const endSelect = document.getElementById("notify-end-hour");
  if (!startSelect || !endSelect) return;

  const populate = () => {
    for (let h = 0; h < 24; h++) {
      const opt = document.createElement("option");
      opt.value = String(h);
      opt.textContent = `${String(h).padStart(2, "0")}:00`;
      startSelect.appendChild(opt);
      endSelect.appendChild(opt.cloneNode(true));
    }
  };
  populate();

  const data = await chrome.storage.local.get(["notifyStartHour", "notifyEndHour"]);
  startSelect.value = String(typeof data.notifyStartHour === "number" ? data.notifyStartHour : 0);
  endSelect.value = String(typeof data.notifyEndHour === "number" ? data.notifyEndHour : 23);

  startSelect.addEventListener("change", async () => {
    await chrome.storage.local.set({ notifyStartHour: Number(startSelect.value) });
  });
  endSelect.addEventListener("change", async () => {
    await chrome.storage.local.set({ notifyEndHour: Number(endSelect.value) });
  });
}

function setupNotificationTest() {
  const btn = document.getElementById("test-notification-btn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    const lang = await getSavedLang();
    const sendingText = t("sending", lang);
    btn.textContent = sendingText;
    try {
      await chrome.runtime.sendMessage({ action: "testNotification" });
    } catch (e) {
      console.error("Test bildirimi istenemedi:", e);
    }
    const originalText = t("test_notification", lang);
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = originalText;
    }, 800);
  });
}

// ---- Manuel kontrol ("Şimdi Kontrol Et") ----
function setupRefresh() {
  const btn = document.getElementById("refresh-btn");
  const statsBtn = document.getElementById("stats-refresh-btn");
  if (btn) btn.addEventListener("click", () => manualRefresh(btn));
  if (statsBtn) statsBtn.addEventListener("click", () => manualRefresh(statsBtn));
  updateRefreshStatus();
}

async function manualRefresh(btn) {
  if (btn && btn.disabled) return;
  const lang = await getSavedLang();

  if (btn) {
    btn.disabled = true;
    btn.classList.add("spinning");
  }
  setRefreshStatus(t("refreshing", lang), "info");

  try {
    // Arka plandaki kontrolü bekle: rozet, bildirimler ve canlı durumları güncellenir
    const summary = await chrome.runtime.sendMessage({ action: "checkNow" });
    await loadChannels();

    if (summary && !summary.error) {
      if (summary.total > 0) {
        setRefreshStatus(
          t("refresh_done", lang)
            .replace("{live}", summary.live)
            .replace("{total}", summary.total),
          "success"
        );
      } else {
        setRefreshStatus(t("refresh_empty", lang), "info");
      }
    } else {
      setRefreshStatus(t("refresh_failed", lang), "error");
    }
  } catch (e) {
    console.error("Manuel kontrol başarısız:", e);
    setRefreshStatus(t("refresh_failed", lang), "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("spinning");
    }
    scheduleStatusReset();
  }
}

function setRefreshStatus(text, kind) {
  const el = document.getElementById("refresh-status");
  if (!el) return;
  el.textContent = text;
  el.classList.remove("success", "error");
  if (kind === "success") el.classList.add("success");
  if (kind === "error") el.classList.add("error");
}

function scheduleStatusReset() {
  if (statusResetTimer) clearTimeout(statusResetTimer);
  statusResetTimer = setTimeout(() => updateRefreshStatus(), 4000);
}

// Kalıcı durum satırı: "Son kontrol: 20:35 · her 1 dakika"
async function updateRefreshStatus() {
  const el = document.getElementById("refresh-status");
  if (!el) return;

  const lang = await getSavedLang();
  const data = await chrome.storage.local.get(["lastCheckTime", "checkIntervalMinutes"]);
  const interval = INTERVAL_OPTIONS.includes(Number(data.checkIntervalMinutes))
    ? Number(data.checkIntervalMinutes)
    : DEFAULT_CHECK_INTERVAL;

  let when = t("never", lang);
  if (typeof data.lastCheckTime === "number" && data.lastCheckTime > 0) {
    const d = new Date(data.lastCheckTime);
    const pad = (v) => String(v).padStart(2, "0");
    when = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  el.classList.remove("success", "error");
  el.textContent = `${t("last_check", lang)}: ${when} · ${t("interval_minutes", lang).replace("{n}", interval)}`;
}

// ---- Kontrol sıklığı ayarı ----
async function setupIntervalSelect() {
  const select = document.getElementById("interval-select");
  if (!select) return;

  const lang = await getSavedLang();
  const data = await chrome.storage.local.get(["checkIntervalMinutes"]);
  const current = INTERVAL_OPTIONS.includes(Number(data.checkIntervalMinutes))
    ? Number(data.checkIntervalMinutes)
    : DEFAULT_CHECK_INTERVAL;

  select.textContent = "";
  INTERVAL_OPTIONS.forEach((minutes) => {
    const opt = document.createElement("option");
    opt.value = String(minutes);
    opt.textContent = t("interval_minutes", lang).replace("{n}", minutes);
    if (minutes === current) opt.selected = true;
    select.appendChild(opt);
  });

  // onchange kullanılıyor: dil değişince fonksiyon tekrar çağrılsa da çoğalan dinleyici olmaz
  select.onchange = async () => {
    await chrome.storage.local.set({ checkIntervalMinutes: Number(select.value) });
    updateRefreshStatus();
    renderStats();
  };
}

// ---- Bildirim sesi ayarı ----
async function setupSoundSelect() {
  const select = document.getElementById("sound-select");
  if (!select) return;

  const lang = await getSavedLang();
  const data = await chrome.storage.local.get(["notificationSound"]);
  const current = SOUND_OPTIONS.includes(data.notificationSound) ? data.notificationSound : "system";
  const labels = { system: "sound_system", chime: "sound_chime", silent: "sound_silent" };

  select.textContent = "";
  SOUND_OPTIONS.forEach((value) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = t(labels[value], lang);
    if (value === current) opt.selected = true;
    select.appendChild(opt);
  });

  select.onchange = async () => {
    await chrome.storage.local.set({ notificationSound: select.value });
    // Zil sesi seçilirse kullanıcıya hemen örnek olarak çal
    if (select.value === "chime") {
      try {
        const preview = new Audio(chrome.runtime.getURL("sounds/notify.wav"));
        preview.volume = 0.85;
        await preview.play();
      } catch (e) {
        console.warn("Zil sesi önizlenemedi:", e);
      }
    }
  };
}

// ---- İstatistik paneli ----
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function statInfoRow(label, value) {
  const row = document.createElement("div");
  row.className = "stat-info-row";

  const labelSpan = document.createElement("span");
  labelSpan.textContent = label;

  const valueSpan = document.createElement("span");
  valueSpan.className = "stat-info-value";
  valueSpan.textContent = value;

  row.appendChild(labelSpan);
  row.appendChild(valueSpan);
  return row;
}

async function renderStats() {
  const grid = document.querySelector(".stats-grid");
  if (!grid) return;

  const lang = await getSavedLang();
  const data = await chrome.storage.local.get([
    "channels",
    "mutedChannels",
    "lastCheckTime",
    "lastApiErrorCount",
    "checkIntervalMinutes"
  ]);

  const channels = data.channels || [];
  const mutedTracked = (data.mutedChannels || []).filter((c) => channels.includes(c));
  const liveItems = channelResults.filter((r) => r.data && r.data.livestream !== null);
  const totalViewers = liveItems.reduce(
    (acc, r) => acc + (Number(r.data.livestream.viewer_count) || 0),
    0
  );
  const mutedLive = liveItems.filter((r) => mutedTracked.includes(r.name)).length;

  setText("stat-total", formatViewerCount(channels.length, lang));
  setText("stat-live", formatViewerCount(liveItems.length, lang));
  setText("stat-viewers", formatViewerCount(totalViewers, lang));
  setText("stat-muted", formatViewerCount(mutedTracked.length, lang));

  // En çok izlenen canlı yayın
  const topEl = document.getElementById("stat-top-stream");
  if (topEl) {
    topEl.textContent = "";
    const top = liveItems
      .slice()
      .sort(
        (a, b) =>
          (Number(b.data.livestream.viewer_count) || 0) - (Number(a.data.livestream.viewer_count) || 0)
      )[0];

    if (top) {
      const card = document.createElement("div");
      card.className = "channel-card";

      const left = document.createElement("div");
      left.className = "channel-left";

      const avatar = document.createElement("img");
      avatar.className = "avatar";
      avatar.src = top.data.user?.profile_pic || "../icon/icon.png";
      avatar.alt = "";
      // Yedek görsel de yüklenemezse döngüye girmemesi için tek deneme yapılır
      avatar.addEventListener("error", () => {
        if (!avatar.dataset.fallback) {
          avatar.dataset.fallback = "1";
          avatar.src = "../icon/icon.png";
        } else {
          avatar.remove();
        }
      });

      const details = document.createElement("div");
      details.className = "channel-details";

      const nameLink = document.createElement("a");
      nameLink.href = `https://kick.com/${top.name}`;
      nameLink.target = "_blank";
      nameLink.className = "channel-name";
      nameLink.textContent = top.data.user?.display_name || top.data.user?.username || top.name;

      const viewers = document.createElement("span");
      viewers.className = "status live";
      viewers.textContent = t("viewers_short", lang).replace(
        "{n}",
        formatViewerCount(top.data.livestream.viewer_count, lang)
      );

      details.appendChild(nameLink);
      details.appendChild(viewers);
      left.appendChild(avatar);
      left.appendChild(details);
      card.appendChild(left);
      topEl.appendChild(card);
    } else {
      const empty = document.createElement("div");
      empty.className = "empty-msg";
      empty.textContent = t("stat_none_live", lang);
      topEl.appendChild(empty);
    }
  }

  // Bilgi satırları
  const infoEl = document.getElementById("stat-info");
  if (infoEl) {
    infoEl.textContent = "";

    const interval = INTERVAL_OPTIONS.includes(Number(data.checkIntervalMinutes))
      ? Number(data.checkIntervalMinutes)
      : DEFAULT_CHECK_INTERVAL;

    let when = t("never", lang);
    if (typeof data.lastCheckTime === "number" && data.lastCheckTime > 0) {
      const d = new Date(data.lastCheckTime);
      const pad = (v) => String(v).padStart(2, "0");
      when = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    infoEl.appendChild(statInfoRow(t("stat_last_check", lang), when));
    infoEl.appendChild(
      statInfoRow(t("stat_interval", lang), t("interval_minutes", lang).replace("{n}", interval))
    );
    infoEl.appendChild(statInfoRow(t("stat_errors", lang), String(data.lastApiErrorCount || 0)));
    infoEl.appendChild(statInfoRow(t("stat_muted_live", lang), String(mutedLive)));
  }
}

// ---- Susturma (mute) ----
function applyMuteState(btn, card, isMuted, lang) {
  if (!btn) return;
  btn.classList.toggle("muted", isMuted);
  btn.innerHTML = isMuted ? BELL_OFF_ICON : BELL_ICON;
  btn.title = t(isMuted ? "unmute" : "mute", lang);
  if (card) card.classList.toggle("muted", isMuted);
}

async function loadChannels() {
  const container = document.getElementById("channel-list");
  if (!container) return;

  const data = await chrome.storage.local.get(["channels", "pinnedChannels", "mutedChannels"]);
  const channels = data.channels || [];
  const pinnedChannels = data.pinnedChannels || [];
  mutedChannelsCache = data.mutedChannels || [];
  const lang = await getSavedLang();

  container.textContent = "";

  if (channels.length === 0) {
    channelResults = [];
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "empty-msg";
    emptyDiv.textContent = t("empty", lang);
    container.appendChild(emptyDiv);
    applySearchFilter();
    renderSuggestions();
    updateRefreshStatus();
    renderStats();
    return;
  }

  const channelPromises = channels.map(async (channelName) => {
    try {
      const response = await fetch(`https://kick.com/api/v1/channels/${channelName}`, {
        cache: "no-store"
      });
      if (response.ok) {
        const result = await response.json();
        return { name: channelName, data: result, error: false };
      }
    } catch (e) {
      console.error(`${channelName} verisi alınamadı:`, e);
    }
    return { name: channelName, data: null, error: true };
  });

  const results = await Promise.all(channelPromises);

  results.sort((a, b) => {
    const aPinned = pinnedChannels.includes(a.name) ? 2 : 0;
    const bPinned = pinnedChannels.includes(b.name) ? 2 : 0;
    const aLive = a.data && a.data.livestream !== null ? 1 : 0;
    const bLive = b.data && b.data.livestream !== null ? 1 : 0;
    return (bPinned + bLive) - (aPinned + aLive);
  });

  channelResults = results;

  container.textContent = "";
  results.forEach((item) => {
    renderChannelCard(container, item);
  });

  applySearchFilter();
  renderSuggestions();
  updateRefreshStatus();
  renderStats();
}

async function setupSuggestionsToggle() {
  const toggle = document.getElementById("toggle-suggestions");
  if (!toggle) return;

  const prefs = await getSuggestionPrefs();
  toggle.checked = prefs.showSuggestions;

  toggle.addEventListener("change", async () => {
    await setShowSuggestions(toggle.checked);
    renderSuggestions();
  });
}

async function renderSuggestions() {
  const section = document.getElementById("suggested-section");
  const container = document.getElementById("suggested-list");
  if (!section || !container) return;

  const prefs = await getSuggestionPrefs();
  const data = await chrome.storage.local.get(["channels"]);
  const channels = data.channels || [];

  const visible = prefs.showSuggestions
    ? SUGGESTED_CHANNELS.filter(
        (name) => !channels.includes(name) && !prefs.dismissedSuggestions.includes(name)
      )
    : [];

  if (visible.length === 0) {
    section.classList.add("hidden");
    container.textContent = "";
    return;
  }

  section.classList.remove("hidden");

  const requests = visible.map(async (name) => {
    try {
      const response = await fetch(`https://kick.com/api/v1/channels/${name}`, {
        cache: "no-store"
      });
      if (response.ok) {
        const result = await response.json();
        return { name: name, data: result };
      }
    } catch (e) {
      console.error(`${name} önerisi alınamadı:`, e);
    }
    return { name: name, data: null };
  });

  const results = await Promise.all(requests);

  container.textContent = "";
  results.forEach((item) => {
    renderSuggestionCard(container, item);
  });
}

function renderSuggestionCard(container, item) {
  const isLive = item.data && item.data.livestream !== null;
  const viewers = isLive ? item.data.livestream.viewer_count : 0;
  const avatarUrl = item.data?.user?.profile_pic || "../icon/icon.png";

  const card = document.createElement("div");
  card.className = "channel-card";

  const leftDiv = document.createElement("div");
  leftDiv.className = "channel-left";

  const avatarImg = document.createElement("img");
  avatarImg.className = "avatar";
  avatarImg.src = avatarUrl;
  avatarImg.alt = item.name;

  const detailsDiv = document.createElement("div");
  detailsDiv.className = "channel-details";

  const channelLink = document.createElement("a");
  channelLink.href = `https://kick.com/${item.name}`;
  channelLink.target = "_blank";
  channelLink.className = "channel-name";
  channelLink.title = `kick.com/${item.name}`;
  channelLink.textContent = item.name;

  const statusSpan = document.createElement("span");
  statusSpan.className = `status ${isLive ? "live" : "offline"}`;

  getSavedLang().then((lang) => {
    statusSpan.textContent = item.data
      ? isLive
        ? t("live_with_viewers", lang).replace("{viewers}", viewers)
        : t("offline", lang)
      : t("error", lang);
  });

  detailsDiv.appendChild(channelLink);
  detailsDiv.appendChild(statusSpan);
  leftDiv.appendChild(avatarImg);
  leftDiv.appendChild(detailsDiv);

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "suggest-actions";

  const addBtn = document.createElement("button");
  addBtn.className = "suggest-add-btn";
  getSavedLang().then((lang) => {
    addBtn.textContent = t("add_suggest", lang);
  });
  addBtn.addEventListener("click", async () => {
    addBtn.disabled = true;
    await addChannel(item.name);
    renderSuggestions();
  });

  const dismissBtn = document.createElement("button");
  dismissBtn.className = "suggest-dismiss";
  dismissBtn.textContent = "\u00d7";
  getSavedLang().then((lang) => {
    dismissBtn.title = t("dismiss_suggest", lang);
  });
  dismissBtn.addEventListener("click", async () => {
    await dismissSuggestion(item.name);
    renderSuggestions();
  });

  actionsDiv.appendChild(addBtn);
  actionsDiv.appendChild(dismissBtn);

  card.appendChild(leftDiv);
  card.appendChild(actionsDiv);
  container.appendChild(card);
}

async function addChannel(channelName) {
  const data = await chrome.storage.local.get(["channels"]);
  let channels = data.channels || [];

  if (!channels.includes(channelName)) {
    channels.push(channelName);
    await chrome.storage.local.set({ channels: channels });
    await loadChannels();
    chrome.runtime.sendMessage({ action: "updateBadge" });
  }
}

async function removeChannel(channelName) {
  const data = await chrome.storage.local.get(["channels", "pinnedChannels", "mutedChannels"]);
  let channels = data.channels || [];
  let pinnedChannels = data.pinnedChannels || [];
  let mutedChannels = data.mutedChannels || [];

  channels = channels.filter((name) => name !== channelName);
  pinnedChannels = pinnedChannels.filter((name) => name !== channelName);
  mutedChannels = mutedChannels.filter((name) => name !== channelName);
  await chrome.storage.local.set({
    channels: channels,
    pinnedChannels: pinnedChannels,
    mutedChannels: mutedChannels
  });
  await loadChannels();
  chrome.runtime.sendMessage({ action: "updateBadge" });
}

function getStreamCategory(livestream) {
  const cats = livestream?.categories;
  if (Array.isArray(cats) && cats.length > 0 && cats[0]?.name) {
    return cats[0].name;
  }
  return "";
}

function getStreamThumb(livestream) {
  const thumb = livestream?.thumbnail;
  if (!thumb) return "";
  if (typeof thumb === "string") return thumb;
  return thumb.src || "";
}

function formatViewerCount(count, lang) {
  const n = Number(count) || 0;
  try {
    return n.toLocaleString(lang === "tr" ? "tr-TR" : "en-US");
  } catch (e) {
    return String(n);
  }
}

function formatLiveDuration(livestream) {
  const start = livestream?.start_time || livestream?.created_at || livestream?.startTime;
  if (!start) return "";
  const startMs = Date.parse(String(start).replace(" ", "T"));
  if (Number.isNaN(startMs)) return "";
  let diff = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  const h = Math.floor(diff / 3600);
  diff -= h * 3600;
  const m = Math.floor(diff / 60);
  const s = diff - m * 60;
  const pad = (v) => String(v).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function renderChannelCard(container, item) {
  const card = document.createElement("div");
  card.className = "channel-card";

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "channel-actions";

  const pinBtn = document.createElement("button");
  pinBtn.className = "pin-btn";
  pinBtn.type = "button";
  pinBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/></svg>';

  chrome.storage.local.get(["pinnedChannels"]).then((pData) => {
    const pinned = (pData.pinnedChannels || []).includes(item.name);
    pinBtn.classList.toggle("pinned", pinned);
    card.classList.toggle("pinned", pinned);
    getSavedLang().then((lang) => {
      pinBtn.title = t(pinned ? "unpin" : "pin", lang);
    });
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-btn";
  getSavedLang().then((lang) => {
    deleteBtn.textContent = t("delete", lang);
  });
  deleteBtn.addEventListener("click", () => removeChannel(item.name));

  // Susturma butonu: kanal canlıya geçse de bildirim göndermez (listede canlı görünür)
  const muteBtn = document.createElement("button");
  muteBtn.className = "mute-btn";
  muteBtn.type = "button";
  getSavedLang().then((lang) => {
    applyMuteState(muteBtn, card, mutedChannelsCache.includes(item.name), lang);
  });

  muteBtn.addEventListener("click", async () => {
    const mData = await chrome.storage.local.get(["mutedChannels"]);
    let mutedList = mData.mutedChannels || [];
    const isMuted = mutedList.includes(item.name);
    if (isMuted) {
      mutedList = mutedList.filter((n) => n !== item.name);
    } else {
      mutedList.push(item.name);
    }
    await chrome.storage.local.set({ mutedChannels: mutedList });
    mutedChannelsCache = mutedList;
    const lang = await getSavedLang();
    applyMuteState(muteBtn, card, !isMuted, lang);
    renderStats();
  });

  actionsDiv.appendChild(pinBtn);
  actionsDiv.appendChild(muteBtn);
  actionsDiv.appendChild(deleteBtn);

  pinBtn.addEventListener("click", async () => {
    const pData = await chrome.storage.local.get(["pinnedChannels"]);
    let pinnedList = pData.pinnedChannels || [];
    const isPinned = pinnedList.includes(item.name);
    if (isPinned) {
      pinnedList = pinnedList.filter((n) => n !== item.name);
    } else {
      pinnedList.push(item.name);
    }
    await chrome.storage.local.set({ pinnedChannels: pinnedList });
    pinBtn.classList.toggle("pinned", !isPinned);
    card.classList.toggle("pinned", !isPinned);
    getSavedLang().then((lang) => {
      pinBtn.title = t(isPinned ? "pin" : "unpin", lang);
    });
    await loadChannels();
  });

  if (item.error || !item.data) {
    const topDiv = document.createElement("div");
    topDiv.className = "channel-top";

    const infoDiv = document.createElement("div");
    infoDiv.className = "channel-info";

    const nameSpan = document.createElement("span");
    nameSpan.className = "channel-name";
    nameSpan.textContent = item.name;

    const statusSpan = document.createElement("span");
    statusSpan.className = "status offline";
    getSavedLang().then((lang) => {
      statusSpan.textContent = t("error_offline", lang);
    });

    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(statusSpan);

    topDiv.appendChild(infoDiv);
    topDiv.appendChild(actionsDiv);

    card.appendChild(topDiv);
  } else {
    const isLive = item.data.livestream !== null;
    const viewers = isLive ? item.data.livestream.viewer_count : 0;

    if (isLive) {
      // Canlı kart: tek blok (referans görseldeki düzen, tekrar yok)
      card.classList.add("is-live");
      const displayName = item.data.user?.display_name || item.data.user?.username || item.name;
      const category = getStreamCategory(item.data.livestream);
      const thumbUrl = getStreamThumb(item.data.livestream);
      const duration = formatLiveDuration(item.data.livestream);

      const liveRow = document.createElement("div");
      liveRow.className = "live-row";

      if (thumbUrl) {
        const thumbWrap = document.createElement("a");
        thumbWrap.href = `https://kick.com/${item.name}`;
        thumbWrap.target = "_blank";
        thumbWrap.className = "live-thumb-wrap";

        const thumbImg = document.createElement("img");
        thumbImg.className = "live-thumb";
        thumbImg.src = thumbUrl;
        thumbImg.alt = "";
        thumbImg.loading = "lazy";
        thumbImg.addEventListener("error", () => {
          thumbWrap.remove();
        });
        thumbWrap.appendChild(thumbImg);

        if (duration) {
          const durBadge = document.createElement("span");
          durBadge.className = "live-duration";
          durBadge.textContent = duration;
          thumbWrap.appendChild(durBadge);
        }
        liveRow.appendChild(thumbWrap);
      }

      const liveMain = document.createElement("div");
      liveMain.className = "live-main";

      const liveTop = document.createElement("div");
      liveTop.className = "live-top";

      const avatarImg = document.createElement("img");
      avatarImg.className = "live-avatar";
      avatarImg.src = item.data.user?.profile_pic || "../icon/icon.png";
      avatarImg.alt = "";
      avatarImg.loading = "lazy";
      avatarImg.addEventListener("error", () => {
        if (!avatarImg.dataset.fallback) {
          avatarImg.dataset.fallback = "1";
          avatarImg.src = "../icon/icon.png";
        } else {
          avatarImg.remove();
        }
      });

      const nameLink = document.createElement("a");
      nameLink.href = `https://kick.com/${item.name}`;
      nameLink.target = "_blank";
      nameLink.className = "live-name";
      nameLink.textContent = displayName;

      const viewersSpan = document.createElement("span");
      viewersSpan.className = "live-viewers";
      getSavedLang().then((lang) => {
        viewersSpan.textContent = `\u{1F465} ${formatViewerCount(viewers, lang)}`;
      });

      liveTop.appendChild(avatarImg);
      liveTop.appendChild(nameLink);
      liveTop.appendChild(viewersSpan);
      liveMain.appendChild(liveTop);

      const titleSpan = document.createElement("span");
      titleSpan.className = "live-title";
      titleSpan.textContent = item.data.livestream?.session_title || item.name;
      titleSpan.title = titleSpan.textContent;
      liveMain.appendChild(titleSpan);

      if (category) {
        const catSpan = document.createElement("span");
        catSpan.className = "live-category";
        catSpan.textContent = category;
        catSpan.title = category;
        liveMain.appendChild(catSpan);
      }

      liveRow.appendChild(liveMain);
      card.appendChild(liveRow);

      const liveFoot = document.createElement("div");
      liveFoot.className = "live-foot";

      const statusSpan = document.createElement("span");
      statusSpan.className = "status live";
      getSavedLang().then((lang) => {
        statusSpan.textContent = `\u25CF ${t("live", lang)}`;
      });

      liveFoot.appendChild(statusSpan);
      liveFoot.appendChild(actionsDiv);
      card.appendChild(liveFoot);
    } else {
      const avatarUrl = item.data.user?.profile_pic || "../icon/icon.png";

      const topDiv = document.createElement("div");
      topDiv.className = "channel-top";

      const leftDiv = document.createElement("div");
      leftDiv.className = "channel-left";

      const avatarImg = document.createElement("img");
      avatarImg.className = "avatar";
      avatarImg.src = avatarUrl;
      avatarImg.alt = item.name;

      const detailsDiv = document.createElement("div");
      detailsDiv.className = "channel-details";

      const channelLink = document.createElement("a");
      channelLink.href = `https://kick.com/${item.name}`;
      channelLink.target = "_blank";
      channelLink.className = "channel-name";
      channelLink.textContent = item.name;

      const statusSpan = document.createElement("span");
      statusSpan.className = "status offline";
      getSavedLang().then((lang) => {
        statusSpan.textContent = t("offline", lang);
      });

      detailsDiv.appendChild(channelLink);
      detailsDiv.appendChild(statusSpan);

      leftDiv.appendChild(avatarImg);
      leftDiv.appendChild(detailsDiv);

      topDiv.appendChild(leftDiv);
      topDiv.appendChild(actionsDiv);

      card.appendChild(topDiv);
    }
  }

  // Kartın boş bir yerine tıklanınca da yayın açılsın (buton/link tıklamaları hariç)
  card.classList.add("clickable");
  card.addEventListener("click", (e) => {
    if (e.target.closest("a, button")) return;
    chrome.tabs.create({ url: `https://kick.com/${item.name}` });
  });

  container.appendChild(card);
}

function setupBackup() {
  const exportBtn = document.getElementById("export-btn");
  const importBtn = document.getElementById("import-btn");
  const importFile = document.getElementById("import-file");
  const messageEl = document.getElementById("backup-message");
  if (!exportBtn || !importBtn || !importFile || !messageEl) return;

  const showMessage = (text, isError) => {
    messageEl.textContent = text;
    messageEl.classList.remove("hidden", "success", "error");
    messageEl.classList.add(isError ? "error" : "success");
    setTimeout(() => messageEl.classList.add("hidden"), 3000);
  };

  exportBtn.addEventListener("click", async () => {
    try {
      const data = await chrome.storage.local.get(["channels"]);
      const channels = data.channels || [];
      const blob = new Blob([JSON.stringify(channels, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kick-kanallar-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const lang = await getSavedLang();
      showMessage(t("export_success", lang), false);
    } catch (e) {
      console.error("Dışa aktarma hatası:", e);
      const lang = await getSavedLang();
      showMessage(t("export_error", lang), true);
    }
  });

  importBtn.addEventListener("click", () => {
    importFile.click();
  });

  importFile.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    const lang = await getSavedLang();
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("invalid");
      const channels = parsed
        .filter((c) => typeof c === "string")
        .map((c) => c.trim().toLowerCase().replace(/^@/, ""))
        .filter((c) => c.length > 0);
      const deduped = [...new Set(channels)];
      const extraData = await chrome.storage.local.get(["pinnedChannels", "mutedChannels"]);
      const keptPins = (extraData.pinnedChannels || []).filter((p) => deduped.includes(p));
      const keptMutes = (extraData.mutedChannels || []).filter((m) => deduped.includes(m));
      await chrome.storage.local.set({
        channels: deduped,
        pinnedChannels: keptPins,
        mutedChannels: keptMutes
      });
      showMessage(t("import_success", lang), false);
      await loadChannels();
      chrome.runtime.sendMessage({ action: "updateBadge" });
    } catch (err) {
      console.error("İçe aktarma hatası:", err);
      showMessage(t("import_error", lang), true);
    } finally {
      importFile.value = "";
    }
  });
}
