import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages sirve el sitio en usuario.github.io/nombre-del-repo/ -- si
  // llamás al repositorio distinto a "mi-cartera", cambiá esto para que coincida.
  base: '/mi-cartera/',
})
