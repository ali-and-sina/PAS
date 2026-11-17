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
    screens: {
      sm: "40rem",
      md: "48rem",
      lg: "64rem",
      xl: "80rem",
      "2xl": "96rem",
    },
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
      },
      screens: {
        "2xl": "80rem",
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
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          bg: "hsl(var(--success-bg))",
          border: "hsl(var(--success-border))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          bg: "hsl(var(--warning-bg))",
          border: "hsl(var(--warning-border))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          bg: "hsl(var(--info-bg))",
          border: "hsl(var(--info-border))",
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
      fontSize: {
        xs: ["var(--font-size-xs)", { lineHeight: "var(--line-height-xs)", letterSpacing: "var(--letter-spacing-xs)" }],
        sm: ["var(--font-size-sm)", { lineHeight: "var(--line-height-sm)", letterSpacing: "var(--letter-spacing-sm)" }],
        base: ["var(--font-size-base)", { lineHeight: "var(--line-height-base)", letterSpacing: "var(--letter-spacing-base)" }],
        lg: ["var(--font-size-lg)", { lineHeight: "var(--line-height-lg)", letterSpacing: "var(--letter-spacing-lg)" }],
        xl: ["var(--font-size-xl)", { lineHeight: "var(--line-height-xl)", letterSpacing: "var(--letter-spacing-xl)" }],
        "2xl": ["var(--font-size-2xl)", { lineHeight: "var(--line-height-2xl)", letterSpacing: "var(--letter-spacing-2xl)" }],
        "3xl": ["var(--font-size-3xl)", { lineHeight: "var(--line-height-3xl)", letterSpacing: "var(--letter-spacing-3xl)" }],
        "4xl": ["var(--font-size-4xl)", { lineHeight: "var(--line-height-4xl)", letterSpacing: "var(--letter-spacing-4xl)" }],
      },
      spacing: {
        "pas-1": "var(--space-1)",
        "pas-2": "var(--space-2)",
        "pas-3": "var(--space-3)",
        "pas-4": "var(--space-4)",
        "pas-5": "var(--space-5)",
        "pas-6": "var(--space-6)",
        "pas-8": "var(--space-8)",
        "pas-10": "var(--space-10)",
        "pas-12": "var(--space-12)",
        "pas-16": "var(--space-16)",
        "pas-20": "var(--space-20)",
        "pas-24": "var(--space-24)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        "pas-1": "var(--shadow-1)",
        "pas-2": "var(--shadow-2)",
        "pas-3": "var(--shadow-3)",
        "pas-4": "var(--shadow-4)",
      },
      zIndex: {
        sticky: "var(--z-sticky)",
        dropdown: "var(--z-dropdown)",
        overlay: "var(--z-overlay)",
        modal: "var(--z-modal)",
        toast: "var(--z-toast)",
        tooltip: "var(--z-tooltip)",
      },
      transitionDuration: {
        "pas-fast": "var(--motion-1)",
        "pas-ui": "var(--motion-2)",
        "pas-panel": "var(--motion-3)",
        "pas-slow": "var(--motion-4)",
      },
      transitionTimingFunction: {
        "pas-standard": "var(--motion-ease-standard)",
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
