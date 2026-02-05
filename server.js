import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files from the 'dist' directory after build
app.use(express.static(path.join(__dirname, 'dist')));

/**
 * Handle form submission with reCAPTCHA validation
 */
app.post('/api/submit', async (req, res) => {
    const { recaptcha_response, ...formData } = req.body;
    const SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || process.env.VITE_WEBHOOK_URL;

    if (!recaptcha_response) {
        return res.status(400).json({ success: false, error: 'reCAPTCHA token missing' });
    }

    try {
        // 1. Validate with Google
        const googleResponse = await axios.post(
            `https://www.google.com/recaptcha/api/siteverify?secret=${SECRET_KEY}&response=${recaptcha_response}`
        );

        const { success, score } = googleResponse.data;

        console.log('reCAPTCHA verification:', googleResponse.data);

        if (!success || score < 0.5) {
            return res.status(403).json({
                success: false,
                error: 'Security verification failed (Bot detected or low score)',
                details: googleResponse.data
            });
        }

        // 2. If valid, forward to n8n (optional but recommended to keep existing flow)
        if (N8N_WEBHOOK_URL) {
            await axios.post(N8N_WEBHOOK_URL, {
                ...formData,
                recaptcha_score: score,
                verified: true
            });
        }

        res.json({ success: true, message: 'Form submitted successfully' });

    } catch (error) {
        console.error('Server error:', error.message);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Fallback to index.html for SPA behavior or if manual access
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
