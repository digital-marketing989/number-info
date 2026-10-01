const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
// Directly hardcode the target API URL here if env is missing on Vercel
const API_BASE = process.env.API_BASE || 'https://lynx.mireiariosss.workers.dev/api/search';

app.use(cors());
app.use(express.json());

// Serve static frontend files (HTML, CSS, JS) from the current directory
app.use(express.static(__dirname));

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
            headers: { 'Accept': 'application/json' },
            responseType: 'text'   // get raw text so we can clean it
        });

        // Clean trailing text if any
        const rawText = response.data;
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return res.status(502).json({ success: false, error: 'API ne invalid response diya.' });
        }
        const data = JSON.parse(jsonMatch[0]);

        // Remove duplicate results (same aadhar + mobile + name)
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

// Root URL par index.html fallback
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server only if we're not running on Vercel
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Backend running on http://localhost:${PORT}`);
    });
}

// Export for Vercel serverless function
module.exports = app;
