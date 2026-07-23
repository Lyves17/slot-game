const express = require('express');
const router = express.Router();
const Spin = require('../models/Spin');

function checkAdmin(req, res, next) {
    const secret = req.headers['x-admin-secret'] || req.query.secret;
    if (!secret || secret !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

router.get('/spins', checkAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.wallet) filter.walletAddress = { $regex: req.query.wallet, $options: 'i' };
        if (req.query.status) filter.status = req.query.status;

        const spins = await Spin.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
        const total = await Spin.countDocuments(filter);

        res.json({ spins, total, page, pages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch spins' });
    }
});

router.get('/stats', checkAdmin, async (req, res) => {
    try {
        const totalSpins = await Spin.countDocuments();
        const totalWins = await Spin.countDocuments({ isWin: true });
        const totalBets = await Spin.aggregate([{ $group: { _id: null, total: { $sum: '$totalBet' } } }]);
        const totalPayouts = await Spin.aggregate([{ $group: { _id: null, total: { $sum: '$totalWin' } } }]);
        const uniquePlayers = await Spin.distinct('walletAddress');

        const recentSpins = await Spin.find().sort({ createdAt: -1 }).limit(10);
        const pendingPayouts = await Spin.find({ isWin: true, status: { $ne: 'paid' } }).sort({ createdAt: -1 });

        res.json({
            totalSpins,
            totalWins,
            winRate: totalSpins > 0 ? ((totalWins / totalSpins) * 100).toFixed(1) : 0,
            totalBets: totalBets[0]?.total || 0,
            totalPayouts: totalPayouts[0]?.total || 0,
            houseProfit: (totalBets[0]?.total || 0) - (totalPayouts[0]?.total || 0),
            uniquePlayers: uniquePlayers.length,
            recentSpins,
            pendingPayouts,
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

router.patch('/spin/:id/pay', checkAdmin, async (req, res) => {
    try {
        const spin = await Spin.findByIdAndUpdate(
            req.params.id,
            { status: 'paid', paidAt: new Date(), txHash: req.body.txHash },
            { new: true }
        );
        if (!spin) return res.status(404).json({ error: 'Spin not found' });
        res.json({ success: true, spin });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update spin' });
    }
});

router.patch('/spin/:id/status', checkAdmin, async (req, res) => {
    try {
        const spin = await Spin.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status },
            { new: true }
        );
        if (!spin) return res.status(404).json({ error: 'Spin not found' });
        res.json({ success: true, spin });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update spin' });
    }
});

module.exports = router;
