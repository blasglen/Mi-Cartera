# Mi Cartera

Dashboard de inversiones — acciones, CEDEARs, bonos y fondos, con datos importados de Balanz, IOL y Bull Market.

## Correr en local

```bash
npm install
npm run dev
```

Abre en `http://localhost:5173`.

## Desplegar gratis con GitHub Pages (no hace falta ninguna otra cuenta)

1. Subí este proyecto a un repositorio de GitHub llamado **mi-cartera** (si le ponés otro
   nombre, cambiá el `base` en `vite.config.js` para que coincida).
2. En el repo, andá a **Settings > Pages**. En "Build and deployment", elegí como
   Source: **GitHub Actions**.
3. Listo — el workflow en `.github/workflows/deploy.yml` ya está armado. Cada vez que
   subas un cambio a la rama `main`, GitHub compila el proyecto solo y lo publica.
4. Tu URL va a quedar en `https://tu-usuario.github.io/mi-cartera/` (tarda 1-2 minutos
   la primera vez).

## Alternativa: Vercel

Si preferís que compile y despliegue sin tocar ninguna configuración (útil si vas a
tener un backend más adelante), Vercel también funciona: conectás tu cuenta de GitHub,
importás el repo, y detecta Vite automáticamente. Ahí no hace falta el `base` de
`vite.config.js` (podés dejarlo en `/`).

## Estructura

- `src/App.jsx` — el dashboard completo (única pieza de la app por ahora)
- `.github/workflows/deploy.yml` — el workflow que compila y publica en GitHub Pages
- Los datos de tenencias y movimientos están hardcodeados en `App.jsx` (constantes
  `HOLDINGS` y `MOVIMIENTOS`) — el próximo paso es mover esto a un backend con base de
  datos para poder subir nuevos exports sin tocar código.
