/**
 * main.test.js
 * Unit tests for slot machine game logic (extracted from main.js).
 * These tests run in Node.js via Jest — no browser or PIXI required.
 */

// ─── Replicate the pure-logic constants & data from main.js ──────────────────

const REEL_COLUMNS = 3;
const MAX_LINES = 5;
const WILD_ID = "bar";

const symbolCatalog = [
    { id: "orange",     payouts: { 3: 8  }, weight: 18 },
    { id: "pear",       payouts: { 3: 10 }, weight: 17 },
    { id: "watermelon", payouts: { 3: 12 }, weight: 15 },
    { id: "bar",        payouts: { 3: 60 }, weight: 7  },
    { id: "coconut",    payouts: { 3: 16 }, weight: 13 },
    { id: "seven",      payouts: { 3: 40 }, weight: 8  },
    { id: "bell",       payouts: { 3: 20 }, weight: 11 },
    { id: "cherry",     payouts: { 1: 2, 2: 6, 3: 24 }, weight: 15 },
];

const symbolById = Object.fromEntries(symbolCatalog.map(s => [s.id, s]));
const weightedSymbols = symbolCatalog.flatMap(s =>
    Array.from({ length: s.weight }, () => s)
);

const paylines = [
    { id: 1, rows: [1, 1, 1], name: "Middle Line"   },
    { id: 2, rows: [0, 0, 0], name: "Top Line"       },
    { id: 3, rows: [2, 2, 2], name: "Bottom Line"    },
    { id: 4, rows: [0, 1, 2], name: "Down Diagonal"  },
    { id: 5, rows: [2, 1, 0], name: "Up Diagonal"    },
];

const betOptions = [5, 10, 20, 50, 100];

