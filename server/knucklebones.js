// server/knucklebones.js
import { initialState, roll, place } from "../shared/knucklebonesRules.js";

function rngInt1to6() {
  return () => 1 + Math.floor(Math.random() * 6);
}

export function installKnucklebones(io) {
  const rooms = new Map(); // roomId -> { state, socketsByPlayer }

  function emitState(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    io.to(roomId).emit("kb:state", room.state);
  }

  function getPlayerId(socket) {
    // use your UNO identity: socket.data.playerId / username etc
    return socket.data.playerId || socket.id;
  }

  io.on("connection", (socket) => {
    socket.on("kb:room:create", ({ roomId }) => {
      const pid = getPlayerId(socket);
      rooms.set(roomId, {
        state: { phase: "waiting", players: [pid], message: "Waiting for opponent..." },
      });
      socket.join(roomId);
      emitState(roomId);
    });

    socket.on("kb:room:join", ({ roomId }) => {
      const room = rooms.get(roomId);
      const pid = getPlayerId(socket);
      if (!room) return socket.emit("kb:error", { message: "Room not found." });

      if (room.state.players?.length >= 2) {
        return socket.emit("kb:error", { message: "Room full." });
      }

      const p1 = room.state.players[0];
      const p2 = pid;

      room.state = initialState([p1, p2]);
      room.state.phase = "playing";
      room.state.message = "Game started! P1 to roll.";
      socket.join(roomId);
      emitState(roomId);
    });

    socket.on("kb:turn:roll", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      const pid = getPlayerId(socket);

      room.state = roll(room.state, pid, rngInt1to6());
      emitState(roomId);
    });

    socket.on("kb:turn:place", ({ roomId, colIndex }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      const pid = getPlayerId(socket);

      room.state = place(room.state, pid, colIndex);
      emitState(roomId);
    });

    socket.on("kb:room:leave", ({ roomId }) => {
      socket.leave(roomId);
      // optional: handle forfeits/cleanup like you did with UNO
    });

    socket.on("disconnect", () => {
      // optional: mark player disconnected, allow reconnect
    });
  });
}
