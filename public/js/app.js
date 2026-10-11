// Main Application Controller for Mom's Cinema

class CinemaApp {
  constructor() {
    this.movies = [];
    this.filteredMovies = [];
    this.selectedMovie = null;

    // Elements
    this.movieGrid = document.getElementById('movieGrid');
    this.emptyState = document.getElementById('emptyState');
    this.continueSection = document.getElementById('continueSection');
    this.continueThumb = document.getElementById('continueThumb');
    this.continueTitle = document.getElementById('continueTitle');
    this.continueMeta = document.getElementById('continueMeta');
    this.continueProgressFill = document.getElementById('continueProgressFill');
    this.continuePlayBtn = document.getElementById('continuePlayBtn');
    this.continueRestartBtn = document.getElementById('continueRestartBtn');

    this.searchInput = document.getElementById('searchInput');
    this.rescanBtn = document.getElementById('rescanBtn');
    this.logoutBtn = document.getElementById('logoutBtn');

    // Modals
    this.movieModal = document.getElementById('movieModal');
    this.modalCloseBtn = document.getElementById('modalCloseBtn');
    this.modalThumb = document.getElementById('modalThumb');
    this.modalTitle = document.getElementById('modalTitle');
    this.modalDuration = document.getElementById('modalDuration');
    this.modalResolution = document.getElementById('modalResolution');
    this.modalSize = document.getElementById('modalSize');
    this.modalSubtitles = document.getElementById('modalSubtitles');
    this.modalPlayBtn = document.getElementById('modalPlayBtn');
    this.modalResumeBtn = document.getElementById('modalResumeBtn');

    this.toastContainer = document.getElementById('toastContainer');

    this.player = new window.CinemaPlayer();
    this.init();
  }

  async init() {
    this.initEventListeners();
    await this.loadMovies();
  }

  initEventListeners() {
    // Search filter
    this.searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      this.filteredMovies = this.movies.filter((m) =>
        m.title.toLowerCase().includes(q) || m.fileName.toLowerCase().includes(q)
      );
      this.renderGrid();
    });

    // Rescan library
    this.rescanBtn.addEventListener('click', async () => {
      this.rescanBtn.disabled = true;
      this.rescanBtn.textContent = 'Scanning...';
      try {
        const res = await fetch('/api/movies/scan', { method: 'POST' });
        const data = await res.json();
        this.showToast(`Scan complete: found ${data.total} movies!`);
        await this.loadMovies();
      } catch (err) {
        this.showToast('Failed to scan library', 'error');
      } finally {
        this.rescanBtn.disabled = false;
        this.rescanBtn.innerHTML = '<span>🔄</span> <span>Rescan</span>';
      }
    });

    // Logout
    this.logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login.html';
      } catch {
        window.location.href = '/login.html';
      }
    });

    // Movie Detail Modal Close
    this.modalCloseBtn.addEventListener('click', () => {
      this.movieModal.classList.remove('active');
    });

    this.movieModal.addEventListener('click', (e) => {
      if (e.target === this.movieModal) {
        this.movieModal.classList.remove('active');
      }
    });
  }

  async loadMovies() {
    try {
      const res = await fetch('/api/movies');
      if (res.status === 401) {
        window.location.href = '/login.html';
        return;
      }
      const data = await res.json();
      this.movies = data.movies || [];
      this.filteredMovies = [...this.movies];
      this.renderContinueWatching();
      this.renderGrid();
    } catch (err) {
      console.error('Error loading movies:', err);
      this.showToast('Could not load movie catalog', 'error');
    }
  }

  renderContinueWatching() {
    const inProgress = this.movies
      .filter((m) => m.progress && m.progress.currentTime > 10 && !m.progress.completed)
      .sort((a, b) => new Date(b.progress.updatedAt) - new Date(a.progress.updatedAt));

    if (inProgress.length > 0) {
      const movie = inProgress[0];
      this.continueSection.style.display = 'block';
      this.continueThumb.src = movie.thumbnailUrl;
      this.continueTitle.textContent = movie.title;
      this.continueMeta.textContent = `Resume from ${this.formatTime(movie.progress.currentTime)} of ${movie.durationFormatted}`;
      this.continueProgressFill.style.width = `${movie.progress.percentage}%`;

      this.continuePlayBtn.onclick = () => {
        this.player.openMovie(movie, movie.progress.currentTime);
      };

      this.continueRestartBtn.onclick = () => {
        this.player.openMovie(movie, 0);
      };
    } else {
      this.continueSection.style.display = 'none';
    }
  }

  renderGrid() {
    this.movieGrid.innerHTML = '';

    if (this.filteredMovies.length === 0) {
      this.emptyState.style.display = 'block';
      return;
    }
    this.emptyState.style.display = 'none';

    this.filteredMovies.forEach((movie) => {
      const card = document.createElement('div');
      card.className = 'movie-card';

      const progressPct = movie.progress ? movie.progress.percentage : 0;
      const progressMarkup = progressPct > 0 ? `
        <div class="movie-progress-bar">
          <div class="movie-progress-bar-fill" style="width: ${progressPct}%"></div>
        </div>
      ` : '';

      card.innerHTML = `
        <div class="movie-thumb-wrap">
          <img class="movie-thumb" src="${movie.thumbnailUrl}" alt="${movie.title}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'300\\' height=\\'170\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%231e293b\\'/><text x=\\'50%\\' y=\\'50%\\' fill=\\'%2364748b\\' font-size=\\'18\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\'>🎬 Cinema</text></svg>'">
          <div class="movie-badge-dur">${movie.durationFormatted}</div>
          <div class="movie-badge-res">${movie.height >= 1000 ? '1080p HD' : (movie.height >= 700 ? '720p HD' : 'SD')}</div>
          ${progressMarkup}
        </div>
        <div class="movie-details">
          <div>
            <div class="movie-card-title">${movie.title}</div>
            <div class="movie-card-meta">
              <span>${movie.sizeFormatted}</span>
              <span>${movie.subtitles.length > 0 ? '💬 Subs' : ''}</span>
            </div>
          </div>
          <button class="play-card-btn">
            <span>▶</span>
            <span>${movie.progress && movie.progress.currentTime > 10 ? 'Resume' : 'Watch'}</span>
          </button>
        </div>
      `;

      card.addEventListener('click', () => this.openMovieModal(movie));
      this.movieGrid.appendChild(card);
    });
  }

  openMovieModal(movie) {
    this.selectedMovie = movie;
    this.modalThumb.src = movie.thumbnailUrl;
    this.modalTitle.textContent = movie.title;
    this.modalDuration.textContent = movie.durationFormatted;
    this.modalResolution.textContent = `${movie.resolution} (${movie.codec})`;
    this.modalSize.textContent = movie.sizeFormatted;

    const subTitles = movie.subtitles.map((s) => s.title).join(', ');
    this.modalSubtitles.textContent = subTitles || 'None detected';

    // Play button
    this.modalPlayBtn.onclick = () => {
      this.movieModal.classList.remove('active');
      this.player.openMovie(movie, 0);
    };

    // Resume button
    if (movie.progress && movie.progress.currentTime > 10) {
      this.modalResumeBtn.style.display = 'inline-flex';
      this.modalResumeBtn.textContent = `Resume from ${this.formatTime(movie.progress.currentTime)}`;
      this.modalResumeBtn.onclick = () => {
        this.movieModal.classList.remove('active');
        this.player.openMovie(movie, movie.progress.currentTime);
      };
    } else {
      this.modalResumeBtn.style.display = 'none';
    }

    this.movieModal.classList.add('active');
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new CinemaApp();
});
