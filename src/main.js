import './style.css'

// Animation Observer
document.addEventListener('DOMContentLoaded', () => {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const sections = document.querySelectorAll('.fade-in-section');
    sections.forEach(section => {
        observer.observe(section);
    });

    // Form Handler - Select all forms with the class
    const forms = document.querySelectorAll('.js-contact-form');
    forms.forEach(form => {
        form.addEventListener('submit', handleFormSubmit);
    });
});

async function handleFormSubmit(e) {
    e.preventDefault();
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');

    // Clear previous status if it exists
    const statusDiv = e.target.querySelector('.form-status');
    if (statusDiv) {
        statusDiv.textContent = '';
        statusDiv.classList.add('hidden');
    }

    // 1. Validate Email (Scoped to the current form)
    const emailInput = e.target.querySelector('input[type="email"]');
    const email = emailInput ? emailInput.value : '';

    // Strict email regex: ensure @ and . present, no spaces, standard structure
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

    if (!emailRegex.test(email)) {
        showStatus(e.target, 'Please enter a valid email address.', 'text-red-600');
        return;
    }

    // 2. Validate reCAPTCHA
    const recaptchaResponse = grecaptcha.getResponse();
    if (!recaptchaResponse) {
        showStatus(e.target, 'Please complete the reCAPTCHA verification.', 'text-red-600');
        return;
    }

    // 3. Collect Data & UTMs
    const formData = {
        name: e.target.querySelector('input[type="text"]').value,
        phone: e.target.querySelector('input[type="tel"]').value,
        email: email,
        project_description: e.target.querySelector('textarea')?.value || 'Not provided',
        recaptcha_token: recaptchaResponse,
        utm_source: getQueryParam('utm_source'),
        utm_medium: getQueryParam('utm_medium'),
        utm_campaign: getQueryParam('utm_campaign'),
        utm_term: getQueryParam('utm_term'),
        utm_content: getQueryParam('utm_content')
    };

    // Disable button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    // 4. Send to Webhook
    // Placeholder URL - User needs to replace this
    const WEBHOOK_URL = 'https://altotrafico-iav1-n8n.tmdjra.easypanel.host/webhook/35739b9e-f443-4a8f-8d75-9e32f6816b6a';

    try {
        if (WEBHOOK_URL === 'YOUR_WEBHOOK_URL_HERE') {
            throw new Error('Webhook URL not configured');
        }

        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            showStatus(e.target, 'Thanks! Your request has been sent successfully.', 'text-green-600');
            e.target.reset();
            grecaptcha.reset();
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        if (error.message === 'Webhook URL not configured') {
            showStatus(e.target, 'Configuration Error: Webhook URL not set', 'text-orange-600');
        } else {
            showStatus(e.target, 'Something went wrong. Please try again later.', 'text-red-600');
        }
        console.error('Submission Error:', error);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Request';
    }
}

function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name) || '';
}

function showStatus(formElement, message, colorClass) {
    // Find the status div specifically within or near the submitted form
    let statusDiv = formElement.querySelector('.form-status');

    // If it doesn't exist, create it dynamically
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.className = 'form-status text-center text-sm font-medium hidden mt-4';
        formElement.appendChild(statusDiv);
    }

    statusDiv.textContent = message;
    statusDiv.className = `form-status text-center text-sm font-medium ${colorClass} fade-in-section is-visible mt-4`;
    statusDiv.classList.remove('hidden');
}
