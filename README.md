# 🎬 Family Cinema - Private Movie Streaming Server

A private, self-hosted movie streaming server built for streaming personal movies from your home laptop/desktop (Windows, macOS, Linux) to family members anywhere over the internet.

Specially engineered with an **elder-friendly UI** for non-tech-savvy family members (large touch targets, high contrast, simplified playback, subtitle font sizing, and "Continue Watching" resume).

---

## ✨ Features

- **Elder-Friendly Web UI**: Large buttons (10s rewind, play/pause, 10s skip), clean movie cards, subtitle font size switcher (Regular / Large / Extra Large), and mobile/tablet optimized layout.
- **Adaptive HLS Streaming (FFmpeg)**: Transcodes movies into 1080p, 720p, and 480p on-the-fly with disk-cached segments so playback never buffers on slow mobile internet.
- **Direct Play**: High-speed direct playback via HTTP 206 Partial Content range requests for MP4/WebM files.
- **Auto-Scanner & Thumbnail Generator**: Recursively scans your movies directory, extracts video duration, resolution, codecs, and generates thumbnails using FFmpeg.
- **Subtitle Support**: Auto-detects external companion subtitles (`.srt` / `.vtt`) and converts SRT to WebVTT dynamically. Also extracts embedded MKV/MP4 subtitle streams.
- **Resume Where You Left Off**: Tracks watch progress and prompts with a 1-click "Resume" button across devices.
- **Watch Together Mode**: Real-time synchronized playback (play, pause, seek) between two devices via WebSockets so you can watch movies together with Mom while talking on the phone.
- **Brute-Force Protected Auth**: Single shared family password, 30-day persistent session cookie, and rate-limiting.
- **CGNAT-Proof Networking**: Ready-to-go setup guides for **Tailscale** and **Cloudflare Tunnel**.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
Ensure **Node.js (v18+)** and **FFmpeg** are installed on your laptop:
- **Windows**: Download FFmpeg from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) or run `winget install Gyan.FFmpeg`.
- **macOS**: `brew install ffmpeg node`
- **Linux (Ubuntu/Debian)**: `sudo apt update && sudo apt install -y ffmpeg nodejs npm`

Verify in terminal:
```bash
ffmpeg -version
node -v
```

### 2. Installation
```bash
cd movie_stream
npm install
```

### 3. Generate Sample Movie (Optional)
If your movies folder is empty, generate a test video with audio and subtitles:
```bash
npm run generate-sample
```

### 4. Configure Settings
Open `.env` (or copy `.env.example` to `.env`):
```ini
PORT=3000
HOST=0.0.0.0
STREAM_PASSWORD=mom123
MOVIES_DIR=./movies
CACHE_DIR=./cache
FFMPEG_THREADS=0
HLS_SEGMENT_DURATION=4
```
> **Tip**: You can point `MOVIES_DIR` to any folder on your laptop, e.g. `D:/MyMovies` or `/home/user/Videos`.

### 5. Start the Server
```bash
npm start
```
Open **`http://localhost:3000`** in your browser. Enter password `mom123`.

---

## 🌐 Remote Access & CGNAT Bypass

Most home internet service providers (ISPs) use **CGNAT** (Carrier-Grade NAT), meaning your laptop does not have a public IPv4 address and standard port forwarding will not work.

Here are the two best solutions to let Mom connect from anywhere in the world:

---

### Option A: Tailscale (Recommended for Family Privacy)
Tailscale creates an encrypted, zero-configuration peer-to-peer mesh VPN (using WireGuard) between your laptop and Mom's device. No open ports, no public internet exposure.

