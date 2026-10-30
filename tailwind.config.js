/** @type {import('tailwindcss').Config} */
module.exports = {
  // ai/index.html is the second page. It shares assets/output.css, so it has to
  // be scanned here or its own utilities are tree-shaken away by the build.
  content: ['./*.html', './ai/*.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'Liberation Mono',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
}
