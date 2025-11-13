# Montelibero Association Landing

Minimal multilingual landing page for Montelibero Association without dependencies.

## Project structure

```
.
├── index.html             # Main page with language selection
├── assets/
│   ├── app.js             # JavaScript: language + Markdown
│   └── style.css          # Styles
├── i18n/
│   ├── en/index.html      # English version
│   ├── ru/index.html      # Russian version
│   ├── es/index.html      # Spanish version
│   └── sr/index.html      # Montenegrin version
├── documents/
│   ├── Agreement.en.md    # MTLA Agreement in English
│   └── Agreement.ru.md    # MTLA Agreement in Russian
├── Dockerfile             # Docker image (nginx:alpine)
├── docker-compose.yml     # Docker Compose configuration
└── .github/
    └── workflows/
        └── deploy.yml     # GitHub Actions for auto-deployment
```

## How it works

### Language selection

1. **With JavaScript**: automatic redirect to browser language
2. **Without JavaScript**: links for manual language selection
3. **On pages**: pure CSS dropdown menu for switching

### Markdown loading

- **With JavaScript**: `Agreement.*.md` files are loaded and converted to HTML with built-in parser
- **Without JavaScript**: attempt to load via <object>, link to GitHub for viewing source

## Supported languages

- 🇬🇧 English (en)
- 🇷🇺 Russian (ru)
- 🇪🇸 Spanish (es)
- 🇲🇪 Montenegrin (sr)

## Features

- ✅ **Minimal size** - pure HTML/CSS/JS,
- ✅ **Auto language detection** by browser settings
- ✅ **Built-in Markdown parser** (133 lines)
- ✅ **NoScript friendly** - works without JavaScript
- ✅ **Responsive design** - for all devices
- ✅ **Auto-deployment** to GitHub Pages
- ✅ **Docker ready** - one-click launch

## Development

```bash
# Local server (Python)
chmod +x serve.sh
./serve.sh

# Then open http://localhost:8080

# (Also works with PHP)
```

## License

This project is open source and available freely under the [MIT license](LICENSE.md).
