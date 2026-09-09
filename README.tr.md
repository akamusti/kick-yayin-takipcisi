# Kick Yayın Bildirici (Firefox)

🇬🇧 English: [README.md](README.md)

Favori Kick yayıncılarını takip etmek için hafif bir Firefox eklentisi. Kanalları ekle, kimin canlıda olduğunu tek bakışta gör, yayın başlayınca anında sistem bildirimi al.

Firefox Eklentiler sayfasından indir:
https://addons.mozilla.org/en-US/firefox/addon/kick-live-stream-notifier/

## Özellikler

* **Canlı rozeti:** Kaç yayıncının canlıda olduğunu araç çubuğu simgesinde gösterir, popup'ı açmana gerek yok.
* **Anlık bildirimler:** Yayıncı avatarı ve yayın başlığıyla sistem bildirimi. Tıkla, yayını aç.
* **Hızlı ve paralel kontrol:** Tüm kanalları her dakika paralel isteklerle kontrol eder.
* **Arama, sabitleme ve sıralama:** Listende ara, favorileri üste sabitle, canlılar en üstte.
* **Önerilen kanallar:** Tek tıkla ekleyip kapatabileceğin isteğe bağlı keşfet listesi.
* **Bildirim saat aralığı:** Sadece seçtiğin saatlerde bildirim al (örn. 10:00 ile 23:00 arası).
* **Yedekleme:** Kanal listeni JSON olarak dışa / içe aktar.
* **TR / EN + 6 tema:** Türkçe ve İngilizce arayüz, otomatik kaydedilen 6 renk teması.
* **Hafif ve gizlilik odaklı:** Takip yok, üçüncü taraf sunucu yok. Sadece `kick.com` API ile konuşur. Veriler `storage.local` içinde kalır.

## Geliştirici Kurulumu (Kaynak Koddan)

1. Depoyu klonla:
   ```bash
   git clone https://github.com/akamusti/kick-yayin-takipcisi.git
   ```
2. Firefox'ta `about:debugging#/runtime/this-firefox` adresine git.
3. **Geçici Eklenti Yükle...** butonuna tıkla.
4. Proje klasöründeki `manifest.json` dosyasını seç.

## Chromium Sürümü

https://github.com/akamusti/kick-takipci-chromium
