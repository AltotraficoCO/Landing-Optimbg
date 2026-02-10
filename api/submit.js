import axios from 'axios';

const PROJECT_ID = 'project-1770249920629';
const SITE_KEY = '6LcyMmEsAAAAAJgYFByDy9TaBVloslKj-dufEZYV';

// Security Helper: Sanitize input strings
function sanitize(str, maxLength = 1000) {
    if (typeof str !== 'string') return '';
    return str
        .trim()
        .slice(0, maxLength)
        .replace(/[&<>"'/]/g, (m) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;'
        })[m]);
}

export default async function handler(req, res) {
    // 1. Strict Protocol & Method check
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    // 2. Origin/Referer verification
    const allowedOrigins = [
        'https://landing-optimbg.vercel.app',
        'https://optimbuildgroup.com',
        'https://landing.optimbuild.com',
        'http://localhost:5173',
        'http://localhost:3000'
    ];
    const origin = req.headers.origin || req.headers.referer || '';

    // Improved origin check: Allow official domains, localhost, and Vercel preview domains
    const isAllowed = allowedOrigins.some(ao => origin.startsWith(ao)) ||
        origin.endsWith('.vercel.app') ||
        process.env.NODE_ENV === 'development';

    if (!isAllowed && origin) {
        console.warn('Security Warning: Blocked request from unauthorized origin:', origin);
        return res.status(403).json({ success: false, error: 'Unauthorized origin: ' + origin });
    }

    // 3. Honeypot check (Bot detection)
    const { recaptcha_response, b_phone, ...rawData } = req.body;
    if (b_phone) {
        console.warn('Security Warning: Honeypot field filled. Probable bot detected.');
        return res.status(403).json({ success: false, error: 'Security verification failed' });
    }

    // 4. Configuration validation
    const API_KEY = process.env.RECAPTCHA_API_KEY?.trim();
    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

    if (!API_KEY || !N8N_WEBHOOK_URL) {
        console.error('Config Error: Missing environment variables');
        return res.status(500).json({ success: false, error: 'Service temporarily unavailable' });
    }

    if (!recaptcha_response) {
        return res.status(400).json({ success: false, error: 'Security token missing' });
    }

    // 5. Input Sanitization & Strict Validation
    const name = sanitize(rawData.name, 100);
    const email = sanitize(rawData.email, 100);
    const phone = (rawData.phone || '').replace(/\D/g, '').slice(0, 15);
    const project_description = sanitize(rawData.project_description, 2000);

    if (!name || name.length < 2) {
        return res.status(400).json({ success: false, error: 'A valid name is required' });
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email) || email.length > 100) {
        return res.status(400).json({ success: false, error: 'A valid email is required' });
    }

    if (phone.length !== 10) {
        return res.status(400).json({ success: false, error: 'A valid 10-digit US phone number is required' });
    }

    try {
        // 6. Validate with Google reCAPTCHA Enterprise
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

        // Check if token is valid
        if (!tokenProperties?.valid || tokenProperties.action !== 'submit_form') {
            console.error('reCAPTCHA validation failed:', tokenProperties?.invalidReason || 'mismatched action');
            return res.status(403).json({ success: false, error: 'Security verification failed' });
        }

        // Bot score threshold
        if (score < 0.5) {
            console.warn('reCAPTCHA low score:', score);
            return res.status(403).json({ success: false, error: 'Security verification failed' });
        }

        // 7. Forward sanitized data to n8n
        await axios.post(N8N_WEBHOOK_URL, {
            name,
            email,
            phone,
            project_description,
            utm_source: sanitize(rawData.utm_source, 100),
            utm_medium: sanitize(rawData.utm_medium, 100),
            utm_campaign: sanitize(rawData.utm_campaign, 100),
            utm_term: sanitize(rawData.utm_term, 100),
            utm_content: sanitize(rawData.utm_content, 100),
            timestamp: new Date().toISOString(),
            security_score: score
        });

        return res.status(200).json({ success: true, message: 'Form submitted successfully' });

    } catch (error) {
        console.error('Form Processing Error:', error.message);
        // Generic error message for client to prevent info leakage
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
}
