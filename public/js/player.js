// Custom Mobile-Optimized Video Player for Mom's Cinema

class CinemaPlayer {
  constructor() {
    this.playerView = document.getElementById('playerView');
    this.video = document.getElementById('videoPlayer');
    this.overlay = document.getElementById('playerOverlay');
    this.titleEl = document.getElementById('playerMovieTitle');
    this.backBtn = document.getElementById('playerBackBtn');

    // Controls
    this.playToggleBtn = document.getElementById('playToggleBtn');
    this.centerPlayTrigger = document.getElementById('centerPlayTrigger');
    this.rewindBtn = document.getElementById('rewindBtn');
    this.forwardBtn = document.getElementById('forwardBtn');
    this.timeDisplay = document.getElementById('timeDisplay');
    this.scrubContainer = document.getElementById('scrubContainer');
    this.scrubProgress = document.getElementById('scrubProgress');
    this.scrubBuffered = document.getElementById('scrubBuffered');
    this.scrubTooltip = document.getElementById('scrubTooltip');

    // Menus
    this.qualityBtn = document.getElementById('qualityBtn');
    this.qualityMenu = document.getElementById('qualityMenu');
    this.subtitlesBtn = document.getElementById('subtitlesBtn');
    this.subtitlesMenu = document.getElementById('subtitlesMenu');
    this.volumeBtn = document.getElementById('volumeBtn');
    this.volumeSlider = document.getElementById('volumeSlider');
    this.fullscreenBtn = document.getElementById('fullscreenBtn');

    // State
    this.currentMovie = null;
    this.hls = null;
    this.activeQuality = 'auto'; // 'auto', '720p', '480p', '1080p', 'direct'
    this.activeSubtitleId = 'off';
    this.progressInterval = null;
    this.hideOverlayTimer = null;
    this.isSeeking = false;

    // Mobile attributes
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('webkit-playsinline', '');
    this.video.setAttribute('x5-playsinline', '');

    this.initListeners();
  }

  closeMenus() {
    this.qualityMenu.classList.remove('active');
    this.subtitlesMenu.classList.remove('active');
  }

