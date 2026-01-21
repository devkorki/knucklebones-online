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

const rooms = new Map();

function handlePlayerLeft(room, leavingId, reasonText) {
    // Remove player
    const leaving = room.players.find(p => p.id === leavingId);
    room.players = room.players.filter(p => p.id !== leavingId);
    room.rematch = null;

    // If nobody left, delete room
    if (room.players.length === 0) return { deleteRoom: true };

    // Transfer host if needed
    if (room.hostId === leavingId) {
        room.hostId = room.players[0].id; // remaining becomes host
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


function targetForMode(mode) {
    if (mode === "bo3") return 3;
    if (mode === "bo5") return 5;
    return null; // infinite
}

function winnerName(room, winnerId) {
    const p = room.players.find(x => x.id === winnerId);
    return p?.name || winnerId;
}

// function updateSeriesAfterGame(room) {
//     if (!room?.game || room.game.phase !== "over") return;

//     const w = room.game.winner;
//     if (!w || w === "draw") {
//         room.notice = "Game ended in a draw.";
//         emitRoom(room.code);
//         return;
//     }


//     if (!room.seriesWins) room.seriesWins = {};
//     room.seriesWins[w] = (room.seriesWins[w] || 0) + 1;

//     const mode = room.mode || "infinite";
//     const target = targetForMode(mode);

//     if (target) {
//         if (room.seriesWins[w] >= target) {
//             room.seriesOver = true;
//             room.rematch = null;
//             room.notice = `Series finished — ${winnerName(room, w)} won (first to ${target}).`;
//         } else {
//             room.notice = `Win for ${winnerName(room, w)} — series ${room.seriesWins[w]}/${target}.`;
//         }
//     } else {

//         room.notice = `Win for ${winnerName(room, w)} — infinite series continues.`;
//     }

//     emitRoom(room.code);
// }


function updateSeriesAfterGame(room) {
    if (!room?.game || room.game.phase !== "over") return false;

    const w = room.game.winner;
    if (!w || w === "draw") {
        room.notice = "Game ended in a draw.";
        emitRoom(room.code);
        return false;
    }

    if (!room.seriesWins) room.seriesWins = {};
    room.seriesWins[w] = (room.seriesWins[w] || 0) + 1;

    const mode = room.mode || "infinite";
    const target = mode === "bo3" ? 3 : mode === "bo5" ? 5 : null;

    if (target) {
        if (room.seriesWins[w] >= target) {
            room.seriesOver = true;
            room.rematch = null;
            room.notice = `Series finished — ${winnerName(room, w)} won (first to ${target}).`;
            emitRoom(room.code);
            return true;
        } else {
            room.notice = `Win for ${winnerName(room, w)} — series ${room.seriesWins[w]}/${target}.`;
            emitRoom(room.code);
            return false;
        }
    } else {
        room.notice = `Win for ${winnerName(room, w)} — infinite series continues.`;
        emitRoom(room.code);
        return false; // infinite never “finishes”
    }
}


function startNextMatch(room) {
    const p1 = room.players[0].id;
    const p2 = room.players[1].id;

    room.game = initialState([p1, p2]);
    room.game.phase = "playing";
    room.game.playerNames = {
        [p1]: room.players[0].name,
        [p2]: room.players[1].name,
    };


    room.game.active = room.hostId;

    room.game.message = `${room.players.find(p => p.id === room.hostId)?.name || "Host"} starts the next match.`;
    room.rematch = null;
    emitGame(room.code);
}




function emitRoom(code) {
    const r = rooms.get(code);
    if (!r) return;
    io.to(code).emit("room:update", {
        code: r.code,
        hostId: r.hostId,
        players: r.players,
        notice: r.notice || "",
        rematch: r.rematch || null,
        mode: r.mode || "infinite",
        seriesOver: !!r.seriesOver,
        seriesWins: r.seriesWins || {},
        history: r.history || [],
    });
}

function emitGame(code) {
    const r = rooms.get(code);
    if (!r || !r.game) return;
    io.to(code).emit("game:state", r.game);
}

function getRoomByCode(code) {
    return rooms.get(String(code || "").toUpperCase());
}

const rng = () => 1 + Math.floor(Math.random() * 6);


function nameOf(room, id) {
    return room.players.find(p => p.id === id)?.name || id;
}


function pushMatchHistory(room) {
    const g = room.game;
    if (!g || g.phase !== "over") return;

    const [p1, p2] = g.players;
    const p1Name = room.players.find(p => p.id === p1)?.name || g.playerNames?.[p1] || p1;
    const p2Name = room.players.find(p => p.id === p2)?.name || g.playerNames?.[p2] || p2;

    const p1Score = g.scores?.[p1] ?? 0;
    const p2Score = g.scores?.[p2] ?? 0;

    const winnerId = g.winner;
    const winnerName =
        winnerId === "draw"
            ? "Draw"
            : (room.players.find(p => p.id === winnerId)?.name || g.playerNames?.[winnerId] || winnerId);

    if (!room.history) room.history = [];
    room.history.push({
        n: room.history.length + 1,
        winnerId,
        winnerName,
        p1,
        p2,
        p1Name,
        p2Name,
        p1Score,
        p2Score,
        ts: Date.now(),
    });
}

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
            notice: "",
            rematch: null,
            mode: "infinite",
            mode: "bo3",
            mode: "bo5",
            history: [],

            seriesOver: false,
            seriesWins: {},
        };

        rooms.set(code, room);

        socket.join(code);
        emitRoom(code);
        ack?.({ ok: true, code, me });
    });

    socket.on("room:mode", ({ code, mode }, ack) => {
        const c = String(code || "").toUpperCase();
        const room = rooms.get(c);
        if (!room) return ack?.({ ok: false, error: "Room not found" });
        if (room.hostId !== socket.id) return ack?.({ ok: false, error: "Only host can change mode" });

        const allowed = new Set(["infinite", "bo3", "bo5"]);
        if (!allowed.has(mode)) return ack?.({ ok: false, error: "Invalid mode" });

        room.mode = mode;
        room.notice = "";
        emitRoom(c);
        ack?.({ ok: true });
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

    socket.on("rematch:request", ({ code }, ack) => {
        const room = getRoomByCode(code);
        if (!room) return ack?.({ ok: false, error: "Room not found" });
        if (!room.players.some(p => p.id === socket.id)) return ack?.({ ok: false, error: "Not in room" });
        if (!room.game || room.game.phase !== "over") return ack?.({ ok: false, error: "Game not over" });



        // create rematch state if missing
        if (!room.rematch) {
            room.rematch = {
                requestedBy: socket.id,
                acceptedBy: { [socket.id]: true }, // requester counts as "yes"
            };
        } else {
            // if already exists, just mark this player accepted
            room.rematch.acceptedBy[socket.id] = true;
            room.notice = `${nameOf(room, socket.id)} accepted the rematch.`;
        }

        emitRoom(room.code);
        ack?.({ ok: true });
        if (room.seriesOver) return ack?.({ ok: false, error: "Series is finished. Host must start a new one." });

        room.notice = `${nameOf(room, socket.id)} wants a rematch.`;
        emitRoom(room.code);
        ack?.({ ok: true });

    });

    socket.on("rematch:accept", ({ code }, ack) => {
        const room = getRoomByCode(code);

        if (!room) return ack?.({ ok: false, error: "Room not found" });
        if (!room.players.some(p => p.id === socket.id)) return ack?.({ ok: false, error: "Not in room" });
        if (!room.game || room.game.phase !== "over") return ack?.({ ok: false, error: "Game not over" });

        if (room.seriesOver) {
            room.seriesOver = false;
            room.seriesWins = {
                [room.players[0].id]: 0,
                [room.players[1].id]: 0,
            };
        }

        if (!room.rematch) {
            room.rematch = { requestedBy: socket.id, acceptedBy: {} };
        }

        room.rematch.acceptedBy[socket.id] = true;

        // if both players accepted -> restart
        const ids = room.players.map(p => p.id);
        const bothAccepted = ids.every(id => room.rematch.acceptedBy[id]);
        room.history = [];

        if (bothAccepted) {
            const p1 = room.players[0].id;
            const p2 = room.players[1].id;

            room.game = initialState([p1, p2]);
            room.game.phase = "playing";
            room.game.playerNames = {
                [p1]: room.players[0].name,
                [p2]: room.players[1].name,
            };

            // choose starter (simple): host starts every time
            room.game.active = room.hostId;

            room.game.message = "Rematch started!";
            room.rematch = null;

            emitRoom(room.code);
            emitGame(room.code);
            return ack?.({ ok: true, started: true });
        }

        emitRoom(room.code);
        ack?.({ ok: true, started: false });

        if (room.seriesOver) return ack?.({ ok: false, error: "Series is finished. Host must start a new one." });

    });

    socket.on("rematch:decline", ({ code }, ack) => {
        const room = getRoomByCode(code);
        if (!room) return ack?.({ ok: false, error: "Room not found" });
        if (!room.players.some(p => p.id === socket.id)) return ack?.({ ok: false, error: "Not in room" });

        room.rematch = null;
        room.notice = `${nameOf(room, socket.id)} declined the rematch.`;
        emitRoom(room.code);
        ack?.({ ok: true });

        ack?.({ ok: true });
    });


    socket.on("game:start", ({ code }, ack) => {
        const c = String(code || "").toUpperCase();
        const room = rooms.get(c);

        if (!room) return ack?.({ ok: false, error: "Room not found" });
        room.rematch = null;
        emitRoom(c);
        if (room.hostId !== me) return ack?.({ ok: false, error: "Only host can start" });
        if (room.players.length !== 2) return ack?.({ ok: false, error: "Need 2 players" });



        const p1 = room.players[0].id;
        const p2 = room.players[1].id;


        room.seriesOver = false;
        room.seriesWins = {
            [room.players[0].id]: 0,
            [room.players[1].id]: 0,
        };

        room.history = [];
        room.rematch = null;
        room.notice = "";
        emitRoom(c);

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

        // room.game = place(room.game, me, colIndex);
        // emitGame(c);
        // if (room.game?.phase === "over") {
        //     updateSeriesAfterGame(room);
        // }
        // ack?.({ ok: true });

        room.game = place(room.game, me, colIndex);
        emitGame(c);



        if (room.game?.phase === "over") {
            pushMatchHistory(room);
            const finished = updateSeriesAfterGame(room);
            emitRoom(c);


            if (!finished) {
                startNextMatch(room);
            }


        }

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
