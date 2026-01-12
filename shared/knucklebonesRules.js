// shared/knucklebonesRules.js
export const COLS = 3;
export const ROWS = 3; // max dice per column
export const FACES = [1, 2, 3, 4, 5, 6];

export function makeEmptyBoard() {
    // board[col] = array of dice values bottom->top
    return Array.from({ length: COLS }, () => []);
}

export function initialState(playerIds) {
    const [p1, p2] = playerIds;
    return {
        phase: "waiting",
        players: [p1, p2],
        playerNames: {},
        active: p1,
        pendingDie: null,
        boards: { [p1]: makeEmptyBoard(), [p2]: makeEmptyBoard() },
        scores: { [p1]: 0, [p2]: 0 },
        winner: null,
        message: "Waiting to start",
        turn: 0,
    };
}

export function otherPlayer(state, pid) {
    return state.players[0] === pid ? state.players[1] : state.players[0];
}

export function canRoll(state, pid) {
    return state.phase === "playing" && state.active === pid && state.pendingDie == null;
}

export function canPlace(state, pid, colIndex) {
    if (state.phase !== "playing") return false;
    if (state.active !== pid) return false;
    if (state.pendingDie == null) return false;
    if (colIndex < 0 || colIndex >= COLS) return false;
    const col = state.boards[pid][colIndex];
    return col.length < ROWS;
}

export function roll(state, pid, rngInt1to6) {

    const name = state.playerNames?.[pid] ?? pid;
    if (!canRoll(state, pid)) return state;
    const die = rngInt1to6();
    return {
        ...state,
        pendingDie: die,
        message: `${name} rolled a ${die}`,
    };
}

export function place(state, pid, colIndex) {
    if (!canPlace(state, pid, colIndex)) return state;

    const die = state.pendingDie;
    const opp = otherPlayer(state, pid);

    // clone boards
    const myBoard = cloneBoard(state.boards[pid]);
    const oppBoard = cloneBoard(state.boards[opp]);

    // place die in my column
    myBoard[colIndex].push(die);

    // remove matching dice from opponent SAME column
    oppBoard[colIndex] = oppBoard[colIndex].filter(v => v !== die);

    // recompute scores
    const myScore = scoreBoard(myBoard);
    const oppScore = scoreBoard(oppBoard);

    // check end condition: when someone has full 9 slots (i.e., all cols length == 3)
    const myFull = isBoardFull(myBoard);
    const oppFull = isBoardFull(oppBoard);
    const gameOver = myFull || oppFull;

    const name = state.playerNames?.[pid] ?? pid;
    const oppName = state.playerNames?.[opp] ?? opp;

    let nextState = {
        ...state,
        boards: {
            ...state.boards,
            [pid]: myBoard,
            [opp]: oppBoard,
        },
        scores: {
            ...state.scores,
            [pid]: myScore,
            [opp]: oppScore,
        },
        pendingDie: null,
        turn: state.turn + 1,
        message: `Placed ${die} in col ${colIndex + 1}. ${oppName} loses matching ${die}s in that column.`,

        active: opp, // switch turn
    };

    if (gameOver) {
        const winner =
            myScore > oppScore ? pid :
                oppScore > myScore ? opp :
                    "draw";


        const winnerName =
            winner === "draw" ? "draw" : (state.playerNames?.[winner] ?? winner);
        nextState = {
            ...nextState,
            phase: "over",
            winner,
            message:
                winner === "draw"
                    ? `Game over — draw! (${myScore} - ${oppScore})`
                    : `Game over — ${winnerName} wins! (${myScore} - ${oppScore})`,
        };
    }

    return nextState;
}

export function scoreBoard(board) {
    // sum column scores
    return board.reduce((sum, col) => sum + scoreColumn(col), 0);
}
export function scoreColumn(col) {
    const counts = new Map();
    for (const v of col) counts.set(v, (counts.get(v) || 0) + 1);

    let s = 0;
    for (const [v, c] of counts.entries()) {
        s += v * (c * c); // face * count^2
    }
    return s;
}

export function isBoardFull(board) {
    return board.every(col => col.length >= ROWS);
}

function cloneBoard(board) {
    return board.map(col => [...col]);
}
