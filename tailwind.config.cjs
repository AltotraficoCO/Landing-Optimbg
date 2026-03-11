/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./thank-you.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                navy: '#16213e',
                'dark-grey': '#333333',
                'cta-orange': '#e97316',
                'cta-orange-hover': '#d96a14',
                'cta-green': '#16a34a',
                'cta-green-hover': '#15803d',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            keyframes: {
                'fade-up': {
                    '0%': { opacity: '0', transform: 'translateY(30px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'slide-in-left': {
                    '0%': { opacity: '0', transform: 'translateX(-30px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                'slide-in-right': {
                    '0%': { opacity: '0', transform: 'translateX(30px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                'pulse-glow': {
                    '0%, 100%': { boxShadow: '0 0 0 0 rgba(233, 115, 22, 0.4)' },
                    '50%': { boxShadow: '0 0 0 12px rgba(233, 115, 22, 0)' },
                },
            },
            animation: {
                'fade-up': 'fade-up 0.6s ease-out forwards',
                'slide-in-left': 'slide-in-left 0.6s ease-out forwards',
                'slide-in-right': 'slide-in-right 0.6s ease-out forwards',
                'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
            },
        },
    },
    plugins: [],
}
