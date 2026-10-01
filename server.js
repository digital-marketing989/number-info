const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const API_BASE = process.env.API_BASE;

app.use(cors());
app.use(express.json());
app.use(express.static('../frontend')); // serve frontend

// Health check
app.get('/', (req, res) => {
    res.send('Number Lookup API is running ✅');
});

// Search endpoint
app.get('/api/search/:number', async (req, res) => {
    const { number } = req.params;

    // Validate 10 digit Indian mobile number
    if (!/^[6-9]\d{9}$/.test(number)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid number. 10 digit Indian mobile number daalein (6-9 se start).'
        });
    }

    try {
        const response = await axios.get(`${API_BASE}/${number}`, {
            timeout: 15000,
            headers: { 'Accept': 'application/json' }
        });

        // Remove duplicate results (same aadhar + mobile)
        const data = response.data;
        if (data && Array.isArray(data.results)) {
            const seen = new Set();
            data.results = data.results.filter(r => {
                const key = `${r.mobile}-${r.aadhar}-${r.name}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            data.total = data.results.length;
        }

        return res.json(data);

    } catch (err) {
        console.error('API Error:', err.message);

        if (err.response) {
            return res.status(err.response.status).json({
                success: false,
                error: 'Upstream API error',
                details: err.response.data
            });
        }
        return res.status(500).json({
            success: false,
            error: 'Server error. Baad mein try karein.'
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Backend running on http://localhost:${PORT}`);
});