import axios from 'axios';

const PROJECT_ID = 'project-1770249920629';
const SITE_KEY = '6LcyMmEsAAAAAJgYFByDy9TaBVloslKj-dufEZYV';

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const { recaptcha_response, ...formData } = req.body;
    const API_KEY = process.env.RECAPTCHA_API_KEY?.trim();
    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

    if (!API_KEY) {
        return res.status(500).json({ success: false, error: 'Config Error: RECAPTCHA_API_KEY is missing in Vercel' });
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
        // 1. Validate with Google reCAPTCHA Enterprise
        const assessmentUrl = `https://recaptchaenterprise.googleapis.com/v1/projects/${PROJECT_ID}/assessments?key=${API_KEY}`;

        const googleResponse = await axios.post(assessmentUrl, {
            event: {
                token: recaptcha_response,
                expectedAction: 'submit_form',
                siteKey: SITE_KEY
            }
        });

        const { tokenProperties, riskAnalysis } = googleResponse.data;
        const score = riskAnalysis?.score ?? 0;

        console.log('reCAPTCHA Enterprise verification:', googleResponse.data);

        // Check if token is valid
        if (!tokenProperties?.valid) {
            const reason = tokenProperties?.invalidReason || 'unknown';
            return res.status(403).json({
                success: false,
                error: `Security verification failed (Invalid token: ${reason})`
            });
        }

        // Check if the action matches
        if (tokenProperties.action !== 'submit_form') {
            return res.status(403).json({
                success: false,
                error: `Security verification failed (Action mismatch: ${tokenProperties.action})`
            });
        }

        // Check if the score is too low (bot detection)
        if (score < 0.5) {
            return res.status(403).json({
                success: false,
                error: `Security verification failed (Low Score: ${score}, threshold 0.5)`
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
        console.error('Vercel Function Error:', error.response?.data || error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
}
