/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'void': '#0f0f13',
                'stone': '#2a2a2e',
                'stream': '#1a1a1d',
                // Gravity colors
                'gravity': {
                    'low': '#22c55e',
                    'standard': '#f59e0b',
                    'high': '#ef4444',
                }
            },
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'pulse-slow': 'pulse 3s ease-in-out infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-20px)' },
                }
            },
            boxShadow: {
                'glow-green': '0 0 30px rgba(34, 197, 94, 0.3)',
                'glow-amber': '0 0 30px rgba(245, 158, 11, 0.3)',
                'glow-red': '0 0 30px rgba(239, 68, 68, 0.3)',
            }
        },
    },
    plugins: [],
}

