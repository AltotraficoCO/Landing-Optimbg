import './style.css'

// Configuration from environment variables
const API_URL = import.meta.env.VITE_API_URL || '/api/submit';
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LcyMmEsAAAAAJgYFByDy9TaBVloslKj-dufEZYV';

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

    // Observe all animated elements
    const animatedElements = document.querySelectorAll('.fade-in-section, .slide-in-left, .slide-in-right, .scale-in');
    animatedElements.forEach(el => {
        observer.observe(el);
    });

    // Form Handler - Select all forms with the class
    const forms = document.querySelectorAll('.js-contact-form');
    forms.forEach(form => {
        form.addEventListener('submit', handleFormSubmit);
    });

    // Phone mask: auto-format as (XXX) XXX-XXXX
    document.querySelectorAll('.js-phone-mask').forEach(input => {
        input.addEventListener('input', (e) => {
            let digits = e.target.value.replace(/\D/g, '').slice(0, 10);
            let formatted = '';
            if (digits.length > 0) formatted = '(' + digits.slice(0, 3);
            if (digits.length >= 3) formatted += ') ' + digits.slice(3, 6);
            if (digits.length >= 6) formatted += '-' + digits.slice(6);
            e.target.value = formatted;
        });
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // Header shadow on scroll
    const header = document.getElementById('site-header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 10) {
                header.classList.add('shadow-md');
                header.classList.remove('shadow-sm');
            } else {
                header.classList.remove('shadow-md');
                header.classList.add('shadow-sm');
            }
        }, { passive: true });
    }
});

/**
 * Execute reCAPTCHA v3 and get token
 * @returns {Promise<string>} reCAPTCHA token
 */
async function executeRecaptcha() {
    return new Promise((resolve, reject) => {
        if (typeof grecaptcha === 'undefined' || !grecaptcha.enterprise) {
            reject(new Error('reCAPTCHA not loaded'));
            return;
        }

        grecaptcha.enterprise.ready(() => {
            grecaptcha.enterprise.execute(RECAPTCHA_SITE_KEY, { action: 'submit_form' })
                .then(token => resolve(token))
                .catch(err => reject(err));
        });
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalButtonText = submitBtn.textContent;

    // Clear previous status if it exists
    const statusDiv = form.querySelector('.form-status');
    if (statusDiv) {
        statusDiv.textContent = '';
        statusDiv.classList.add('hidden');
    }

    // 1. Validate Form Fields
    const nameInput = form.querySelector('input[type="text"]');
    const name = nameInput ? nameInput.value.trim() : '';

    const emailInput = form.querySelector('input[type="email"]');
    const email = emailInput ? emailInput.value.trim() : '';

    if (!name) {
        showStatus(form, 'Please enter your full name.', 'text-red-600');
        nameInput.focus();
        return;
    }

    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

    if (!emailRegex.test(email)) {
        showStatus(form, 'Please enter a valid email address.', 'text-red-600');
        return;
    }

    // 2. Validate US Phone Number (10 digits)
    const phoneInput = form.querySelector('input[type="tel"]');
    const rawPhone = phoneInput ? phoneInput.value : '';
    const cleanPhone = rawPhone.replace(/\D/g, '');

    // Check if it's exactly 10 digits (US Standard)
    if (cleanPhone.length !== 10) {
        showStatus(form, 'Please enter a valid 10-digit US phone number (e.g. 813 555 1234).', 'text-red-600');
        phoneInput.focus();
        return;
    }

    // 3. Validate Terms and Conditions
    const termsCheckbox = form.querySelector('input[type="checkbox"]');
    if (!termsCheckbox || !termsCheckbox.checked) {
        showStatus(form, 'You must agree to the Terms & Conditions and Privacy Policy to continue.', 'text-red-600');
        return;
    }

    // Disable button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
        // 2. Get reCAPTCHA v3 token
        const recaptchaToken = await executeRecaptcha();

        // 3. Collect Data & UTMs
        const serviceSelect = form.querySelector('select[name="service_needed"]');
        const formData = {
            name: name,
            phone: cleanPhone,
            email: email,
            project_description: form.querySelector('textarea')?.value?.trim() || 'Not provided',
            service_needed: serviceSelect ? serviceSelect.value : '',
            b_phone: form.querySelector('input[name="b_phone"]')?.value || '', // Honeypot
            terms_accepted: true,
            recaptcha_response: recaptchaToken,
            utm_source: getQueryParam('utm_source'),
            utm_medium: getQueryParam('utm_medium'),
            utm_campaign: getQueryParam('utm_campaign'),
            utm_term: getQueryParam('utm_term'),
            utm_content: getQueryParam('utm_content')
        };

        // 4. Send to Webhook
        if (!API_URL) {
            throw new Error('API URL not configured');
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(formData)
        });

        const contentType = response.headers.get("content-type");
        const result = (contentType && contentType.includes("application/json")) ? await response.json() : {};

        if (response.ok) {
            form.reset();
            window.location.href = '/thank-you';
        } else {
            const errorMessage = result.error || 'Server error';
            throw new Error(errorMessage);
        }
    } catch (error) {
        if (error.message === 'API URL not configured') {
            showStatus(form, 'Configuration Error: API URL not set.', 'text-orange-600');
        } else if (error.message === 'reCAPTCHA not loaded') {
            showStatus(form, 'Security verification failed. Please refresh and try again.', 'text-red-600');
        } else {
            showStatus(form, error.message || 'Something went wrong. Please try again or call us directly.', 'text-red-600');
        }
        console.error('Submission Error:', error);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalButtonText;
    }
}

function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name) || '';
}

function showStatus(formElement, message, colorClass) {
    let statusDiv = formElement.querySelector('.form-status');

    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.className = 'form-status text-center text-sm font-medium hidden mt-4';
        formElement.appendChild(statusDiv);
    }

    statusDiv.textContent = message;
    statusDiv.className = `form-status text-center text-sm font-medium ${colorClass} fade-in-section is-visible mt-4`;
    statusDiv.classList.remove('hidden');
}
