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
      fontFamily: {
        sans: ['"Nunito Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Nunito', '"Nunito Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
