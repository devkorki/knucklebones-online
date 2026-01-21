import { useEffect, useMemo, useRef, useState } from "react";

function getOpponentId(game, me) {
    if (!game?.players) return null;
    return game.players[0] === me ? game.players[1] : game.players[0];
}

function Dice({ value, animate = false }) {
    const pipMap = {
        1: [[0, 0]],
        2: [[-1, -1], [1, 1]],
        3: [[-1, -1], [0, 0], [1, 1]],
        4: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
        5: [[-1, -1], [-1, 1], [0, 0], [1, -1], [1, 1]],
        6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
    };

    const pips = pipMap[value] || [];

    return (
        <div
            className={`dice ${animate ? "dice-drop" : ""}`}
            style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: "#f8f8f8",
                border: "1px solid #ddd",
                boxShadow:
                    "0 2px 4px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.4)",
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gridTemplateRows: "repeat(3, 1fr)",
                padding: 6,
            }}
        >
            {[...Array(9)].map((_, i) => {
                const x = (i % 3) - 1;
                const y = Math.floor(i / 3) - 1;
                const isPip = pips.some(([px, py]) => px === x && py === y);

                return (
                    <div
                        key={i}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {isPip && (
                            <div
                                style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    background: "#111",
                                }}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}


function Slot({ value, faded }) {
    return (
        <div
            style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.10)",
                background: faded ? "rgba(0,0,0,0.10)" : "rgba(0,0,0,0.18)",
                display: "grid",
                placeItems: "center",
                opacity: faded ? 0.45 : 1,
            }}
        >
            {/* {value ? <Dice value={value} /> : null} */}
            {value ? <Dice value={value} animate /> : null}

        </div>
    );
}




function Column({ col, isClickable, onClick, highlight }) {
    // col is array bottom->top, render top slot first visually
    const slots = [col?.[2] ?? null, col?.[1] ?? null, col?.[0] ?? null];

    return (
        <button
            onClick={onClick}
            disabled={!isClickable}
            style={{
                border: highlight ? "1px solid rgba(255,255,255,0.28)" : "1px solid rgba(255,255,255,0.10)",
                background: highlight ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                borderRadius: 16,
                padding: 10,
                cursor: isClickable ? "pointer" : "default",
                opacity: isClickable ? 1 : 0.75,
                display: "grid",
                gap: 10,
                outline: "none",
                width: 90,
            }}
            title={isClickable ? "Place die here" : "Not available"}
        >
            <Slot value={slots[0]} />
            <Slot value={slots[1]} />
            <Slot value={slots[2]} />
        </button>
    );
}

function scoreColumn(col = []) {
    const counts = new Map();
    for (const v of col) counts.set(v, (counts.get(v) || 0) + 1);

    let s = 0;
    for (const [v, c] of counts.entries()) s += v * (c * c);
    return s;
}


function scoreBoard(board = [[], [], []]) {
    return board.reduce((acc, col) => acc + scoreColumn(col), 0);
}

