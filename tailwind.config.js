/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./features/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
      },
      screens: {
        "2xl": "1280px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-vazirmatn)", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        status: {
          normal: {
            DEFAULT: "hsl(var(--status-normal))",
            bg: "hsl(var(--status-normal-bg))",
            border: "hsl(var(--status-normal-border))",
          },
          low: {
            DEFAULT: "hsl(var(--status-low))",
            bg: "hsl(var(--status-low-bg))",
            border: "hsl(var(--status-low-border))",
          },
          high: {
            DEFAULT: "hsl(var(--status-high))",
            bg: "hsl(var(--status-high-bg))",
            border: "hsl(var(--status-high-border))",
          },
          critical: {
            DEFAULT: "hsl(var(--status-critical))",
            bg: "hsl(var(--status-critical-bg))",
            border: "hsl(var(--status-critical-border))",
          },
          superseded: {
            DEFAULT: "hsl(var(--status-superseded))",
            bg: "hsl(var(--status-superseded-bg))",
            border: "hsl(var(--status-superseded-border))",
          },
        },
        order: {
          pending: {
            DEFAULT: "hsl(var(--order-pending))",
            bg: "hsl(var(--order-pending-bg))",
          },
          received: {
            DEFAULT: "hsl(var(--order-received))",
            bg: "hsl(var(--order-received-bg))",
          },
          in_progress: {
            DEFAULT: "hsl(var(--order-in-progress))",
            bg: "hsl(var(--order-in-progress-bg))",
          },
          completed: {
            DEFAULT: "hsl(var(--order-completed))",
            bg: "hsl(var(--order-completed-bg))",
          },
          cancelled: {
            DEFAULT: "hsl(var(--order-cancelled))",
            bg: "hsl(var(--order-cancelled-bg))",
          },
        },
        prescription: {
          active: {
            DEFAULT: "hsl(var(--prescription-active))",
            bg: "hsl(var(--prescription-active-bg))",
          },
          completed: {
            DEFAULT: "hsl(var(--prescription-completed))",
            bg: "hsl(var(--prescription-completed-bg))",
          },
          cancelled: {
            DEFAULT: "hsl(var(--prescription-cancelled))",
            bg: "hsl(var(--prescription-cancelled-bg))",
          },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "spinner-spin": {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "spinner-spin": "spinner-spin 1.4s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