#### On Your Laptop (Host):
1. Create a free account at [tailscale.com](https://tailscale.com).
2. Install Tailscale on your laptop and log in.
3. Note your laptop's Tailscale IP address (e.g., `100.x.y.z`).
4. Ensure `HOST=0.0.0.0` in your `.env` so the app listens on the Tailscale interface.

#### On Mom's Phone / Tablet / TV:
1. Install the Tailscale app (available on iOS App Store, Android Google Play, Android TV, Fire TV, iPad).
2. Log in using the same Tailscale account (or invite Mom to your Tailscale tailnet).
3. Open Safari or Chrome on Mom's device and go to:
   ```
   http://100.x.y.z:3000
   ```
4. Enter the shared password `mom123` and save the website as a bookmark or "Add to Home Screen" like an app!

---

### Option B: Cloudflare Tunnel (Best for 1-Click Browser Link)
If you don't want Mom to install any VPN app and just want her to open a standard link (e.g., `https://mom-movies.yourdomain.com` or a free temporary trycloudflare link):

#### Quick Free Tunnel (No Domain Required):
1. Download `cloudflared`:
   - **Windows**: `winget install Cloudflare.cloudflared`
   - **macOS**: `brew install cloudflare/cloudflare/cloudflared`
   - **Linux**: `sudo apt install cloudflared`
2. Run the quick tunnel command:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
3. Cloudflare will print a secure HTTPS URL:
   ```
   https://random-words.trycloudflare.com
   ```
4. Send that link to Mom. She opens it in her browser, enters the password, and starts watching immediately over HTTPS!

#### Permanent Named Tunnel (With your own domain):
1. In Cloudflare Dashboard, go to **Zero Trust** > **Networks** > **Tunnels**.
2. Click **Add a tunnel** > **Cloudflared**.
3. Run the connector command on your laptop.
4. Route public hostname `movies.yourdomain.com` to Service `HTTP://localhost:3000`.

---

## ⚡ Reliability & Keeping the Laptop Alive

To ensure streaming is not interrupted:

### 1. Prevent Windows Laptop Sleep
When you close the laptop lid or leave it unattended, Windows will normally enter Sleep mode, stopping playback.

1. **Keep-Awake Script (Included)**:
   Open PowerShell and run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/keep_awake.ps1
   ```
   This tells the Windows kernel to disable system sleep while allowing the display to turn off cleanly.

2. **Windows Lid Close Setting**:
   - Press `Win + R`, type `powercfg.cpl`, press Enter.
   - Click **"Choose what closing the lid does"** on the left.
   - Under **When I close the lid (Plugged in)**, select **"Do nothing"**.

3. **macOS**:
   Run in Terminal:
   ```bash
   caffeinate -dimsu npm start
   ```

4. **Linux**:
   ```bash
   systemd-inhibit --what=sleep npm start
   ```

---

### 2. Run Automatically on Startup

#### Using PM2 (Cross-Platform - Windows / Mac / Linux):
```bash
npm install -g pm2
pm2 start src/server.js --name "family-cinema"
pm2 save
pm2 startup
```

#### Windows Task Scheduler (Native):
1. Press `Win + R`, type `taskschd.msc`, press Enter.
2. Click **Create Basic Task...** > Name: `Family Cinema`.
3. Trigger: **When the computer starts**.
4. Action: **Start a program**.
   - Program: `node.exe` (or `npm.cmd`)
   - Arguments: `src/server.js`
   - Start in: `C:\Users\rajar\Desktop\coding\movie_stream`
5. Under Conditions, uncheck **"Stop if the computer switches to battery power"**.

---

## 📶 Upload Bandwidth Checking & Optimization

Streaming over the internet depends entirely on your home **Upload Bandwidth**:

| Resolution | Recommended Upload Speed per Stream | FFmpeg Transcode Bitrate |
| :--- | :--- | :--- |
| **1080p Full HD** | **6+ Mbps** | 2.8 Mbps video + 192k audio |
| **720p HD** | **3+ Mbps** | 1.4 Mbps video + 128k audio |
| **480p Data Saver** | **1.5+ Mbps** | 700k video + 96k audio |
| **Direct Play** | Depends on original movie (typically 10-25 Mbps) | Uncompressed / direct |

### How to Check Your Laptop's Upload Speed:
1. On your laptop, visit [speedtest.net](https://www.speedtest.net) or [fast.com](https://fast.com).
2. Note the **Upload** result (not Download).
3. If your upload speed is below 5 Mbps, instruct Mom to select **"480p (Data Saver)"** in the video player gear icon.

---

## 👥 Watch Together Mode

1. Both you and Mom log in to the cinema.
2. Click **"Watch Together"** in the top navigation bar.
3. Keep the default room name `family`, or pick a custom room name.
4. Set your name to "Rajar" and have Mom set her name to "Mom".
5. When anyone clicks Play, Pause, or seeks the timeline, both devices update in real-time with zero drift!

---

## 🛠️ Troubleshooting

| Issue | Solution |
| :--- | :--- |
| **"Could not log in / Rate limit exceeded"** | The server rate limits after 5 failed password attempts. Wait 15 minutes or restart the server process. |
| **Video plays but stutters on Mom's phone** | Click the **⚙️ Quality** gear icon on the video player and choose **720p** or **480p (Data Saver)**. |
| **Audio works but video is black on iPhone** | iOS Safari uses HLS natively. The server provides adaptive HLS; ensure you select Auto or 720p rather than Direct Play if the original codec is incompatible. |
| **New movies added to folder aren't appearing** | Click the **🔄 Rescan** button in the header or call `POST /api/movies/scan`. |
| **Server stops when laptop lid is closed** | Follow the Windows Power Options guide above: set "When I close the lid (Plugged in)" to **"Do nothing"** and run `scripts/keep_awake.ps1`. |
| **Logs and debugging** | Inspect logs anytime in `./logs/app.log` and `./logs/error.log`. |

---

## 📜 License
MIT License. Created for private family streaming.
