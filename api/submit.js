import axios from 'axios';

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const { recaptcha_response, ...formData } = req.body;
    const SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

    if (!recaptcha_response) {
        return res.status(400).json({ success: false, error: 'reCAPTCHA token missing' });
    }

    try {
        // 1. Validate with Google reCAPTCHA v3
        const googleResponse = await axios.post(
            `https://www.google.com/recaptcha/api/siteverify?secret=${SECRET_KEY}&response=${recaptcha_response}`
        );

        const { success, score } = googleResponse.data;

        console.log('reCAPTCHA verification:', googleResponse.data);

        // Check if verification failed or if the score is too low (bot detection)
        if (!success || score < 0.5) {
            return res.status(403).json({
                success: false,
                error: 'Security verification failed (Bot detected or low score)',
                details: googleResponse.data
            });
        }

        // 2. Forward the validated data to n8n
        if (N8N_WEBHOOK_URL) {
            await axios.post(N8N_WEBHOOK_URL, {
                ...formData,
                recaptcha_score: score,
                verified_by_vercel: true
            });
        }

        // Return success message to the frontend
        return res.status(200).json({ success: true, message: 'Form submitted successfully' });

    } catch (error) {
        console.error('Vercel Function Error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
}
