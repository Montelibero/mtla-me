# Montelibero Association Landing

Minimal multilingual landing page for the Montelibero Association.

## Project structure

```text
.
├── index.html             # Root redirect / noscript ({{{BUILD_*}}} filled by scripts/build.mjs)
├── template.html          # Shared HTML template for locale pages
├── assets/                # CSS and minimal client-side JS
├── i18n/
│   ├── links.json         # Shared external links used by locale content
│   └── */content.json     # Per-locale content source
├── documents/             # Source Markdown documents
├── scripts/
│   ├── build.mjs          # Static build to _site/
│   └── schema.mjs         # Content validation before render
├── _site/                 # Generated artifact
├── Dockerfile             # Container image for local preview
└── .github/workflows/     # GitHub Pages deployment
```

## How it works

- `scripts/build.mjs` renders locale pages from `template.html` and `i18n/*/content.json`, writes `_site/index.html` from `index.html` placeholders, copies `SKILL.md` to `/.well-known/agent-skills/<name>/SKILL.md`, and generates `.well-known/agent-skills/index.json` and `ai/summary.json`
- `documents/Agreement.en.md` and `documents/Agreement.ru.md` are rendered at build time and inlined into the locale HTML
- Shared repeated URLs live in `i18n/links.json`
- `scripts/schema.mjs` validates locale content before render and fails with field-level errors
- GitHub Pages deploys only the generated `_site/` artifact from the `v2` branch workflow

## Supported languages

- English (`en`)
- Russian (`ru`)
- Spanish (`es`)
- Montenegrin (`sr`)

## Development

```bash
npm ci
npm run build
./serve.sh
```

Then open `http://localhost:8080`.

## Deployment

- Push to the `v2` branch to trigger the GitHub Pages workflow
- Production uses the custom domain `mtla.me`
- The workflow builds `_site/` and uploads that artifact to Pages

Docker preview uses the same build output:

```bash
docker build -t mtla-landing .
docker run --rm -p 8080:80 mtla-landing
```

## License

This project is open source and available freely under the [MIT license](LICENSE.md).
