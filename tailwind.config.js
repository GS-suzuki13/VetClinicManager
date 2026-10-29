/** @type {import('tailwindcss').Config} */

// Identidade visual: verde-azulado (confiança + saúde, padrão em clínicas
// veterinárias), neutros levemente esverdeados e coral como destaque caloroso.
// As escalas substituem as cores padrão usadas nos componentes, então o tema
// muda sem alterar nenhum componente.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cor principal da marca (antes: emerald)
        emerald: {
          50: '#EEF8F7',
          100: '#D5EFEC',
          200: '#AEDFDA',
          300: '#7CC8C2',
          400: '#45A8A2',
          500: '#167C79',
          600: '#11625F',
          700: '#104F4D',
          800: '#0F403F',
          900: '#0E3534',
          950: '#062120',
        },
        // Neutros com leve tom verde-azulado (antes: slate)
        slate: {
          50: '#F5F8F7',
          100: '#ECF1F0',
          200: '#DCE4E3',
          300: '#C3CECD',
          400: '#8A9B99',
          500: '#5E716F',
          600: '#475957',
          700: '#354645',
          800: '#22312F',
          900: '#132628',
          950: '#0A1819',
        },
        // Destaque caloroso (antes: orange)
        orange: {
          50: '#FDF3F0',
          100: '#FBE3DC',
          200: '#F6C5B7',
          300: '#EEA08B',
          400: '#E07A5F',
          500: '#C44F33',
          600: '#A8402A',
          700: '#8A3524',
          800: '#6F2D20',
          900: '#5B281D',
          950: '#32120C',
        },
        // Azul calmo (antes: blue)
        blue: {
          50: '#EFF6FA',
          100: '#D9EAF4',
          200: '#B6D5EA',
          300: '#86B8DA',
          400: '#5394C3',
          500: '#2B73A6',
          600: '#225E8A',
          700: '#1E4D70',
          800: '#1C415D',
          900: '#1B384F',
          950: '#112334',
        },
      },
      // Animações curtas (150–250 ms): entrada de modais, páginas e avisos.
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'modal-in': { from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        'modal-out': { from: { opacity: '1', transform: 'translateY(0) scale(1)' }, to: { opacity: '0', transform: 'translateY(8px) scale(0.98)' } },
        'sheet-in': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'sheet-out': { from: { transform: 'translateY(0)' }, to: { transform: 'translateY(100%)' } },
        'page-in': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'toast-in': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'fade-out': 'fade-out 160ms ease-in forwards',
        'modal-in': 'modal-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'modal-out': 'modal-out 160ms ease-in forwards',
        'sheet-in': 'sheet-in 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        'sheet-out': 'sheet-out 180ms ease-in forwards',
        'page-in': 'page-in 220ms ease-out',
        'toast-in': 'toast-in 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
      fontFamily: {
        sans: ['"Nunito Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Nunito', '"Nunito Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