// Evaluate a single payline against a 3-column grid.
// grid[col] = array of symbol ids (top→bottom rows).
// Returns { symbolId, count, payout } or null.
function evaluatePayline(payline, grid, bet) {
    const firstId = grid[0][payline.rows[0]];
    let count = 1;

    for (let col = 1; col < REEL_COLUMNS; col++) {
        const id = grid[col][payline.rows[col]];
        if (id === firstId || id === WILD_ID || firstId === WILD_ID) {
            count++;
        } else {
            break;
        }
    }

    const resolvedId = firstId === WILD_ID
        ? grid[1][payline.rows[1]]   // use second symbol when first is wild
        : firstId;

    const symbol = symbolById[resolvedId] ?? symbolById[firstId];
    const multiplier = symbol?.payouts?.[count];
    if (!multiplier) return null;

    return { symbolId: resolvedId, count, payout: multiplier * bet };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Symbol catalog", () => {
    test("has exactly 8 symbols", () => {
        expect(symbolCatalog).toHaveLength(8);
    });

    test("every symbol has a unique id", () => {
        const ids = symbolCatalog.map(s => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test("every symbol has a positive weight", () => {
        symbolCatalog.forEach(s => {
            expect(s.weight).toBeGreaterThan(0);
        });
    });

    test("every symbol has at least one payout entry", () => {
        symbolCatalog.forEach(s => {
            expect(Object.keys(s.payouts).length).toBeGreaterThan(0);
        });
    });

    test("all payout values are positive numbers", () => {
        symbolCatalog.forEach(s => {
            Object.values(s.payouts).forEach(v => {
                expect(v).toBeGreaterThan(0);
            });
        });
    });

    test("BAR wild has the highest single payout (3-of-a-kind)", () => {
        const maxPayout = Math.max(
            ...symbolCatalog.map(s => s.payouts[3] ?? 0)
        );
        expect(symbolById[WILD_ID].payouts[3]).toBe(maxPayout);
    });

    test("cherry is the only symbol with partial (1 or 2 match) payouts", () => {
        const partial = symbolCatalog.filter(
            s => s.payouts[1] !== undefined || s.payouts[2] !== undefined
        );
        expect(partial).toHaveLength(1);
        expect(partial[0].id).toBe("cherry");
    });
});

describe("Weighted symbol pool", () => {
    test("total pool size equals sum of all weights", () => {
        const expectedTotal = symbolCatalog.reduce((sum, s) => sum + s.weight, 0);
        expect(weightedSymbols).toHaveLength(expectedTotal);
    });

    test("each symbol appears exactly weight-many times", () => {
        symbolCatalog.forEach(s => {
            const count = weightedSymbols.filter(w => w.id === s.id).length;
            expect(count).toBe(s.weight);
        });
    });

    test("rare symbols (bar, seven) appear less often than common ones (orange, pear)", () => {
        const barCount    = weightedSymbols.filter(s => s.id === "bar").length;
        const sevenCount  = weightedSymbols.filter(s => s.id === "seven").length;
        const orangeCount = weightedSymbols.filter(s => s.id === "orange").length;
        const pearCount   = weightedSymbols.filter(s => s.id === "pear").length;

        expect(barCount).toBeLessThan(orangeCount);
        expect(sevenCount).toBeLessThan(pearCount);
    });
});

describe("Paylines", () => {
    test("there are exactly 5 paylines", () => {
        expect(paylines).toHaveLength(MAX_LINES);
    });

    test("payline ids are 1-indexed and sequential", () => {
        paylines.forEach((p, i) => expect(p.id).toBe(i + 1));
    });

    test("each payline covers exactly REEL_COLUMNS row positions", () => {
        paylines.forEach(p => {
            expect(p.rows).toHaveLength(REEL_COLUMNS);
        });
    });

    test("all row indices are within the 3-row grid (0–2)", () => {
        paylines.forEach(p => {
            p.rows.forEach(r => {
                expect(r).toBeGreaterThanOrEqual(0);
                expect(r).toBeLessThanOrEqual(2);
            });
        });
    });
});

describe("Payout evaluation", () => {
    // Helper: build a flat 3×3 grid (3 columns, each with 3 rows)
    const makeGrid = (rows) => rows; // rows[col][row]

    test("three matching symbols on middle line pays correctly", () => {
        const grid = [
            ["cherry", "cherry", "cherry"],
            ["cherry", "cherry", "cherry"],
            ["cherry", "cherry", "cherry"],
        ];
        const result = evaluatePayline(paylines[0], grid, 10); // middle line
        expect(result).not.toBeNull();
        expect(result.symbolId).toBe("cherry");
        expect(result.count).toBe(3);
        expect(result.payout).toBe(symbolById["cherry"].payouts[3] * 10); // 24 × 10 = 240
    });

    test("two cherries pays the 2-match multiplier", () => {
        const grid = [
            ["cherry", "cherry", "cherry"],
            ["cherry", "cherry", "cherry"],
            ["orange", "orange", "orange"],
        ];
        const result = evaluatePayline(paylines[0], grid, 5); // middle line, col2 breaks
        expect(result).not.toBeNull();
        expect(result.count).toBe(2);
        expect(result.payout).toBe(symbolById["cherry"].payouts[2] * 5); // 6 × 5 = 30
    });

    test("no match returns null", () => {
        const grid = [
            ["orange", "orange", "orange"],
            ["pear",   "pear",   "pear"  ],
            ["bell",   "bell",   "bell"  ],
        ];
        const result = evaluatePayline(paylines[0], grid, 10);
        expect(result).toBeNull();
    });

    test("BAR wild in first position counts as a wild win", () => {
        const grid = [
            ["bar",   "bar",   "bar"  ],
            ["seven", "seven", "seven"],
            ["bell",  "bell",  "bell" ],
        ];
        const result = evaluatePayline(paylines[0], grid, 10); // middle row: bar, seven, bell — wild extends to 2
        expect(result).not.toBeNull();
        expect(result.count).toBeGreaterThanOrEqual(2);
    });

    test("jackpot: three BAR wilds pays 60× the bet", () => {
        const grid = [
            ["bar", "bar", "bar"],
            ["bar", "bar", "bar"],
            ["bar", "bar", "bar"],
        ];
        const result = evaluatePayline(paylines[0], grid, 10);
        expect(result).not.toBeNull();
        expect(result.payout).toBe(60 * 10); // 600
    });
});

describe("Bet options", () => {
    test("there are 5 bet levels", () => {
        expect(betOptions).toHaveLength(5);
    });

    test("bet options are sorted ascending", () => {
        for (let i = 1; i < betOptions.length; i++) {
            expect(betOptions[i]).toBeGreaterThan(betOptions[i - 1]);
        }
    });

    test("minimum bet is 5 and maximum bet is 100", () => {
        expect(betOptions[0]).toBe(5);
        expect(betOptions[betOptions.length - 1]).toBe(100);
    });

    test("cycling past the last bet wraps to index 0", () => {
        let betIndex = betOptions.length - 1;
        betIndex = (betIndex + 1) % betOptions.length;
        expect(betIndex).toBe(0);
    });
});
