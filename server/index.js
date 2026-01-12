import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

import { initialState, roll, place } from "../shared/knucklebonesRules.js";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] },
});

function makeCode() {
    return Math.random().toString(36).slice(2, 6).toUpperCase();
}

const rooms = new Map(); // code -> { code, hostId, players:[{id,name}], game:null }

function handlePlayerLeft(room, leavingId, reasonText) {
    // Remove player
    const leaving = room.players.find(p => p.id === leavingId);
    room.players = room.players.filter(p => p.id !== leavingId);

    // If nobody left, delete room
    if (room.players.length === 0) return { deleteRoom: true };

    // Transfer host if needed
    if (room.hostId === leavingId) {
        room.hostId = room.players[0].id; // ✅ remaining becomes host
    }

    // Stop the game if it was running
    if (room.game) {
        room.game = null;
        io.to(room.code).emit("game:stopped", { reason: reasonText });
        io.to(room.code).emit("room:lobby"); // tells clients to show lobby UI
    }

    // Store a room notice to show in lobby
    const who = leaving?.name || leavingId;
    room.notice = reasonText || `${who} left.`;

    // Update lobby snapshot
    emitRoom(room.code);

    return { deleteRoom: false };
}


function emitRoom(code) {
    const r = rooms.get(code);
    if (!r) return;
    io.to(code).emit("room:update", {
        code: r.code,
        hostId: r.hostId,
        players: r.players,
        notice: r.notice || "",
    });
}

function emitGame(code) {
    const r = rooms.get(code);
    if (!r || !r.game) return;
    io.to(code).emit("game:state", r.game);
}

const rng = () => 1 + Math.floor(Math.random() * 6);

io.on("connection", (socket) => {
    const me = socket.id;

    socket.on("room:create", ({ name }, ack) => {
        const clean = String(name || "").trim();
        if (!clean) return ack?.({ ok: false, error: "Missing name" });

        let code = makeCode();
        while (rooms.has(code)) code = makeCode();

        const room = {
            code,
            hostId: me,
            players: [{ id: me, name: clean }],
            game: null,
        };
        rooms.set(code, room);

        socket.join(code);
        emitRoom(code);
        ack?.({ ok: true, code, me });
    });

    socket.on("room:join", ({ code, name }, ack) => {
        const room = rooms.get(String(code || "").toUpperCase());
        if (!room) return ack?.({ ok: false, error: "Room not found" });
        if (room.players.length >= 2) return ack?.({ ok: false, error: "Room full" });

        const clean = String(name || "").trim();
        if (!clean) return ack?.({ ok: false, error: "Missing name" });

        // prevent duplicate join
        if (!room.players.find((p) => p.id === me)) {
            room.players.push({ id: me, name: clean });
        }

        socket.join(room.code);
        emitRoom(room.code);
        ack?.({ ok: true, code: room.code, me });
    });

    socket.on("room:leave", ({ code }, ack) => {
        const c = String(code || "").toUpperCase();
        const room = rooms.get(c);
        if (!room) return ack?.({ ok: true });

        socket.leave(c);

        const leaving = room.players.find(p => p.id === me);
        const who = leaving?.name || me;

        const res = handlePlayerLeft(room, me, `${who} left the room.`);
        if (res.deleteRoom) rooms.delete(c);

        ack?.({ ok: true });
    });


    socket.on("game:start", ({ code }, ack) => {
        const c = String(code || "").toUpperCase();
        const room = rooms.get(c);
        if (!room) return ack?.({ ok: false, error: "Room not found" });
        if (room.hostId !== me) return ack?.({ ok: false, error: "Only host can start" });
        if (room.players.length !== 2) return ack?.({ ok: false, error: "Need 2 players" });



        const p1 = room.players[0].id;
        const p2 = room.players[1].id;

        room.game = initialState([p1, p2]);

        room.game.playerNames = {
            [p1]: room.players[0].name,
            [p2]: room.players[1].name,
        };


        room.game.phase = "playing";
        // room.game.message = "Game started! Host rolls first.";
        room.game.message = `${room.players[0].name} starts the game.`;
        emitGame(c);

        ack?.({ ok: true });
    });

    // Knucklebones turn actions (optional now; used by OnlineGame later)
    socket.on("kb:turn:roll", ({ code }, ack) => {
        const c = String(code || "").toUpperCase();
        const room = rooms.get(c);
        if (!room?.game) return ack?.({ ok: false, error: "Game not running" });

        room.game = roll(room.game, me, rng);
        emitGame(c);
        ack?.({ ok: true });
    });

    socket.on("kb:turn:place", ({ code, colIndex }, ack) => {
        const c = String(code || "").toUpperCase();
        const room = rooms.get(c);
        if (!room?.game) return ack?.({ ok: false, error: "Game not running" });

        room.game = place(room.game, me, colIndex);
        emitGame(c);
        ack?.({ ok: true });
    });

    socket.on("disconnect", () => {
        // Find any room that contains this socket
        for (const [code, room] of rooms.entries()) {
            if (room.players.some(p => p.id === me)) {
                const leaving = room.players.find(p => p.id === me);
                const who = leaving?.name || me;

                const res = handlePlayerLeft(room, me, `${who} disconnected.`);
                if (res.deleteRoom) rooms.delete(code);
                break;
            }
        }
    });

});

server.listen(3001, () => console.log("Server on http://localhost:3001"));
