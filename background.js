// Eklenti yüklendiğinde veya tarayıcı başladığında alarmları kur ve ilk kontrolü yap
const I18N = {
  tr: {
    test_title: "Test bildirimi",
    test_message: "Bildirimler çalışıyor. Takip ettiğin bir yayıncı canlı yayına geçtiğinde böyle bir bildirim alacaksın.",
    test_live_title: "canlı yayına geçti!",
    test_channel_title: "için test bildirimi",
    now_live: "Kick'te şu anda yayında!",
    live_title: "canlı yayına geçti!"
  },
  en: {
    test_title: "Test notification",
    test_message: "Notifications are working. You will receive a notification like this when a streamer you follow goes live.",
    test_live_title: "went live!",
    test_channel_title: "test notification for",
    now_live: "is live on Kick right now!",
    live_title: "went live!"
  }
};

chrome.runtime.onInstalled.addListener(() => {
  setupAlarm();
  restoreAlarmGuarantee();
  checkStreamsAndSetBadge();
});

chrome.runtime.onStartup.addListener(() => {
  setupAlarm();
  restoreAlarmGuarantee();
  checkStreamsAndSetBadge();
});

// Kontrol sıklığı seçenekleri (dakika)
const ALLOWED_INTERVALS = [1, 2, 5, 10];
const DEFAULT_INTERVAL_MINUTES = 1;

// Kaydedilmiş kontrol sıklığını okur; geçersizse varsayılana döner
async function getCheckInterval() {
  try {
    const data = await chrome.storage.local.get(["checkIntervalMinutes"]);
    const value = Number(data.checkIntervalMinutes);
    return ALLOWED_INTERVALS.includes(value) ? value : DEFAULT_INTERVAL_MINUTES;
  } catch (e) {
    console.error("Kontrol sıklığı okunamadı:", e);
    return DEFAULT_INTERVAL_MINUTES;
  }
}

// Alarm durumunu callback tabanlı okur (tüm tarayıcı sürümlerinde güvenli)
function getAlarm(name) {
  return new Promise((resolve) => {
    try {
      chrome.alarms.get(name, (alarm) => resolve(alarm || null));
    } catch (e) {
      resolve(null);
    }
  });
}

// Service worker her uyandığında alarmın hala kurulu ve doğru sıklıkta olduğundan emin ol
async function restoreAlarmGuarantee() {
  try {
    const alarm = await getAlarm("checkLiveStreams");
    const period = await getCheckInterval();
    if (!alarm || alarm.periodInMinutes !== period) {
      await setupAlarm();
    }
  } catch (e) {
    console.error("Alarm garantisi kurulamadı:", e);
    await setupAlarm();
  }
}

// Periyodik kontrol alarmını seçilen sıklıkta oluştur
async function setupAlarm() {
  const period = await getCheckInterval();
  try {
    await chrome.alarms.clear("checkLiveStreams");
  } catch (e) {
    console.warn("Eski alarm temizlenemedi:", e);
  }
  chrome.alarms.create("checkLiveStreams", { periodInMinutes: period });
}

// Ayarlardan kontrol sıklığı değiştirilirse alarmı hemen güncelle
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.checkIntervalMinutes) {
    setupAlarm();
  }
});

// Alarm tetiklendiğinde otomatik çalış
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkLiveStreams") {
    checkStreamsAndSetBadge();
  }
});

// Pop-up açıldığında veya kanal eklendiğinde/silindiğinde gelen mesajları dinle
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateBadge") {
    checkStreamsAndSetBadge();
  }
  if (request.action === "testNotification") {
    sendTestNotification();
  }
  // "Şimdi Kontrol Et": kontrolü bekler ve özeti popup'a döndürür
  if (request.action === "checkNow") {
    checkStreamsAndSetBadge()
      .then((summary) => sendResponse(summary || {}))
      .catch((e) => {
        console.error("Manuel kontrol hatası:", e);
        sendResponse({ error: true });
      });
    return true; // asenkron yanıt için kanalı açık tut
  }
});

// Bildirime tıklanınca yayını yeni sekmede aç ve bildirimi kaldır
chrome.notifications.onClicked.addListener((notificationId) => {
  if (!notificationId.startsWith("kick-live-")) return;
  const channel = notificationId.slice("kick-live-".length).replace(/-\d+$/, "");
  chrome.notifications.clear(notificationId);
  if (channel) {
    chrome.tabs.create({ url: `https://kick.com/${channel}` });
  }
});

// Saat, bildirim penceresi içinde mi (gece yarısı geçişini destekler, örn. 22-6)
function isInHourWindow(hour, startHour, endHour) {
  if (startHour === endHour) return true; // kısıt yok
  if (startHour < endHour) {
    return hour >= startHour && hour <= endHour;
  }
  return hour >= startHour || hour <= endHour;
}

