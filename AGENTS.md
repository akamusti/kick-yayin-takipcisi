# AGENTS.md — Kick Yayın Bildirici (Firefox)

Bu depoda çalışan tüm AI ajanlarının uyması ZORUNLU kurallar.

---

## 1. Dil iletişim kuralları

- Kullanıcıyla **her zaman Türkçe** konuş. Açıklamalar, sorular, özetler — hepsi Türkçe.
- Commit mesajları ve GitHub'a yazılan her şey **İngilizce**.
- Kod yorumları, dosyada var olan stile uyar (bu projede Türkçe yorumlar kullanılıyor).

---

## 2. Proje hakkında (bağlam)

- Firefox MV3 tarayıcı eklentisi: Kick yayıncılarını takip eder, canlıya geçince bildirim gönderir.
- Chromium sürümü ayrı depoda: `akamusti/kick-takipci-chromium`
- Veri deposu: yalnızca `chrome.storage.local` — sunucu yok, veritabanı yok, analitik yok.
- Ağ: **yalnızca** `https://kick.com/api/v1/...` uçlarına istek. Başka hiçbir API'ye, CDN'e, üçüncü parti servise istek eklemek yasaktır.
- `manifest.json` sürüm numarasını (version) yalnızca kullanıcı isterse yükselt.

---

## 3. Her iş bittiğinde ZORUNLU güvenlik kontrolü

Kod işi biter bitmez, **commit'ten ÖNCE** şu kontrolü yap:

### 3.1. Tara
Değişen/eklenen tüm dosyalarda ve `git diff` çıktısında şunları ara:

| Aranan | Örnek desen |
|---|---|
| API anahtarı / token / secret / şifre | `(?i)(api[_-]?key\|token\|secret\|passwd\|password\|bearer\|authorization)\s*[:=]` |
| Cookie / oturum verisi | `(?i)(cookie\|session[_-]?id\|refresh[_-]?token)` |
| kişisel bilgi | gerçek e-posta adresi, telefon numarası, TC no, kredi kartı, ev adresi, `@gmail.com` tipi gerçek adres |
| Uzun rastgele string | 32+ karakterlik hex/base64 benzeri değer (`sk_live_...`, `AKIA...`, `ghp_...` gibi) |
| Sertifikalı / gizli URL | kimlik bilgisi içeren URL (`https://kullanici:sifre@...`), internal host |

### 3.2. Bulursan: `.env`'e taşı
- Değeri koddan **tamamen kaldır**. Koddaki yere placeholder yaz.
- Yeni bir `.env` dosyası oluştur (yoksa) ve değeri oraya yaz:
  ```env
  KICK_API_KEY=sk_live_xxxxxxxx
  ```
- `TOKENS_ADI` büyük harf, alt çizgiyle ayrılır (ör. `KICK_API_KEY`, `MY_SECRET`).
- `.env` **asla `git add` edilmez, asla commit'lenmez, asla pushlanmaz** (aşağıda nedeni var).
- README veya dokümantasyonda kullanılıyorsa yalnızca **`.env.example`** oluştur ve
  içine değer yerine placeholder yaz:
  ```env
  KICK_API_KEY=your_api_key_here
  ```

### 3.3. Push'tan önce son kontrol
- `git status` içinde `.env` görünüyor mu kontrol et — görünüyorsa durdur, düzelt.
- Mümkünse `git --no-pager diff --cached | grep -iE "token|secret|api.?key"` gibi hızlı bir tarama çalıştır.
- Kontrol sonucu temizse commit ve push'a geç. Temiz değilse kullanıcıya rapor ver, **kullanıcı onayı olmadan push yapma**.

**Neden `.env` pushlanmaz?** Git geçmişini silmez. Yanlışlıkla pushlarsan değer daha
sonra silinse bile repos geçmişinde kalır; GitHub'da botlar saniyeler içinde bu
anahtarları tarayıp çalar. Eğer yanlışlıkla pushlarsan:
  1. Anahtarı serviste derhal iptal et (rotate).
  2. Geçmişten tamamen silmek için `git filter-repo` veya GitHub Support gerekir.

Bu projede zaten **gizli anahtar yok** (yalnızca Kick public API kullanılıyor). Yine de
kurallar her yeni işte aynı işletilir.

---

## 4. Commit & Push kuralları

- Commit mesajı **İngilizce**, Conventional Commits biçiminde:
  ```
  feat: add channel pinning
  fix: badge count on startup
  chore: bump version to 1.6.0
  docs: add AGENTS.md
  ```
- Her anlamlı iş birimi kendi commit'i olur; alakasız değişiklikler tek commit'e karıştırılmaz.
- Commit + push sonrası `git log --oneline -1` ile doğrula.

## 5. Test (bir işi "bitmiş" saymadan önce)

1. Firefox → `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on...** → `manifest.json` seç
3. Popup'ı aç; kanal ekle/sil, bildirim saati ayarını dene
4. `console` hatalarını kontrol et (hem background hem popup)

## 6. Dosyalar

| Yol | Amaç |
|---|---|
| `manifest.json` | MV3 manifest — sürümü yalnızca istenirse yükselt |
| `background.js` | Alarm, kontrol, bildirim mantığı |
| `popup/` | Arayüz: `popup.js`, `popup.html`, `popup.css`, `i18n.js` (TR/EN), `themes.js`, `suggestions.js` |
| `icon/` | Eklenti ikonu |
| `.env` | Gizli değerler — **yok burada, olmayacak da**; gerekiirse yerel olarak oluştur, ignore et |
| `.env.example` | Değer yerine placeholder — commit edilebilir |
