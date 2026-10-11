// Watch Together WebSocket Client

class WatchTogetherClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.roomId = 'family';
    this.userName = 'Family Member';
    this.currentMovieId = null;
    this.isRemoteAction = false;
    this.onRemotePlay = null;
    this.onRemotePause = null;
    this.onRemoteSeek = null;
    this.onRemoteMovieChange = null;
    this.onUserCountChange = null;
    this.onToast = null;
  }

  init() {
    if (typeof io === 'undefined') {
      console.warn('Socket.IO not loaded');
      return;
    }

    this.socket = io({
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('Connected to Watch Together sync server');
      this.joinRoom(this.roomId, this.userName, this.currentMovieId);
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      if (this.onToast) this.onToast('Watch Together: Disconnected. Reconnecting...', 'warn');
    });

    this.socket.on('room-state', (state) => {
      console.log('Joined room state:', state);
      if (this.onUserCountChange) this.onUserCountChange(state.userCount, state.users);
      if (this.onToast) this.onToast(`Joined Watch Together room "${state.roomId}" (${state.userCount} watching)`, 'info');
    });

    this.socket.on('user-joined', (data) => {
      if (this.onUserCountChange) this.onUserCountChange(data.userCount, data.users);
      if (this.onToast) this.onToast(`${data.name} joined the room!`, 'info');
    });

    this.socket.on('user-left', (data) => {
      if (this.onUserCountChange) this.onUserCountChange(data.userCount, data.users);
      if (this.onToast) this.onToast(`${data.name} left the room.`, 'info');
    });

    this.socket.on('remote-play', (data) => {
      this.isRemoteAction = true;
      if (this.onRemotePlay) this.onRemotePlay(data.currentTime);
      if (this.onToast) this.onToast(`${data.by} resumed playback ▶`, 'info');
      setTimeout(() => { this.isRemoteAction = false; }, 300);
    });

    this.socket.on('remote-pause', (data) => {
      this.isRemoteAction = true;
      if (this.onRemotePause) this.onRemotePause(data.currentTime);
      if (this.onToast) this.onToast(`${data.by} paused playback ⏸`, 'info');
      setTimeout(() => { this.isRemoteAction = false; }, 300);
    });

    this.socket.on('remote-seek', (data) => {
      this.isRemoteAction = true;
      if (this.onRemoteSeek) this.onRemoteSeek(data.currentTime);
      if (this.onToast) this.onToast(`${data.by} jumped to ${Math.round(data.currentTime)}s ⏩`, 'info');
      setTimeout(() => { this.isRemoteAction = false; }, 300);
    });

    this.socket.on('remote-movie-change', (data) => {
      this.currentMovieId = data.movieId;
      if (this.onRemoteMovieChange) this.onRemoteMovieChange(data.movieId, data.movieTitle);
      if (this.onToast) this.onToast(`${data.by} switched movie to: ${data.movieTitle}`, 'info');
    });
  }

  joinRoom(roomId, userName, movieId) {
    this.roomId = roomId || 'family';
    this.userName = userName || 'Family Member';
    this.currentMovieId = movieId;

    if (this.socket && this.socket.connected) {
      this.socket.emit('join-room', {
        roomId: this.roomId,
        name: this.userName,
        movieId: this.currentMovieId
      });
    }
  }

  sendPlay(currentTime) {
    if (this.isRemoteAction || !this.socket || !this.connected) return;
    this.socket.emit('sync-play', { currentTime });
  }

  sendPause(currentTime) {
    if (this.isRemoteAction || !this.socket || !this.connected) return;
    this.socket.emit('sync-pause', { currentTime });
  }

  sendSeek(currentTime) {
    if (this.isRemoteAction || !this.socket || !this.connected) return;
    this.socket.emit('sync-seek', { currentTime });
  }

  sendMovieChange(movieId, movieTitle) {
    if (!this.socket || !this.connected) return;
    this.currentMovieId = movieId;
    this.socket.emit('sync-movie-change', { movieId, movieTitle });
  }
}

window.watchTogether = new WatchTogetherClient();
