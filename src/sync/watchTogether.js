import { logger } from '../logger.js';

// Map of roomId -> { movieId, isPlaying, currentTime, lastUpdated, users: Map(socketId -> name) }
const rooms = new Map();

export function setupWatchTogether(io) {
  io.on('connection', (socket) => {
    logger.info(`Socket connected for Watch Together: ${socket.id}`);

    let currentRoom = null;
    let userName = 'Viewer';

    socket.on('join-room', ({ roomId = 'family', name = 'Viewer', movieId = null }) => {
      // Leave previous room if any
      if (currentRoom) {
        socket.leave(currentRoom);
      }

      currentRoom = roomId.toLowerCase().trim() || 'family';
      userName = name.trim() || 'Viewer';
      socket.join(currentRoom);

      if (!rooms.has(currentRoom)) {
        rooms.set(currentRoom, {
          roomId: currentRoom,
          movieId: movieId,
          isPlaying: false,
          currentTime: 0,
          lastUpdated: Date.now(),
          users: new Map()
        });
      }

      const room = rooms.get(currentRoom);
      room.users.set(socket.id, userName);

      // If room already had a movie, keep it; if not, set it
      if (movieId && !room.movieId) {
        room.movieId = movieId;
      }

      logger.info(`User "${userName}" joined Watch Together room "${currentRoom}" (Total: ${room.users.size})`);

      // Send initial room state to joining client
      socket.emit('room-state', {
        roomId: currentRoom,
        movieId: room.movieId,
        isPlaying: room.isPlaying,
        currentTime: room.currentTime,
        userCount: room.users.size,
        users: Array.from(room.users.values())
      });

      // Broadcast user joined to other clients in room
      socket.to(currentRoom).emit('user-joined', {
        name: userName,
        userCount: room.users.size,
        users: Array.from(room.users.values())
      });
    });

    socket.on('sync-play', ({ currentTime }) => {
      if (!currentRoom || !rooms.has(currentRoom)) return;
      const room = rooms.get(currentRoom);
      room.isPlaying = true;
      room.currentTime = currentTime;
      room.lastUpdated = Date.now();

      logger.info(`[Room ${currentRoom}] Play triggered by ${userName} at ${currentTime.toFixed(1)}s`);
      socket.to(currentRoom).emit('remote-play', {
        currentTime,
        by: userName
      });
    });

    socket.on('sync-pause', ({ currentTime }) => {
      if (!currentRoom || !rooms.has(currentRoom)) return;
      const room = rooms.get(currentRoom);
      room.isPlaying = false;
      room.currentTime = currentTime;
      room.lastUpdated = Date.now();

      logger.info(`[Room ${currentRoom}] Pause triggered by ${userName} at ${currentTime.toFixed(1)}s`);
      socket.to(currentRoom).emit('remote-pause', {
        currentTime,
        by: userName
      });
    });

    socket.on('sync-seek', ({ currentTime }) => {
      if (!currentRoom || !rooms.has(currentRoom)) return;
      const room = rooms.get(currentRoom);
      room.currentTime = currentTime;
      room.lastUpdated = Date.now();

      logger.info(`[Room ${currentRoom}] Seek triggered by ${userName} to ${currentTime.toFixed(1)}s`);
      socket.to(currentRoom).emit('remote-seek', {
        currentTime,
        by: userName
      });
    });

    socket.on('sync-movie-change', ({ movieId, movieTitle }) => {
      if (!currentRoom || !rooms.has(currentRoom)) return;
      const room = rooms.get(currentRoom);
      room.movieId = movieId;
      room.currentTime = 0;
      room.isPlaying = false;
      room.lastUpdated = Date.now();

      logger.info(`[Room ${currentRoom}] Movie changed by ${userName} to ${movieTitle} (${movieId})`);
      socket.to(currentRoom).emit('remote-movie-change', {
        movieId,
        movieTitle,
        by: userName
      });
    });

    socket.on('disconnect', () => {
      if (currentRoom && rooms.has(currentRoom)) {
        const room = rooms.get(currentRoom);
        room.users.delete(socket.id);

        if (room.users.size === 0) {
          // Keep room state for 10 minutes in case of momentary disconnect
          setTimeout(() => {
            if (rooms.has(currentRoom) && rooms.get(currentRoom).users.size === 0) {
              rooms.delete(currentRoom);
              logger.info(`Removed empty Watch Together room "${currentRoom}"`);
            }
          }, 10 * 60 * 1000);
        } else {
          socket.to(currentRoom).emit('user-left', {
            name: userName,
            userCount: room.users.size,
            users: Array.from(room.users.values())
          });
        }
      }
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
}
