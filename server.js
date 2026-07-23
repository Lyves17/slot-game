require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let dbConnected = false;

if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => { dbConnected = true; console.log('MongoDB connected'); })
        .catch(err => { console.error('MongoDB error:', err.message); console.log('Running without database - spins will not be saved'); });
} else {
    console.log('No MONGODB_URI - running without database');
}

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', db: dbConnected });
});

const spinRoutes = require('./routes/spin');
const adminRoutes = require('./routes/admin');

app.use('/api', spinRoutes);
app.use('/api/admin', adminRoutes);

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