  initListeners() {
    // Back to library
    this.backBtn.addEventListener('click', () => this.closePlayer());

    // Play / Pause toggles & screen tap
    this.playToggleBtn.addEventListener('click', () => {
      this.closeMenus();
      this.togglePlay();
    });
    this.centerPlayTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeMenus();
      this.togglePlay();
    });
    this.video.addEventListener('click', () => {
      this.closeMenus();
      this.togglePlay();
    });

    // 10s Skip Buttons
    this.rewindBtn.addEventListener('click', () => this.skip(-10));
    this.forwardBtn.addEventListener('click', () => this.skip(10));

    // Video Events
    this.video.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.video.addEventListener('progress', () => this.onProgressUpdate());

    this.video.addEventListener('play', () => {
      this.playToggleBtn.innerHTML = '⏸';
      this.centerPlayTrigger.innerHTML = '⏸';
      this.centerPlayTrigger.style.opacity = '0';
      this.centerPlayTrigger.style.pointerEvents = 'none';
      this.resetOverlayTimer();
    });

    this.video.addEventListener('pause', () => {
      this.playToggleBtn.innerHTML = '▶';
      this.centerPlayTrigger.innerHTML = '▶';
      this.centerPlayTrigger.style.opacity = '1';
      this.centerPlayTrigger.style.pointerEvents = 'auto';
      this.showOverlay();
    });

    // Scrubber seek
    this.scrubContainer.addEventListener('click', (e) => this.onScrubClick(e));
    this.scrubContainer.addEventListener('mousemove', (e) => this.onScrubMouseMove(e));
    this.scrubContainer.addEventListener('mouseleave', () => {
      this.scrubTooltip.style.display = 'none';
    });

    // Volume
    this.volumeSlider.addEventListener('input', (e) => {
      this.video.volume = parseFloat(e.target.value);
      this.updateVolumeIcon();
    });
    this.volumeBtn.addEventListener('click', () => {
      this.video.muted = !this.video.muted;
      this.updateVolumeIcon();
    });

    // Fullscreen
    this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

    // Quality and Subtitle Menu Toggles
    this.qualityBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.subtitlesMenu.classList.remove('active');
      this.qualityMenu.classList.toggle('active');
    });

    this.subtitlesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.qualityMenu.classList.remove('active');
      this.subtitlesMenu.classList.toggle('active');
    });

    document.addEventListener('click', () => {
      this.qualityMenu.classList.remove('active');
      this.subtitlesMenu.classList.toggle('active');
    });

    // Overlay auto hide on interaction
    const userActive = () => this.resetOverlayTimer();
    this.playerView.addEventListener('mousemove', userActive);
    this.playerView.addEventListener('touchstart', userActive);
  }

  openMovie(movie, resumeTime = 0) {
    this.currentMovie = movie;
    this.titleEl.textContent = movie.title;
    this.playerView.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Show center play button while loading
    this.centerPlayTrigger.innerHTML = '▶';
    this.centerPlayTrigger.style.opacity = '1';
    this.centerPlayTrigger.style.pointerEvents = 'auto';

    // Populate subtitle options
    this.populateSubtitleMenu();
    this.populateQualityMenu();

    // Start video source
    this.loadSource('auto', resumeTime);

    // Start periodic progress saving (every 5 seconds)
    this.startProgressSaving();
    this.resetOverlayTimer();
  }

  loadSource(quality, targetTime = 0) {
    this.activeQuality = quality;
    const movie = this.currentMovie;
    const currentTime = targetTime || this.video.currentTime || 0;

    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    if (quality === 'direct') {
      this.video.src = `/stream/direct/${movie.id}`;
      if (currentTime > 0) {
        this.video.addEventListener('loadedmetadata', () => {
          this.video.currentTime = currentTime;
        }, { once: true });
      }
      this.playVideoWithFallback();
      return;
    }

    // Determine HLS URL
    let streamUrl = `/stream/hls/${movie.id}/master.m3u8`;
    if (quality !== 'auto') {
      streamUrl = `/stream/hls/${movie.id}/${quality}/index.m3u8`;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // Use Native HLS on iOS (Apple Safari)
    if (isIOS || (!window.Hls?.isSupported() && this.video.canPlayType('application/vnd.apple.mpegurl'))) {
      this.video.src = streamUrl;
      this.video.load();

      if (currentTime > 0) {
        this.video.addEventListener('loadedmetadata', () => {
          this.video.currentTime = currentTime;
        }, { once: true });
      }

      this.playVideoWithFallback();
    }
    // Use Hls.js on Android Chrome, desktop browsers, etc.
    else if (window.Hls && window.Hls.isSupported()) {
      this.hls = new window.Hls({
        maxBufferLength: 20,
        maxMaxBufferLength: 40,
        enableWorker: true,
        lowLatencyMode: false
      });

      this.hls.loadSource(streamUrl);
      this.hls.attachMedia(this.video);

      this.hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        if (currentTime > 0) {
          this.video.currentTime = currentTime;
        }
        this.playVideoWithFallback();
      });

      this.hls.on(window.Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.warn('HLS error:', data.type);
          switch (data.type) {
            case window.Hls.ErrorTypes.NETWORK_ERROR:
              this.hls.startLoad();
              break;
            case window.Hls.ErrorTypes.MEDIA_ERROR:
              this.hls.recoverMediaError();
              break;
            default:
              this.hls.destroy();
              break;
          }
        }
      });
    } else {
      // Direct play fallback
      this.video.src = `/stream/direct/${movie.id}`;
      this.playVideoWithFallback();
    }
  }

  playVideoWithFallback() {
    const playPromise = this.video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay policy prevented playback, keep big play button visible for Mom to tap
        this.centerPlayTrigger.innerHTML = '▶';
        this.centerPlayTrigger.style.opacity = '1';
        this.centerPlayTrigger.style.pointerEvents = 'auto';
        this.showOverlay();
      });
    }
  }

  populateQualityMenu() {
    this.qualityMenu.innerHTML = '<div class="popover-title">Video Quality</div>';
    const qualities = [
      { id: 'auto', label: '⚡ Auto (Recommended)' },
      { id: '720p', label: '720p HD (Fast & Smooth)' },
      { id: '480p', label: '480p (Data Saver)' },
      { id: '1080p', label: '1080p (High Bandwidth)' },
      { id: 'direct', label: 'Direct Play (Original)' }
    ];

    qualities.forEach((q) => {
      const btn = document.createElement('button');
      btn.className = `popover-option ${this.activeQuality === q.id ? 'selected' : ''}`;
      btn.innerHTML = `<span>${q.label}</span>${this.activeQuality === q.id ? '<span>✓</span>' : ''}`;
      btn.onclick = (e) => {
        e.stopPropagation();
        this.loadSource(q.id, this.video.currentTime);
        this.populateQualityMenu();
        this.qualityMenu.classList.remove('active');
      };
      this.qualityMenu.appendChild(btn);
    });
  }

  populateSubtitleMenu() {
    const hasSubs = this.currentMovie && this.currentMovie.subtitles && this.currentMovie.subtitles.length > 0;
    
    // If movie has no subtitle files, hide the subtitle button completely
    if (!hasSubs) {
      this.subtitlesBtn.style.display = 'none';
      this.subtitlesMenu.classList.remove('active');
      return;
    }

    this.subtitlesBtn.style.display = 'flex';
    this.subtitlesMenu.innerHTML = '<div class="popover-title">Subtitles</div>';

    // Off option
    const offBtn = document.createElement('button');
    offBtn.className = `popover-option ${this.activeSubtitleId === 'off' ? 'selected' : ''}`;
    offBtn.innerHTML = `<span>Off</span>${this.activeSubtitleId === 'off' ? '<span>✓</span>' : ''}`;
    offBtn.onclick = (e) => {
      e.stopPropagation();
      this.setSubtitle('off');
      this.populateSubtitleMenu();
      this.subtitlesMenu.classList.remove('active');
    };
    this.subtitlesMenu.appendChild(offBtn);

    // Available tracks
    this.currentMovie.subtitles.forEach((sub) => {
      const btn = document.createElement('button');
      btn.className = `popover-option ${this.activeSubtitleId === sub.id ? 'selected' : ''}`;
      btn.innerHTML = `<span>${sub.title}</span>${this.activeSubtitleId === sub.id ? '<span>✓</span>' : ''}`;
      btn.onclick = (e) => {
        e.stopPropagation();
        this.setSubtitle(sub.id);
        this.populateSubtitleMenu();
        this.subtitlesMenu.classList.remove('active');
      };
      this.subtitlesMenu.appendChild(btn);
    });
  }

  setSubtitle(subId) {
    this.activeSubtitleId = subId;
    const oldTracks = this.video.querySelectorAll('track');
    oldTracks.forEach((t) => t.remove());

    if (subId === 'off') return;

    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = 'Selected';
    track.srclang = 'en';
    track.src = `/stream/subtitles/${this.currentMovie.id}/${subId}`;
    track.default = true;
    this.video.appendChild(track);

    if (this.video.textTracks && this.video.textTracks.length > 0) {
      this.video.textTracks[0].mode = 'showing';
    }
  }


  togglePlay() {
    if (this.video.paused) {
      this.video.play().catch(() => {});
    } else {
      this.video.pause();
    }
  }

  skip(seconds) {
    this.video.currentTime = Math.max(0, Math.min(this.video.duration || 0, this.video.currentTime + seconds));
  }

  onTimeUpdate() {
    if (this.isSeeking) return;
    const cur = this.video.currentTime || 0;
    const dur = this.video.duration || (this.currentMovie ? this.currentMovie.duration : 1);
    const pct = (cur / dur) * 100;

    this.scrubProgress.style.width = `${pct}%`;
    this.timeDisplay.textContent = `${this.formatTime(cur)} / ${this.formatTime(dur)}`;
  }

  onProgressUpdate() {
    if (this.video.buffered.length > 0) {
      const bufferedEnd = this.video.buffered.end(this.video.buffered.length - 1);
      const dur = this.video.duration || 1;
      this.scrubBuffered.style.width = `${(bufferedEnd / dur) * 100}%`;
    }
  }

  onScrubClick(e) {
    const rect = this.scrubContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = pct * (this.video.duration || this.currentMovie.duration || 0);

    this.video.currentTime = targetTime;
  }

  onScrubMouseMove(e) {
    const rect = this.scrubContainer.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, hoverX / rect.width));
    const hoverTime = pct * (this.video.duration || this.currentMovie.duration || 0);

    this.scrubTooltip.style.display = 'block';
    this.scrubTooltip.style.left = `${hoverX}px`;
    this.scrubTooltip.textContent = this.formatTime(hoverTime);
  }

  updateVolumeIcon() {
    if (this.video.muted || this.video.volume === 0) {
      this.volumeBtn.textContent = '🔇';
    } else if (this.video.volume < 0.5) {
      this.volumeBtn.textContent = '🔉';
    } else {
      this.volumeBtn.textContent = '🔊';
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.playerView.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  showOverlay() {
    this.overlay.classList.remove('hidden');
  }

  resetOverlayTimer() {
    this.showOverlay();
    clearTimeout(this.hideOverlayTimer);
    if (!this.video.paused) {
      this.hideOverlayTimer = setTimeout(() => {
        this.overlay.classList.add('hidden');
        this.qualityMenu.classList.remove('active');
        this.subtitlesMenu.classList.remove('active');
      }, 3500);
    }
  }

  startProgressSaving() {
    clearInterval(this.progressInterval);
    this.progressInterval = setInterval(() => {
      if (this.currentMovie && this.video.currentTime > 0) {
        fetch(`/api/progress/${this.currentMovie.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentTime: Math.round(this.video.currentTime),
            duration: Math.round(this.video.duration || this.currentMovie.duration)
          })
        }).catch(() => {});
      }
    }, 5000);
  }

  closePlayer() {
    clearInterval(this.progressInterval);
    clearTimeout(this.hideOverlayTimer);

    if (this.currentMovie && this.video.currentTime > 0) {
      fetch(`/api/progress/${this.currentMovie.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentTime: Math.round(this.video.currentTime),
          duration: Math.round(this.video.duration || this.currentMovie.duration)
        })
      }).catch(() => {});
    }

    this.video.pause();
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.video.src = '';
    this.playerView.classList.remove('active');
    document.body.style.overflow = '';

    if (window.app) {
      window.app.loadMovies();
    }
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const pad = (n) => n.toString().padStart(2, '0');
    if (hrs > 0) {
      return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }
}

window.CinemaPlayer = CinemaPlayer;
