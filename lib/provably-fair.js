const crypto = require('crypto');

const SYMBOLS = [
    { id: "orange", weight: 25 },
    { id: "pear", weight: 24 },
    { id: "watermelon", weight: 20 },
    { id: "bar", weight: 5 },
    { id: "coconut", weight: 18 },
    { id: "seven", weight: 6 },
    { id: "bell", weight: 16 },
    { id: "cherry", weight: 16 }
];

const TOTAL_WEIGHT = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

function generateServerSeed() {
    return crypto.randomBytes(32).toString('hex');
}

function hashSeed(seed) {
    return crypto.createHash('sha256').update(seed).digest('hex');
}

function hmac(serverSeed, message) {
    return crypto.createHmac('sha256', serverSeed).update(message).digest('hex');
}

function getSymbolFromHash(serverSeed, clientSeed, nonce, position) {
    const message = `${clientSeed}:${nonce}:${position}`;
    const hash = hmac(serverSeed, message);
    const h = parseInt(hash.slice(0, 8), 16);
    let r = h % TOTAL_WEIGHT;
    for (const symbol of SYMBOLS) {
        if (r < symbol.weight) return symbol.id;
        r -= symbol.weight;
    }
    return SYMBOLS[0].id;
}

function generateGrid(serverSeed, clientSeed, nonce, rows, cols) {
    const grid = [];
    let position = 0;
    for (let col = 0; col < cols; col++) {
        const column = [];
        for (let row = 0; row < rows; row++) {
            column.push(getSymbolFromHash(serverSeed, clientSeed, nonce, position));
            position++;
        }
        grid.push(column);
    }
    return grid;
}

function evaluateLine(lineSymbols, betAmount) {
    const WILD = "bar";

    const wildCount = lineSymbols.filter(s => s === WILD).length;
    if (wildCount === lineSymbols.length) {
        return { symbol: WILD, count: 3, multiplier: 50 };
    }

    const baseSymbol = lineSymbols.find(s => s !== WILD);
    if (!baseSymbol) return null;

    let count = 0;
    for (const s of lineSymbols) {
        if (s === baseSymbol || s === WILD) count++;
        else break;
    }

    if (baseSymbol === "cherry") {
        if (count >= 2) {
            const multipliers = { 2: 3, 3: 20 };
            return { symbol: baseSymbol, count, multiplier: multipliers[count] };
        }
        return null;
    }

    if (count < 3) return null;

    const payouts = { orange: 5, pear: 6, watermelon: 8, coconut: 10, bell: 12, seven: 30, bar: 50 };
    return { symbol: baseSymbol, count, multiplier: payouts[baseSymbol] || 0 };
}

function evaluateSpin(grid, activeLines, betAmount) {
    const paylines = [
        { id: 1, rows: [1, 1, 1] },
        { id: 2, rows: [0, 0, 0] },
        { id: 3, rows: [2, 2, 2] },
        { id: 4, rows: [0, 1, 2] },
        { id: 5, rows: [2, 1, 0] }
    ];

    const lineWins = [];
    let totalWin = 0;

    paylines.slice(0, activeLines).forEach(payline => {
        const lineSymbols = payline.rows.map((row, col) => grid[col][row]);
        const result = evaluateLine(lineSymbols, betAmount);
        if (result) {
            const winAmount = result.multiplier * betAmount;
            totalWin += winAmount;
            lineWins.push({
                paylineId: payline.id,
                symbols: lineSymbols,
                ...result,
                winAmount
            });
        }
    });

    return { totalWin, lineWins, isWin: totalWin > 0 };
}

module.exports = {
    generateServerSeed,
    hashSeed,
    generateGrid,
    evaluateSpin
};