export default function OnlineGame({ socket, roomCode, room, me, game, onReturnToLobby, onQuit }) {
    const rematch = room?.rematch || null;

    const oppId = getOpponentId(game, me);

    const seriesWins = room?.seriesWins || {};
    const mode = room?.mode || "infinite";
    const target = mode === "bo3" ? 3 : mode === "bo5" ? 5 : null;

    // const oppId = getOpponentId(game, me);

    const myName = game?.playerNames?.[me] ?? "You";
    const oppName = oppId ? (game?.playerNames?.[oppId] ?? "Opponent") : "Opponent";

    const mySeries = seriesWins[me] || 0;
    const oppSeries = oppId ? (seriesWins[oppId] || 0) : 0;

    const seriesLabel =
        mode === "bo3" ? "First to 3" :
            mode === "bo5" ? "First to 5" :
                "Infinite";

    const iRequested = rematch?.requestedBy === me;
    const oppRequested = rematch?.requestedBy && rematch.requestedBy !== me;

    const myAccepted = !!rematch?.acceptedBy?.[me];
    const oppAccepted = oppId ? !!rematch?.acceptedBy?.[oppId] : false;


    const opp = useMemo(() => getOpponentId(game, me), [game, me]);


    // const [isRolling, setIsRolling] = useState(false);
    // const [rollingFace, setRollingFace] = useState(1);
    // const rollStartedAtRef = useRef(0);

    // const MIN_ROLL_MS = 600;   // how long the animation lasts minimum
    // const TICK_MS = 60;


    //const shownPendingDie = game?.pendingDie ?? (isRolling ? rollingFace : null);
    const shownPendingDie = game?.pendingDie ?? null;
    const myBoard = game?.boards?.[me] || [[], [], []];
    const oppBoard = (opp && game?.boards?.[opp]) || [[], [], []];

    const myTurn = game?.active === me;
    const canRoll = game?.phase === "playing" && myTurn && game?.pendingDie == null;

    const myScore = game?.scores?.[me] ?? scoreBoard(myBoard);
    const oppScore = (opp && (game?.scores?.[opp] ?? scoreBoard(oppBoard))) ?? 0;

    const [menuOpen, setMenuOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);


    useEffect(() => {
        if (room?.seriesOver && game?.phase === "over") {
            setMenuOpen(true);
        }
    }, [room?.seriesOver, game?.phase]);





    function btnStyle(opts = {}) {
        const danger = !!opts.danger;
        return {
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: danger ? "rgba(255,70,70,0.14)" : "rgba(255,255,255,0.08)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
        };
    }

    function getOpponentId(game, me) {
        if (!game?.players) return null;
        return game.players[0] === me ? game.players[1] : game.players[0];
    }

    function RematchBlock({ game, rematch, me, onRequest, onAccept, onDecline }) {
        const oppId = getOpponentId(game, me);
        const myAccepted = !!rematch?.acceptedBy?.[me];
        const oppAccepted = oppId ? !!rematch?.acceptedBy?.[oppId] : false;

        const oppRequested = rematch?.requestedBy && rematch.requestedBy !== me;

        const disabled = game?.phase !== "over";

        if (disabled) {
            return (
                <button style={{ ...btnStyle(), opacity: 0.45, cursor: "not-allowed" }} disabled>
                    Rematch
                </button>
            );
        }

        if (!rematch) {
            return (
                <button onClick={onRequest} style={btnStyle()}>
                    Request Rematch
                </button>
            );
        }

        return (
            <div
                style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(0,0,0,0.22)",
                    display: "grid",
                    gap: 10,
                }}
            >
                {/* <div style={{ fontWeight: 900 }}>
                    Rematch status: {myAccepted ? "You 🗸" : "You Waiting..."} / {oppAccepted ? "Opponent 🗸" : "Opponent Waiting..."}
                </div> */}

                {oppRequested && !myAccepted ? (
                    <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={onAccept} style={{ ...btnStyle(), width: "100%" }}>
                            Accept
                        </button>
                        <button onClick={onDecline} style={{ ...btnStyle({ danger: true }), width: "100%" }}>
                            Decline
                        </button>
                    </div>
                ) : (
                    <button onClick={onDecline} style={btnStyle({ danger: true })}>
                        Cancel / Decline Rematch
                    </button>
                )}
            </div>
        );
    }



    function returnToLobby() {
        // stay in the room, just go back to lobby UI
        onLeaveToLobby?.();
    }

    function quitGame() {
        // leave room (server will notify other player)
        socket.emit("room:leave", { code: roomCode }, () => {
            onLeaveToLobby?.();
        });
    }

    function requestRematch() {
        socket.emit("rematch:request", { code: roomCode });
    }

    function acceptRematch() {
        socket.emit("rematch:accept", { code: roomCode });
    }

    function declineRematch() {
        socket.emit("rematch:decline", { code: roomCode });
        setMenuOpen(false);
    }

    const [seriesEndOpen, setSeriesEndOpen] = useState(false);

    useEffect(() => {
        const ended = !!room?.seriesOver && game?.phase === "over";
        if (ended) setSeriesEndOpen(true);
    }, [room?.seriesOver, game?.phase]);




    // useEffect(() => {
    //     if (!isRolling) return;

    //     if (game?.pendingDie != null) {
    //         // make the visual land on the real die
    //         setRollingFace(game.pendingDie);

    //         const elapsed = Date.now() - rollStartedAtRef.current;
    //         const remaining = Math.max(0, MIN_ROLL_MS - elapsed);

    //         const t = setTimeout(() => {
    //             setIsRolling(false);
    //         }, remaining);

    //         return () => clearTimeout(t);
    //     }
    // }, [isRolling, game?.pendingDie]);


    function requestRematch() {
        socket.emit("rematch:request", { code: roomCode }, (res) => {
            if (res?.ok === false) console.log(res.error);
        });
    }

    function acceptRematch() {
        socket.emit("rematch:accept", { code: roomCode }, (res) => {
            if (res?.ok === false) console.log(res.error);
        });
    }

    function declineRematch() {
        socket.emit("rematch:decline", { code: roomCode }, (res) => {
            if (res?.ok === false) console.log(res.error);
        });
    }


    // function doRoll() {
    //     if (!canRoll) return;

    //     // start animation immediately
    //     rollStartedAtRef.current = Date.now();
    //     setIsRolling(true);

    //     // start cycling faces
    //     const interval = setInterval(() => {
    //         setRollingFace(1 + Math.floor(Math.random() * 6));
    //     }, TICK_MS);

    //     // ask server for the real die
    //     socket.emit("kb:turn:roll", { code: roomCode }, (res) => {
    //         if (res && res.ok === false) console.log(res.error);
    //     });

    //     // stop cycling after MIN_ROLL_MS, but ONLY reveal when game.pendingDie exists
    //     setTimeout(() => {
    //         clearInterval(interval);

    //         // if server already provided pendingDie, stop rolling now
    //         // if not yet, keep rolling visual until it arrives (handled in useEffect below)
    //         setIsRolling((prev) => {
    //             return (game?.pendingDie == null) ? true : false;
    //         });
    //     }, MIN_ROLL_MS);
    // }

    function doRoll() {
        if (!canRoll) return;

        socket.emit("kb:turn:roll", { code: roomCode }, (res) => {
            if (res && res.ok === false) console.log(res.error);
        });
    }





    function doPlace(colIndex) {
        socket.emit("kb:turn:place", { code: roomCode, colIndex }, (res) => {
            if (res && res.ok === false) console.log(res.error);
        });
    }

    const legalCols = [0, 1, 2].map((i) => (myBoard[i]?.length ?? 0) < 3);

    return (
        <div
            style={{
                minHeight: "100vh",
                padding: 18,
                color: "white",
                fontFamily: "system-ui, sans-serif",
                background:
                    "radial-gradient(900px 700px at 20% 20%, #151a2d 0%, transparent 60%), #0b0b0c",
            }}
        >
            {/* Top bar */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "center",
                }}
            >

                <button
                    onClick={() => setMenuOpen(true)}
                    style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(0,0,0,0.25)",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: 800,
                        height: 44,
                    }}
                >
                    Menu
                </button>
                <div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>Knucklebones</div>
                    <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>
                        Room: <b style={{ letterSpacing: 2 }}>{roomCode}</b>
                    </div>
                    <div style={{ opacity: 0.75, marginTop: 6 }}>{game?.message}</div>

                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>


                    {/* <button
                        onClick={() => {
                            if (!confirm("Quit the game? You will leave the room.")) return;
                            socket.emit("room:leave", { code: roomCode }, () => {
                                onLeaveToLobby?.(); // go back to lobby/home UI
                            });
                        }}
                        style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "rgba(0,0,0,0.25)",
                            color: "white",
                            cursor: "pointer",
                            fontWeight: 800,
                            height: 44,
                        }}
                    >
                        Quit Game
                    </button> */}

                </div>
            </div>

            {/* Series score */}
            <div
                style={{
                    marginTop: 12,
                    marginBottom: 10,
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(0,0,0,0.18)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                }}
            >
                {/* <div style={{ fontWeight: 900, opacity: 0.9 }}>
                    Game Mode: {seriesLabel}{target ? ` (to ${target})` : ""}
                    {room?.seriesOver ? " Finished" : ""}
                </div>

                <div style={{ fontWeight: 900, letterSpacing: 0.5 }}>
                    {myName} <span style={{ opacity: 0.75 }}>({mySeries})</span>
                    {"  "}—{"  "}
                    <span style={{ opacity: 0.75 }}>({oppSeries})</span> {oppName}
                </div> */}


                <div
                    style={{
                        marginTop: 12,
                        padding: "12px 18px",
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(0,0,0,0.18)",
                        display: "inline-flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                    }}
                >
                    <div style={{ fontWeight: 800, opacity: 0.8 }}>
                        Game Mode: {seriesLabel}
                        {/* {target ? ` (to ${target})` : ""} */}
                        {room?.seriesOver ? " — Finished" : ""}
                    </div>


                </div>
                {/* <div
                    style={{
                        fontWeight: 900,
                        fontSize: 20,
                        letterSpacing: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                    }}
                >
                    <span>{myName}</span>
                    <span style={{ opacity: 0.7 }}>{mySeries}</span>
                    <span style={{ opacity: 0.5 }}>—</span>
                    <span style={{ opacity: 0.7 }}>{oppSeries}</span>
                    <span>{oppName}</span>
                </div> */}

                <button
                    onClick={() => setHistoryOpen(true)}
                    title="View match history"
                    style={{
                        all: "unset",
                        cursor: "pointer",
                        borderRadius: 10,
                        padding: "6px 10px",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                    }}
                >
                    <div
                        style={{
                            fontWeight: 900,
                            fontSize: 20,
                            letterSpacing: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            whiteSpace: "nowrap",
                        }}
                    >
                        <span>{myName}</span>
                        <span style={{ opacity: 0.7 }}>{mySeries}</span>
                        <span style={{ opacity: 0.5 }}>—</span>
                        <span style={{ opacity: 0.7 }}>{oppSeries}</span>
                        <span>{oppName}</span>
                    </div>
                </button>


            </div>


            {/* Score row */}
            <div
                style={{
                    marginTop: 16,
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "center",
                }}
            >
                <div
                    style={{
                        padding: "10px 12px",
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: myTurn ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.22)",
                    }}
                >
                    <div style={{ fontSize: 12, opacity: 0.7 }}>You</div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{myScore}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{myTurn ? "Your turn" : "Waiting…"}</div>
                </div>

                <div
                    style={{
                        padding: "10px 12px",
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: !myTurn ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.22)",
                    }}
                >
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Opponent</div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{oppScore}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{!myTurn ? "Their turn" : "—"}</div>
                </div>




                {game?.phase === "over" && (
                    <div
                        style={{
                            padding: "10px 12px",
                            borderRadius: 14,
                            border: "1px solid rgba(255,255,255,0.16)",
                            background: "rgba(255,255,255,0.10)",
                            fontWeight: 900,
                        }}
                    >
                        {game.winner === "draw"
                            ? "Draw!"
                            : game.winner === me
                                ? "You win!"
                                : "You lose!"}
                    </div>
                )}

                {game?.phase === "over" && (
                    <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        {!rematch && (
                            <button
                                onClick={requestRematch}
                                style={{
                                    padding: "10px 14px",
                                    borderRadius: 12,
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    background: "rgba(255,255,255,0.08)",
                                    color: "white",
                                    cursor: "pointer",
                                    fontWeight: 900,
                                }}
                            >
                                Request rematch
                            </button>
                        )}

                        {rematch && (
                            <>
                                {/* <div style={{ opacity: 0.85, fontWeight: 800 }}>
                                    Rematch: {myAccepted ? "You ✅" : "You ⏳"} / {oppAccepted ? "Opponent ✅" : "Opponent ⏳"}
                                </div> */}

                                {oppRequested && !myAccepted && (
                                    <>
                                        {/* <button
                                            onClick={acceptRematch}
                                            style={{
                                                padding: "10px 14px",
                                                borderRadius: 12,
                                                border: "1px solid rgba(255,255,255,0.12)",
                                                background: "rgba(255,255,255,0.10)",
                                                color: "white",
                                                cursor: "pointer",
                                                fontWeight: 900,
                                            }}
                                        >
                                            Accept
                                        </button>
                                        <button
                                            onClick={declineRematch}
                                            style={{
                                                padding: "10px 14px",
                                                borderRadius: 12,
                                                border: "1px solid rgba(255,255,255,0.12)",
                                                background: "rgba(0,0,0,0.25)",
                                                color: "white",
                                                cursor: "pointer",
                                                fontWeight: 900,
                                            }}
                                        >
                                            Decline
                                        </button> */}
                                    </>
                                )}

                                {/* requester can cancel by declining */}
                                {/* {iRequested && (
                                    <button
                                        onClick={declineRematch}
                                        style={{
                                            padding: "10px 14px",
                                            borderRadius: 12,
                                            border: "1px solid rgba(255,255,255,0.12)",
                                            background: "rgba(0,0,0,0.25)",
                                            color: "white",
                                            cursor: "pointer",
                                            fontWeight: 900,
                                        }}
                                    >
                                        Cancel request
                                    </button>
                                )} */}
                            </>
                        )}
                    </div>
                )}

            </div>

            {/* Boards */}
            <div
                style={{
                    marginTop: 18,
                    display: "grid",
                    gridTemplateRows: "auto auto",
                    gap: 18,
                    alignItems: "stretch",
                }}
            >
                {/* Opponent board (TOP) */}
                <div
                    style={{
                        borderRadius: 18,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(0,0,0,0.16)",
                        padding: 14,
                        backdropFilter: "blur(10px)",
                        opacity: 0.95,
                    }}
                >
                    <div style={{ fontWeight: 900, marginBottom: 10 }}>
                        Opponent board
                    </div>

                    <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                        {[0, 1, 2].map((c) => (
                            <div
                                key={c}
                                style={{
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    background: "rgba(255,255,255,0.03)",
                                    borderRadius: 16,
                                    padding: 10,
                                    display: "grid",
                                    gap: 10,
                                    width: 90,
                                }}
                            >
                                <Slot value={oppBoard[c]?.[2] ?? null} faded />
                                <Slot value={oppBoard[c]?.[1] ?? null} faded />
                                <Slot value={oppBoard[c]?.[0] ?? null} faded />
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                        Opponent dice get removed when you place matching values.
                    </div>
                </div>




                {/* Your board (BOTTOM) */}
                <div
                    style={{
                        borderRadius: 18,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(0,0,0,0.22)",
                        padding: 14,
                        backdropFilter: "blur(10px)",
                    }}
                >
                    <div style={{ fontWeight: 900, marginBottom: 10 }}>
                        Your board
                    </div>

                    <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                        {[0, 1, 2].map((c) => {
                            const hasSpace = (myBoard[c]?.length ?? 0) < 3;
                            const clickable =
                                myTurn &&
                                game?.pendingDie != null &&
                                hasSpace &&
                                game?.phase === "playing";

                            return (
                                <Column
                                    key={c}
                                    col={myBoard[c]}
                                    isClickable={clickable}
                                    onClick={() => doPlace(c)}
                                    highlight={clickable}
                                />
                            );
                        })}
                    </div>

                    <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                        {myTurn
                            ? game?.pendingDie == null
                                ? "Roll a die."
                                : "Click a column to place."
                            : "Wait for opponent."}
                    </div>
                </div>
            </div>

            <div style={{ display: "grid", placeItems: "center" }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "12px 14px",
                        borderRadius: 16,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(0,0,0,0.22)",
                        backdropFilter: "blur(10px)",
                        minWidth: 320,
                        marginTop: 20,
                        justifyContent: "center",
                    }}
                >
                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Die</div>
                        <div style={{ height: 54, display: "grid", placeItems: "center" }}>
                            {shownPendingDie ? (
                                <Dice value={shownPendingDie} />
                            ) : (
                                <div style={{ opacity: 0.5 }}>—</div>
                            )}
                        </div>
                    </div>

                    <div style={{ width: 1, height: 46, background: "rgba(255,255,255,0.10)" }} />

                    <div style={{ display: "grid", gap: 8 }}>
                        <button
                            onClick={doRoll}
                            // disabled={!canRoll || isRolling}
                            disabled={!canRoll}
                            style={{
                                padding: "10px 14px",
                                borderRadius: 12,
                                border: "1px solid rgba(255,255,255,0.12)",
                                background: "rgba(255,255,255,0.08)",
                                color: "white",
                                cursor: canRoll ? "pointer" : "not-allowed",
                                fontWeight: 900,
                                opacity: canRoll ? 1 : 0.5,
                                minWidth: 140,
                            }}
                        >
                            Roll
                        </button>

                        <div style={{ fontSize: 12, opacity: 0.7, textAlign: "center" }}>
                            {myTurn
                                ? game?.pendingDie == null
                                    ? "Roll, then place."
                                    : "Click a column to place."
                                : "Opponent’s turn."}
                        </div>
                    </div>
                </div>
            </div>



            {menuOpen && (
                <div
                    onClick={() => setMenuOpen(false)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.6)",
                        display: "grid",
                        placeItems: "center",
                        zIndex: 1000,
                        padding: 16,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: "min(420px, 100%)",
                            borderRadius: 18,
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "rgba(16,16,18,0.85)",
                            boxShadow: "0 18px 45px rgba(0,0,0,0.55)",
                            backdropFilter: "blur(14px)",
                            padding: 16,
                            color: "white",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                            <div style={{ fontSize: 18, fontWeight: 900 }}>Game Menu</div>
                            <button
                                onClick={() => setMenuOpen(false)}
                                style={{
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    background: "rgba(0,0,0,0.25)",
                                    color: "white",
                                    borderRadius: 12,
                                    width: 40,
                                    height: 40,
                                    cursor: "pointer",
                                    fontWeight: 900,
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Optional message */}
                        <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                            {room?.notice || (room?.seriesOver ? "Series finished." : "")}
                        </div>


                        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                            {/* Return to Lobby (stay in room) */}
                            <button
                                onClick={() => {
                                    setMenuOpen(false);
                                    onReturnToLobby?.();
                                }}
                                style={btnStyle()}
                            >
                                Return to Lobby
                            </button>
                            {/* Rematch */}
                            <RematchBlock
                                game={game}
                                rematch={room?.rematch || null}
                                me={me}
                                onRequest={() => requestRematch()}
                                onAccept={() => acceptRematch()}
                                onDecline={() => declineRematch()}
                            />

                            {/* Quit Game (leave room) */}
                            <button
                                onClick={() => {
                                    setMenuOpen(false);

                                    onQuit?.();
                                }}
                                style={btnStyle({ danger: true })}
                            >
                                Quit Game
                            </button>


                        </div>




                    </div>

                    {seriesEndOpen && (
                        <div
                            onClick={() => { }}
                            style={{
                                position: "fixed",
                                inset: 0,
                                background: "rgba(0,0,0,0.65)",
                                display: "grid",
                                placeItems: "center",
                                zIndex: 1200,
                                padding: 16,
                            }}
                        >
                            <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    width: "min(520px, 100%)",
                                    borderRadius: 18,
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    background: "rgba(16,16,18,0.92)",
                                    boxShadow: "0 18px 45px rgba(0,0,0,0.55)",
                                    backdropFilter: "blur(14px)",
                                    padding: 16,
                                    color: "white",
                                }}
                            >
                                <div style={{ fontSize: 18, fontWeight: 900 }}>Series Finished</div>
                                <div style={{ opacity: 0.75, marginTop: 6 }}>
                                    Final score ({seriesLabel}):
                                </div>

                                <div
                                    style={{
                                        marginTop: 10,
                                        padding: "12px 14px",
                                        borderRadius: 14,
                                        border: "1px solid rgba(255,255,255,0.10)",
                                        background: "rgba(0,0,0,0.18)",
                                        display: "flex",
                                        justifyContent: "center",
                                        gap: 12,
                                        fontWeight: 900,
                                        fontSize: 18,
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <span>{myName}</span>
                                    <span style={{ opacity: 0.8 }}>{mySeries}</span>
                                    <span style={{ opacity: 0.5 }}>—</span>
                                    <span style={{ opacity: 0.8 }}>{oppSeries}</span>
                                    <span>{oppName}</span>
                                </div>

                                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                                    {/* Rematch (new series) */}
                                    <RematchBlock
                                        game={game}
                                        rematch={room?.rematch || null}
                                        me={me}
                                        onRequest={() => requestRematch()}
                                        onAccept={() => acceptRematch()}
                                        onDecline={() => declineRematch()}
                                    />

                                    <button
                                        onClick={() => {
                                            setSeriesEndOpen(false);
                                            onQuit?.();
                                        }}
                                        style={btnStyle({ danger: true })}
                                    >
                                        Quit Game
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            )}
            {historyOpen && (
                <div
                    onClick={() => setHistoryOpen(false)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.6)",
                        display: "grid",
                        placeItems: "center",
                        zIndex: 1500,
                        padding: 16,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: "min(560px, 100%)",
                            maxHeight: "80vh",
                            overflow: "auto",
                            borderRadius: 18,
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "rgba(16,16,18,0.92)",
                            boxShadow: "0 18px 45px rgba(0,0,0,0.55)",
                            backdropFilter: "blur(14px)",
                            padding: 16,
                            color: "white",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                            <div style={{ fontSize: 18, fontWeight: 900 }}>Match History</div>
                            <button
                                onClick={() => setHistoryOpen(false)}
                                style={{
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    background: "rgba(0,0,0,0.25)",
                                    color: "white",
                                    borderRadius: 12,
                                    width: 40,
                                    height: 40,
                                    cursor: "pointer",
                                    fontWeight: 900,
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
                            {seriesLabel}{target ? ` (first to ${target})` : ""} — {room?.history?.length || 0} matches
                        </div>

                        <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                           {(room?.history || []).map((h) => (
                                <div
                                    key={h.n}
                                    style={{
                                        padding: 12,
                                        borderRadius: 14,
                                        border: "1px solid rgba(255,255,255,0.10)",
                                        background: "rgba(0,0,0,0.22)",
                                        display: "grid",
                                        gap: 6,
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                                        <div style={{ fontWeight: 900 }}>
                                            Match #{h.n} — {h.winnerId === "draw" ? "Draw" : `${h.winnerName} won`}
                                        </div>
                                        <div style={{ opacity: 0.7, fontSize: 12 }}>
                                            {new Date(h.ts).toLocaleString()}
                                        </div>
                                    </div>

                                    <div style={{ fontWeight: 800, opacity: 0.9 }}>
                                        {h.p1Name} <span style={{ opacity: 0.75 }}>{h.p1Score}</span>
                                        {"  "}—{"  "}
                                        <span style={{ opacity: 0.75 }}>{h.p2Score}</span> {h.p2Name}
                                    </div>
                                </div>
                            ))}

                            {(!room?.history || room.history.length === 0) && (
                                <div style={{ opacity: 0.7, padding: 12 }}>
                                    No matches yet.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}


        </div>



    );
}
