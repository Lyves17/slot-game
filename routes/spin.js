const express = require('express');
const router = express.Router();
const { generateServerSeed, hashSeed, generateGrid, evaluateSpin } = require('../lib/provably-fair');

let Spin = null;
try { Spin = require('../models/Spin'); } catch(e) {}

const MIN_BET = 2;
const MAX_BET = 50;

router.post('/spin', async (req, res) => {
    try {
        const { walletAddress, betAmount, activeLines, clientSeed } = req.body;

        if (!walletAddress) return res.status(400).json({ error: 'Wallet address required' });
        if (!betAmount || betAmount < MIN_BET || betAmount > MAX_BET) {
            return res.status(400).json({ error: `Bet must be between ${MIN_BET} and ${MAX_BET} MATIC` });
        }
        if (!activeLines || activeLines < 1 || activeLines > 5) {
            return res.status(400).json({ error: 'Active lines must be 1-5' });
        }

        const totalBet = betAmount * activeLines;
        const serverSeed = generateServerSeed();
        const serverSeedHash = hashSeed(serverSeed);
        const nonce = Date.now();
        const seed = clientSeed || walletAddress;

        const grid = generateGrid(serverSeed, seed, nonce, 3, 3);
        const result = evaluateSpin(grid, activeLines, betAmount);

        let spinId = null;
        if (Spin && Spin.db && Spin.db.readyState === 1) {
            const spin = await Spin.create({
                walletAddress, betAmount, activeLines, totalBet, grid,
                totalWin: result.totalWin, profit: result.totalWin - totalBet,
                isWin: result.isWin, lineWins: result.lineWins,
                serverSeed, serverSeedHash, clientSeed: seed, nonce,
            });
            spinId = spin._id;
        }

        res.json({
            success: true,
            result: {
                grid,
                totalWin: result.totalWin,
                profit: result.totalWin - totalBet,
                isWin: result.isWin,
                lineWins: result.lineWins,
                serverSeedHash,
                serverSeed,
                clientSeed: seed,
                nonce,
                spinId,
            }
        });
    } catch (error) {
        console.error('Spin error:', error);
        res.status(500).json({ error: 'Spin failed' });
    }
});

module.exports = router;
