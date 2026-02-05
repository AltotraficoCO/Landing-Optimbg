import './style.css'

// Configuration from environment variables
const WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL || '';
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

// Store reCAPTCHA widget IDs for multiple forms
const recaptchaWidgets = new Map();

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

    // Initialize reCAPTCHA widgets for each form
    initRecaptchaWidgets();

    // Form Handler - Select all forms with the class
    const forms = document.querySelectorAll('.js-contact-form');
    forms.forEach(form => {
        form.addEventListener('submit', handleFormSubmit);
    });
});

/**
 * Initialize reCAPTCHA widgets for each form
 * This handles multiple reCAPTCHA instances on the same page
 */
function initRecaptchaWidgets() {
    // Wait for grecaptcha to be ready
    if (typeof grecaptcha === 'undefined' || !grecaptcha.render) {
        // If grecaptcha is not ready, wait and retry
        setTimeout(initRecaptchaWidgets, 100);
        return;
    }

    const recaptchaContainers = document.querySelectorAll('.g-recaptcha');
    recaptchaContainers.forEach((container, index) => {
        // Skip if already rendered
        if (container.hasChildNodes()) {
            return;
        }

        // Create unique ID for the container
        const containerId = `recaptcha-widget-${index}`;
        container.id = containerId;

        // Render the widget and store its ID
        try {
            const widgetId = grecaptcha.render(containerId, {
                'sitekey': RECAPTCHA_SITE_KEY
            });

            // Associate widget ID with the parent form
            const form = container.closest('form');
            if (form) {
                recaptchaWidgets.set(form, widgetId);
            }
        } catch (error) {
            console.error('Error rendering reCAPTCHA:', error);
        }
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalButtonText = submitBtn.textContent; // Preserve original text

    // Clear previous status if it exists
    const statusDiv = form.querySelector('.form-status');
    if (statusDiv) {
        statusDiv.textContent = '';
        statusDiv.classList.add('hidden');
    }

    // 1. Validate Email (Scoped to the current form)
    const emailInput = form.querySelector('input[type="email"]');
    const email = emailInput ? emailInput.value : '';

    // Strict email regex: ensure @ and . present, no spaces, standard structure
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

    if (!emailRegex.test(email)) {
        showStatus(form, 'Please enter a valid email address.', 'text-red-600');
        return;
    }

    // 2. Validate reCAPTCHA (using the correct widget ID for this form)
    const widgetId = recaptchaWidgets.get(form);
    let recaptchaResponse = '';

    if (typeof grecaptcha !== 'undefined') {
        recaptchaResponse = widgetId !== undefined
            ? grecaptcha.getResponse(widgetId)
            : grecaptcha.getResponse();
    }

    if (!recaptchaResponse) {
        showStatus(form, 'Please complete the reCAPTCHA verification.', 'text-red-600');
        return;
    }

    // 3. Collect Data & UTMs
    const formData = {
        name: form.querySelector('input[type="text"]').value,
        phone: form.querySelector('input[type="tel"]').value,
        email: email,
        project_description: form.querySelector('textarea')?.value || 'Not provided',
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
    try {
        if (!WEBHOOK_URL) {
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
            showStatus(form, 'Thanks! Your request has been sent successfully.', 'text-green-600');
            form.reset();
            // Reset the correct reCAPTCHA widget
            if (typeof grecaptcha !== 'undefined' && widgetId !== undefined) {
                grecaptcha.reset(widgetId);
            } else if (typeof grecaptcha !== 'undefined') {
                grecaptcha.reset();
            }
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        if (error.message === 'Webhook URL not configured') {
            showStatus(form, 'Configuration Error: Webhook URL not set', 'text-orange-600');
        } else {
            showStatus(form, 'Something went wrong. Please try again later.', 'text-red-600');
        }
        console.error('Submission Error:', error);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalButtonText; // Restore original text
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
