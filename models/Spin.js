const mongoose = require('mongoose');

const SpinSchema = new mongoose.Schema({
    walletAddress: { type: String, required: true, index: true },
    betAmount: { type: Number, required: true },
    activeLines: { type: Number, required: true },
    totalBet: { type: Number, required: true },
    grid: [[String]],
    totalWin: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    isWin: { type: Boolean, default: false },
    lineWins: [{ paylineId: Number, symbols: [String], symbol: String, count: Number, multiplier: Number, winAmount: Number }],
    serverSeed: { type: String, required: true },
    serverSeedHash: { type: String, required: true },
    clientSeed: { type: String, required: true },
    nonce: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'confirmed', 'paid', 'disputed'], default: 'pending' },
    paidAt: Date,
    txHash: String,
}, { timestamps: true });

module.exports = mongoose.model('Spin', SpinSchema);
