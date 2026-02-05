import axios from 'axios';

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const { recaptcha_response, ...formData } = req.body;
    const SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY?.trim();
    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

    if (!SECRET_KEY) {
        return res.status(500).json({ success: false, error: 'Config Error: Secret Key is missing in Vercel' });
    }

    if (!N8N_WEBHOOK_URL) {
        return res.status(500).json({ success: false, error: 'Config Error: Webhook URL is missing in Vercel' });
    }

    if (!recaptcha_response) {
        return res.status(400).json({ success: false, error: 'reCAPTCHA token missing' });
    }

    // Validate required form fields
    const { name, email, phone } = formData;

    if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ success: false, error: 'A valid email is required' });
    }

    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
        return res.status(400).json({ success: false, error: 'A valid 10-digit US phone number is required' });
    }

    try {
        // 1. Validate with Google reCAPTCHA v3
        const params = new URLSearchParams();
        params.append('secret', SECRET_KEY);
        params.append('response', recaptcha_response);

        const googleResponse = await axios.post(
            'https://www.google.com/recaptcha/api/siteverify',
            params,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const { success, score } = googleResponse.data;

        console.log('reCAPTCHA verification:', googleResponse.data);

        // Check if verification failed or if the score is too low (bot detection)
        if (!success || score < 0.5) {
            const errorReason = !success
                ? `Google Error: ${googleResponse.data['error-codes']?.join(', ') || 'unknown'}`
                : `Low Score: ${score} (threshold 0.5)`;

            return res.status(403).json({
                success: false,
                error: `Security verification failed (${errorReason})`,
                details: googleResponse.data
            });
        }

        // 2. Forward the validated data to n8n
        await axios.post(N8N_WEBHOOK_URL, {
            ...formData,
            phone: cleanPhone,
            recaptcha_score: score,
            verified_by_vercel: true
        });

        // Return success message to the frontend
        return res.status(200).json({ success: true, message: 'Form submitted successfully' });

    } catch (error) {
        console.error('Vercel Function Error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
}
