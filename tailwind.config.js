/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Hausfarbe – Navigation, Knöpfe, Akzente. Über CSS-Variablen gespeist,
        // damit die Akzentfarbe des Kunden zur Laufzeit übernommen werden kann
        // (Vorgaben: Petrol, siehe :root in src/index.css und src/lib/branding.ts).
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
        },
        /**
         * Die leiseste Textstufe auf hellem Grund.
         *
         * Vorher stand hier slate-400 (#94a3b8): 2.56:1 auf Weiss, nötig sind
         * 4.5:1 nach WCAG AA. Auch slate-500 reicht nicht – es hält zwar auf
         * Weiss (4.76:1), fällt aber auf dem grauen Seitengrund durch (4.34:1).
         * #5b6b7f hält auf allen drei Untergründen: weiss 5.45, Seitengrund
         * 4.97, stille Fläche 4.75.
         *
         * Im dunklen Rahmen (Navigation, Anmeldemaske) bleibt slate-400 –
         * helle Schrift auf dunklem Grund hat dort 5.7 bis 7.0:1.
         */
        /**
         * Die mittlere Textstufe auf hellem Grund: Untertitel, Erläuterungen.
         * slate-500 (#64748b) hielt knapp auf Weiss, fiel aber auf dem grauen
         * Seitengrund durch (4.34:1). #475569 hält überall: weiss 7.58,
         * Seitengrund 6.92, stille Fläche 6.61.
         */
        muted: '#475569',
        faint: '#5b6b7f',
        /**
         * Dasselbe eine Stufe leiser, aber auf dunklem Grund: Navigation,
         * Anmeldemaske, App-Kopf. Dort muss die Schrift heller werden, nicht
         * dunkler – #a0aec0 hält 7.91:1 auf slate-900, 6.49 auf slate-800
         * und 4.59 auf slate-700 (dem hellsten dort vorkommenden Grund).
         */
        'faint-dunkel': '#a0aec0',
        // Alarmrot bleibt dem Alarmieren vorbehalten: SOS, Auslöseknöpfe, aktive Alarme, Notruf
        alarm: {
          50: '#fff1f1',
          100: '#ffe0e0',
          200: '#fecaca',
          400: '#f87171',
          500: '#e02424',
          600: '#c81e1e',
          700: '#a31616',
        },
      },
    },
  },
  plugins: [],
}
