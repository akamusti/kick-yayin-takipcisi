# Kick Live Stream Notifier (Firefox)

🇹🇷 Türkçe için: [README.tr.md](README.tr.md)

A lightweight Firefox extension to track your favorite Kick streamers. Add channels, see who is live at a glance, and get instant system notifications when a stream starts.

Get it on Firefox Add-ons:
https://addons.mozilla.org/en-US/firefox/addon/kick-live-stream-notifier/

## Features

* **Live badge:** Toolbar icon shows how many tracked streamers are live, no need to open the popup.
* **Instant notifications:** System notification with streamer avatar and stream title. Click it to open the stream.
* **Fast & parallel checks:** Checks all channels in parallel every minute via alarms.
* **Search, pin & sort:** Search your list, pin favorites to the top, live streams first.
* **Suggested channels:** Optional discover list you can add or dismiss with one click.
* **Notification hours:** Only get notified in a time window you choose (e.g. 10:00 to 23:00).
* **Backup:** Export / import your channel list as JSON.
* **TR / EN + 6 themes:** Turkish and English UI, 6 color themes saved automatically.
* **Lightweight & private:** No tracking, no third-party servers. Only talks to `kick.com` API. Data stays in `storage.local`.

## Install (.xpi file)

1. Download the latest **`.xpi`** from this repo or the **Releases** section.
2. Open Firefox.
3. Go to `about:addons` (or press `Ctrl + Shift + A`).
4. Click the **Gear (Settings)** icon in the top-right.
5. Select **Install Add-on From File...**
6. Pick the downloaded `.xpi` and confirm with **Add**.

## Developer setup (from source)

1. Clone the repo:
   ```bash
   git clone https://github.com/akamusti/kick-yayin-takipcisi.git
   ```
2. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...**
4. Select the `manifest.json` file in the project folder.

## Chromium version

https://github.com/akamusti/kick-takipci-chromium