// Rozet (badge) API'leri Firefox for Android'de desteklenmediği için
// güvenli çağrı için yardımcı fonksiyonlar
function setLiveBadge(text) {
  if (!chrome.action?.setBadgeText) return;
  chrome.action.setBadgeText({ text });
}

function setLiveBadgeColor(color) {
  if (!chrome.action?.setBadgeBackgroundColor) return;
  chrome.action.setBadgeBackgroundColor({ color });
}

function setLiveBadgeTextColor(color) {
  if (!chrome.action?.setBadgeTextColor) return;
  chrome.action.setBadgeTextColor({ color });
}

// Yayın durumlarını paralel (hızlı) sorgulayan, rozeti güncelleyen ve bildirim gönderen ana fonksiyon
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 15000;

// Kick API için yeniden denemeli fetch sarmalayıcı
async function fetchWithRetry(url, attempt = 1) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (e) {
    if (attempt < MAX_RETRIES) {
      console.warn(`${url} isteği başarısız (deneme ${attempt}/${MAX_RETRIES}), tekrar deneniyor:`, e);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      return fetchWithRetry(url, attempt + 1);
    }
    throw e;
  }
}

async function checkStreamsAndSetBadge() {
  const checkedAt = Date.now();
  try {
    const data = await chrome.storage.local.get(["channels", "liveStates", "notificationsEnabled", "notifyStartHour", "notifyEndHour", "mutedChannels"]);
    const channels = data.channels || [];
    const liveStates = data.liveStates || {};
    const mutedChannels = data.mutedChannels || [];
    const notificationsEnabled = data.notificationsEnabled !== false;
    const notifyStartHour = typeof data.notifyStartHour === "number" ? data.notifyStartHour : 0;
    const notifyEndHour = typeof data.notifyEndHour === "number" ? data.notifyEndHour : 23;

    const nowHour = new Date().getHours();
    const inNotifyWindow = isInHourWindow(nowHour, notifyStartHour, notifyEndHour);

    if (channels.length === 0) {
      setLiveBadge("");
      await chrome.storage.local.set({ lastCheckTime: checkedAt, lastApiErrorCount: 0 });
      return { total: 0, live: 0, errors: 0, muted: 0, lastCheckTime: checkedAt };
    }

    // İstekleri tek tek beklemek yerine Promise.all ile paralel atıyoruz (Hız artışı sağlar)
    const requests = channels.map(async (channel, index) => {
      // Paralel istek patlaması Cloudflare'e takılmasın diye kademeli başlat
      if (index > 0) {
        await new Promise((r) => setTimeout(r, index * 300));
      }
      try {
        const response = await fetchWithRetry(`https://kick.com/api/v1/channels/${channel}`);
        if (response.ok) {
          const result = await response.json();
          return { channel, ok: true, isLive: result.livestream !== null, result };
        }
        console.warn(`${channel} API yanıtı alınamadı: HTTP ${response.status}`);
      } catch (e) {
        console.error(`${channel} kontrol edilemedi:`, e?.name || typeof e, e?.message || e);
      }
      return { channel, ok: false, isLive: null, result: null };
    });

    const results = await Promise.all(requests);

    const failureCount = results.filter((r) => !r.ok).length;
    const update = { lastCheckTime: checkedAt, lastApiErrorCount: failureCount };
    if (failureCount > 0) {
      update.lastApiErrorTimestamp = checkedAt;
    }
    await chrome.storage.local.set(update);

    const newLiveStates = {};
    for (const item of results) {
      // Sorgu başarısızsa eski durumu koru (yanlış bildirim engellenir)
      if (!item.ok) {
        newLiveStates[item.channel] = item.channel in liveStates ? liveStates[item.channel] : false;
        continue;
      }

      newLiveStates[item.channel] = item.isLive;

      // Susturulmuş kanallar listede canlı görünür ama bildirim göndermez.
      // Durum yine güncellenir; böylece susturma kaldırıldığında eski bildirim patlamaz.
      const isMuted = mutedChannels.includes(item.channel);

      // Durumlar kapalıyken de güncellenir ki anahtar tekrar açıldığında
      // birikmiş yanlış bildirimler patlamasın
      if (item.isLive && liveStates[item.channel] === false && notificationsEnabled && inNotifyWindow && !isMuted) {
        await notifyChannelLive(item.channel, item.result);
      }
    }

    await chrome.storage.local.set({ liveStates: newLiveStates });

    const liveCount = results.reduce((acc, curr) => acc + (curr.isLive === true ? 1 : 0), 0);

    // Rozet metnini ve stilini güncelle
    if (liveCount > 0) {
      setLiveBadge(liveCount.toString());
      setLiveBadgeColor("#53FC18");
      setLiveBadgeTextColor("#000000");
    } else {
      setLiveBadge("");
    }

    const mutedLive = results.filter((r) => r.isLive === true && mutedChannels.includes(r.channel)).length;

    return {
      total: channels.length,
      live: liveCount,
      errors: failureCount,
      muted: mutedChannels.filter((c) => channels.includes(c)).length,
      mutedLive: mutedLive,
      lastCheckTime: checkedAt
    };
  } catch (error) {
    console.error("Rozet güncelleme hatası:", error);
    return { error: true, lastCheckTime: checkedAt };
  }
}

