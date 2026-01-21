import { useEffect, useMemo, useState, useRef } from "react";
import { io } from "socket.io-client";
import OnlineGame from "./OnlineGame";

const SERVER_URL =
    import.meta.env.VITE_SERVER_URL ||
    (import.meta.env.DEV ? "http://localhost:3001" : "");

const NAME_REGEX = /^[a-zA-Z0-9]{2,16}$/;
const isValidName = (name) => NAME_REGEX.test(name.trim());
const NAME_STORAGE_KEY = "kb:name";

export default function OnlineLobby({ onBack }) {
    const [socket, setSocket] = useState(null);
    const [game, setGame] = useState(null);

    // const [name, setName] = useState("");
    const [name, setName] = useState(() => localStorage.getItem(NAME_STORAGE_KEY) || "");
    const [code, setCode] = useState("");
    const [room, setRoom] = useState(null);
    const [me, setMe] = useState(null);
    const [error, setError] = useState("");

    const [busy, setBusy] = useState(false);
    const [busyText, setBusyText] = useState("");
    const busyTimerRef = useRef(null);

    const isHost = useMemo(() => room && me && room.hostId === me, [room, me]);

    useEffect(() => {
        const clean = name.trim();
        if (clean) localStorage.setItem(NAME_STORAGE_KEY, clean);
    }, [name]);



    useEffect(() => {
        if (!socket) return;

        const onUnload = () => {
            // best effort
            if (room?.code) socket.emit("room:leave", { code: room.code });
        };

        window.addEventListener("beforeunload", onUnload);
        return () => window.removeEventListener("beforeunload", onUnload);
    }, [socket, room?.code]);


    useEffect(() => {
        if (!SERVER_URL) {
            setError("Missing VITE_SERVER_URL.");
            return;
        }

        const s = io(SERVER_URL, { transports: ["websocket"] });


        startBusy("Connecting to server…");

        s.on("connect", () => {
            stopBusy();
            setError("");
        });

        s.on("connect_error", () => {
            setError("Cannot connect to server. It may be waking up…");
            startBusy("Waking server… (this can take ~30s on free Render)");
        });
        setSocket(s);

        s.on("game:stopped", ({ reason }) => {
            setGame(null);
            setError(reason || "Game stopped.");
        });



        s.on("connect", () => setError(""));
        s.on("connect_error", () => setError("Cannot connect to server. Is it running?"));

        s.on("room:update", (snap) => {
            setRoom(snap);
            setError("");
        });

        s.on("game:state", (g) => setGame(g));
        s.on("room:lobby", () => setGame(null));

        s.on("disconnect", () => {
            startBusy("Reconnecting…");
        });

        return () => s.disconnect();
    }, []);

    function startBusy(text) {
        setBusyText(text);
        clearTimeout(busyTimerRef.current);
        busyTimerRef.current = setTimeout(() => setBusy(true), 300);
    }

    function stopBusy() {
        clearTimeout(busyTimerRef.current);
        busyTimerRef.current = null;
        setBusy(false);
        setBusyText("");
    }

    useEffect(() => {
        return () => clearTimeout(busyTimerRef.current);
    }, []);

    function createRoom() {
        if (!socket) return;
        const cleanName = name.trim();
        localStorage.setItem(NAME_STORAGE_KEY, cleanName);
        if (!isValidName(cleanName)) return setError("Name must be 2–16 (letters & numbers).");

        setError("");
        socket.emit("room:create", { name: cleanName }, (res) => {
            if (!res?.ok) return setError(res?.error || "Create failed");
            setCode(res.code);
            setMe(res.me);
        });


        setTimeout(() => {
            // only show if still waiting
            setBusy((b) => {
                if (!b) return b;
                setBusyText("Still waiting… server might be waking. Try again in a few seconds.");
                return b;
            });
        }, 12000);

    }

    function joinRoom() {
        if (!socket) return;
        const cleanName = name.trim();
        localStorage.setItem(NAME_STORAGE_KEY, cleanName);

        if (!isValidName(cleanName)) return setError("Name must be 2–16 (letters & numbers).");

        const cleanCode = code.trim().toUpperCase();
        if (cleanCode.length < 3) return setError("Enter a room code.");

        setError("");
        socket.emit("room:join", { code: cleanCode, name: cleanName }, (res) => {
            if (!res?.ok) return setError(res?.error || "Join failed");
            setCode(res.code);
            setMe(res.me);
        });


        setTimeout(() => {
            setBusy((b) => {
                if (!b) return b;
                setBusyText("Still waiting… server might be waking. Try again in a few seconds.");
                return b;
            });
        }, 12000);
    }

    function leaveRoom() {
        if (!socket || !room) return;
        socket.emit("room:leave", { code: room.code }, () => { });
        setRoom(null);
        setCode("");
        setMe(null);
        setGame(null);
    }

    if (room && game && me) {
        return (
            <OnlineGame
                socket={socket}
                room={room}
                roomCode={room.code}
                me={me}
                game={game}


                onReturnToLobby={() => setGame(null)}


                onQuit={() => {
                    socket.emit("room:leave", { code: room.code }, () => { });
                    setGame(null);
                    setRoom(null);
                    setCode("");
                    setMe(null);
                    onBack?.();
                }}
            />
        );
    }


    return (
        <div
            style={{
                minHeight: "100vh",
                background: "radial-gradient(900px 700px at 20% 20%, #151a2d 0%, transparent 60%), #0b0b0c",
                color: "white",
                fontFamily: "system-ui, sans-serif",
                display: "grid",
                placeItems: "center",
                padding: 16,
            }}
        >
            <div
                style={{
                    width: "min(420px, 100%)",
                    background: "rgba(16,16,18,0.75)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 18,
                    padding: 18,
                    boxShadow: "0 18px 45px rgba(0,0,0,0.55)",
                    backdropFilter: "blur(14px)",
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                        <div style={{ fontSize: 22, fontWeight: 900 }}>Online Lobby</div>
                        <div style={{ opacity: 0.7, marginTop: 4, fontSize: 12 }}>
                            Server: <b>{SERVER_URL}</b>
                        </div>
                    </div>




                    <button
                        onClick={() => (room ? leaveRoom() : onBack?.())}
                        style={{
                            padding: "10px 14px",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "rgba(0,0,0,0.25)",
                            color: "white",
                            cursor: "pointer",
                            height: 42,
                            fontWeight: 700,
                        }}
                    >
                        {room ? "Leave room" : "← Back"}
                    </button>
                </div>



                {error && (
                    <div
                        style={{
                            marginTop: 12,
                            padding: 12,
                            borderRadius: 12,
                            border: "1px solid #522",
                            background: "#1a0f0f",
                            color: "#ffb3b3",
                        }}
                    >
                        {error}
                    </div>
                )}

                {!room ? (
                    <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                        <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontWeight: 800 }}>Name</div>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                style={{
                                    padding: 10,
                                    borderRadius: 12,
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    background: "rgba(0,0,0,0.28)",
                                    color: "white",
                                }}
                            />
                        </div>

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <button
                                onClick={createRoom}
                                style={{
                                    padding: "10px 14px",
                                    borderRadius: 12,
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    background: "rgba(255,255,255,0.06)",
                                    color: "white",
                                    cursor: "pointer",
                                    fontWeight: 800,
                                }}
                            >
                                Create room
                            </button>

                            <input
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                                placeholder="ROOM CODE"
                                style={{
                                    padding: 10,
                                    borderRadius: 12,
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    background: "rgba(0,0,0,0.28)",
                                    color: "white",
                                    width: 160,
                                    letterSpacing: 2,
                                    fontWeight: 800,
                                    textTransform: "uppercase",
                                }}
                            />

                            <button
                                onClick={joinRoom}
                                style={{
                                    padding: "10px 14px",
                                    borderRadius: 12,
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    background: "rgba(255,255,255,0.06)",
                                    color: "white",
                                    cursor: "pointer",
                                    fontWeight: 800,
                                }}
                            >
                                Join room
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ marginTop: 16 }}>

                        {/* {room?.notice && !game && (<div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.20)", color: "rgba(255,255,255,0.85)", }} > {room.notice} </div>)} */}
                        <div
                            style={{
                                padding: 12,
                                borderRadius: 14,
                                border: "1px solid rgba(255,255,255,0.10)",
                                background: "rgba(0,0,0,0.25)",
                            }}
                        >
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                                <div>
                                    Room code:{" "}
                                    <span style={{ fontWeight: 900, letterSpacing: 2, fontSize: 18 }}>{room.code}</span>
                                </div>
                                <div style={{ opacity: 0.8 }}>
                                    You: <b>{name.trim() || me}</b> {isHost ? "(host)" : ""}
                                </div>
                            </div>

                            <div style={{ marginTop: 12, fontWeight: 900 }}>Players</div>
                            <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                                {room.players.map((p) => (
                                    <div
                                        key={p.id}
                                        style={{
                                            padding: 10,
                                            borderRadius: 12,
                                            border: "1px solid rgba(255,255,255,0.08)",
                                            background: "rgba(0,0,0,0.22)",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: 10,
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <div>
                                            <b>{p.name}</b> <span style={{ opacity: 0.7, fontSize: 12 }}>({p.id})</span>
                                        </div>
                                        <div style={{ opacity: 0.8 }}>
                                            {p.id === room.hostId ? "HOST" : ""}
                                            {p.id === me ? "  (YOU)" : ""}
                                        </div>
                                    </div>





                                ))}

                                {room.seriesWins && room.players?.length === 2 && (
                                    <div style={{ marginTop: 12, opacity: 0.9, fontWeight: 800 }}>
                                        {/* Series ({room.mode === "bo3" ? "First to 3" : room.mode === "bo5" ? "First to 5" : "Infinite"}):{" "} */}
                                        {/* {room.players[0].name} {room.seriesWins[room.players[0].id] || 0} – {room.seriesWins[room.players[1].id] || 0} {room.players[1].name}
                                        {room.seriesOver ? "  Finished" : ""} */}
                                    </div>
                                )}

                            </div>


                            {isHost && (
                                <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                                    <div style={{ fontWeight: 900 }}>Mode</div>
                                    <select
                                        value={room.mode || "infinite"}
                                        onChange={(e) => {
                                            socket.emit("room:mode", { code: room.code, mode: e.target.value }, (res) => {
                                                if (!res?.ok) setError(res?.error || "Could not set mode");
                                            });
                                        }}
                                        style={{
                                            padding: 10,
                                            borderRadius: 12,
                                            border: "1px solid rgba(255,255,255,0.12)",
                                            background: "rgba(0,0,0,0.28)",
                                            color: "white",
                                            fontWeight: 800,
                                        }}
                                    >
                                        <option value="infinite">Infinite</option>
                                        <option value="bo3">First to 3</option>
                                        <option value="bo5">First to 5</option>
                                    </select>
                                </div>
                            )}


                            {isHost && (
                                <button
                                    onClick={() =>
                                        socket.emit("game:start", { code: room.code }, (res) => {
                                            if (!res?.ok) setError(res?.error || "Could not start");
                                        })
                                    }
                                    style={{
                                        marginTop: 12,
                                        width: "100%",
                                        padding: "10px 14px",
                                        borderRadius: 12,
                                        border: "1px solid rgba(255,255,255,0.12)",
                                        background: "rgba(255,255,255,0.08)",
                                        color: "white",
                                        cursor: "pointer",
                                        fontWeight: 900,
                                    }}
                                >
                                    Start Game
                                </button>
                            )}



                            {busy && (
                                <div
                                    style={{
                                        position: "fixed",
                                        inset: 0,
                                        background: "rgba(0,0,0,0.6)",
                                        display: "grid",
                                        placeItems: "center",
                                        zIndex: 2000,
                                        padding: 16,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: "min(420px, 100%)",
                                            borderRadius: 18,
                                            border: "1px solid rgba(255,255,255,0.12)",
                                            background: "rgba(16,16,18,0.9)",
                                            boxShadow: "0 18px 45px rgba(0,0,0,0.55)",
                                            backdropFilter: "blur(14px)",
                                            padding: 16,
                                            color: "white",
                                        }}
                                    >
                                        <div style={{ fontWeight: 900, fontSize: 16 }}>Connecting</div>
                                        <div style={{ marginTop: 6, opacity: 0.8, fontSize: 13 }}>{busyText}</div>

                                        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
                                            <div
                                                style={{
                                                    width: 18,
                                                    height: 18,
                                                    borderRadius: "50%",
                                                    border: "2px solid rgba(255,255,255,0.25)",
                                                    borderTopColor: "rgba(255,255,255,0.9)",
                                                    animation: "spin 0.9s linear infinite",
                                                }}
                                            />
                                            <div style={{ opacity: 0.7, fontSize: 12 }}>
                                                If the server is sleeping, this can take a bit.
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => stopBusy()}
                                            style={{
                                                marginTop: 14,
                                                width: "100%",
                                                padding: "10px 14px",
                                                borderRadius: 12,
                                                border: "1px solid rgba(255,255,255,0.12)",
                                                background: "rgba(255,255,255,0.08)",
                                                color: "white",
                                                cursor: "pointer",
                                                fontWeight: 900,
                                            }}
                                        >
                                            Close
                                        </button>

                                        <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
