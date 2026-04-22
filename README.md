# Montelibero Association Landing

Minimal multilingual landing page for the Montelibero Association.

## Project structure

```text
.
├── index.html             # Root language redirect / noscript chooser
├── template.html          # Shared HTML template for locale pages
├── assets/                # CSS and minimal client-side JS
├── i18n/*/content.json    # Per-locale content source
├── documents/             # Source Markdown documents
├── scripts/build.mjs      # Static build to _site/
├── _site/                 # Generated artifact
├── Dockerfile             # Container image for local preview
└── .github/workflows/     # GitHub Pages deployment
```

## How it works

- `scripts/build.mjs` renders locale pages from `template.html` and `i18n/*/content.json`
- `documents/Agreement.en.md` and `documents/Agreement.ru.md` are rendered at build time and inlined into the locale HTML
- GitHub Pages deploys only the generated `_site/` artifact
- The root page redirects by browser language when JavaScript is enabled and shows manual links in `<noscript>`

## Supported languages

- 🇬🇧 English (en)
- 🇷🇺 Russian (ru)
- 🇪🇸 Spanish (es)
- 🇲🇪 Montenegrin (sr)

## Features

- ✅ Static output for GitHub Pages
- ✅ Minimal runtime JS
- ✅ Auto language detection by browser settings
- ✅ Build-time Agreement rendering
- ✅ NoScript friendly
- ✅ Responsive design
- ✅ Auto-deployment to GitHub Pages
- ✅ Docker/local preview from the same `_site` artifact

## Development

```bash
npm ci
npm run build

# Preview the generated site
./serve.sh

# Then open http://localhost:8080
```

Docker preview uses the same build output:

```bash
docker build -t mtla-landing .
docker run --rm -p 8080:80 mtla-landing
```

## License

This project is open source and available freely under the [MIT license](LICENSE.md).