// Profil fotoğrafını indirip bildirimde kullanılabilir data URL'e çevirir
// (Service worker ortamına da uygun: FileReader yoksa btoa ile base64 üretilir)
async function getAvatarDataUrl(url) {
  if (!url) return null;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const blob = await response.blob();

    if (typeof FileReader !== "undefined") {
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    }

    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
  } catch (e) {
    console.error("Avatar alınamadı:", e);
    return null;
  }
}

// Bildirim sesi tercihleri: "system" (tarayıcı varsayılanı), "chime" (eklenti zili), "silent" (sessiz)
const SOUND_OPTIONS = ["system", "chime", "silent"];

async function getSoundPreference() {
  try {
    const data = await chrome.storage.local.get(["notificationSound"]);
    return SOUND_OPTIONS.includes(data.notificationSound) ? data.notificationSound : "system";
  } catch (e) {
    console.error("Bildirim sesi tercihi okunamadı:", e);
    return "system";
  }
}

// Eklentiye gömülü zil sesini çalar (yalnızca "chime" seçiliyken)
function playChime() {
  try {
    const audio = new Audio(chrome.runtime.getURL("sounds/notify.wav"));
    audio.volume = 0.85;
    const played = audio.play();
    if (played && typeof played.catch === "function") {
      played.catch((e) => console.warn("Zil sesi çalınamadı:", e?.message || e));
    }
  } catch (e) {
    console.warn("Zil sesi oluşturulamadı:", e);
  }
}

// Seçilen ses tercihine göre bildirim seçenekleri üretir
async function getSoundNotificationOptions() {
  const sound = await getSoundPreference();
  if (sound === "system") return {};
  // Sessiz modda ve zil sesinde sistem sesi kapatılır (zil sesi ayrıca çalınır)
  if (sound === "chime") playChime();
  return { silent: true };
}

// Ayarlar ekranındaki test butonu için örnek bildirim gösterir
async function sendTestNotification() {
  let iconUrl = "icon/icon.png";
  const lang = await chrome.storage.local.get(["lang"]).then((d) => d.lang || "tr");
  const i18n = I18N[lang] || I18N.tr;
  let title = i18n.test_title;
  let message = i18n.test_message;

  try {
    const data = await chrome.storage.local.get(["channels"]);
    const channels = data.channels || [];

    if (channels.length > 0) {
      const response = await fetchWithRetry(`https://kick.com/api/v1/channels/${channels[0]}`);
      if (response.ok) {
        const result = await response.json();
        const displayName = result.user?.display_name || result.user?.username || channels[0];
        const avatar = await getAvatarDataUrl(result.user?.profile_pic);
        if (avatar) {
          iconUrl = avatar;
        }
        title = result.livestream
          ? `${displayName} ${i18n.test_live_title}`
          : `${displayName} ${i18n.test_channel_title}`;
        message = result.livestream?.session_title || message;
      }
    }
  } catch (e) {
    console.error("Test verisi alınamadı:", e);
  }

  try {
    const soundOptions = await getSoundNotificationOptions();
    await chrome.notifications.create(`kick-test-${Date.now()}`, {
      type: "basic",
      iconUrl: iconUrl,
      title: title,
      message: message,
      ...soundOptions
    });
  } catch (e) {
    console.error("Test bildirimi gösterilemedi:", e);
  }
}

// Kanal canlı yayına geçtiğinde sistem bildirimi gösterir
async function notifyChannelLive(channel, result) {
  const lang = await chrome.storage.local.get(["lang"]).then((d) => d.lang || "tr");
  const i18n = I18N[lang] || I18N.tr;
  const displayName = result.user?.display_name || result.user?.username || channel;
  const streamTitle = result.livestream?.session_title || `${channel} ${i18n.now_live}`;

  let iconUrl = "icon/icon.png";
  const avatar = await getAvatarDataUrl(result.user?.profile_pic);
  if (avatar) {
    iconUrl = avatar;
  }

  try {
    const soundOptions = await getSoundNotificationOptions();
    await chrome.notifications.create(`kick-live-${channel}-${Date.now()}`, {
      type: "basic",
      iconUrl: iconUrl,
      title: `${displayName} ${i18n.live_title}`,
      message: streamTitle,
      ...soundOptions
    });
  } catch (e) {
    console.error("Bildirim gösterilemedi:", e);
  }
}
