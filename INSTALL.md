# Deployment

## GitHub Pages

This repository deploys from the `v2` branch via GitHub Actions.

1. Push your changes to the `v2` branch.
2. Open **Settings → Pages**.
3. In **Source**, select **GitHub Actions**.
4. The workflow in `.github/workflows/deploy.yml` will build `_site/` and publish it automatically.

The production domain for this repository is `mtla.me`. The generated locale URLs are:

- `https://mtla.me/en/`
- `https://mtla.me/ru/`
- `https://mtla.me/es/`
- `https://mtla.me/sr/`

## Custom domain or fork

If you deploy a fork under another domain, update these before the first push:

- `CNAME`
- `site.config.mjs` (`SITE_ORIGIN`, locales)
- `robots.txt` (Sitemap URL if you keep an absolute `Sitemap:` line)
- `llms.txt` (absolute links)

Built output (`_site/`) takes canonical URLs, sitemap, JSON-LD, agent discovery links, `ai/summary.json`, and `.well-known/agent-skills/index.json` from `site.config.mjs` and the build script. The source `index.html` uses `{{{BUILD_*}}}` markers and is not meant to be served unbuilt.

This repository is configured for `mtla.me`, so leaving `SITE_ORIGIN` unchanged on a fork will produce incorrect canonical/SEO metadata for your domain.

## Local build

```bash
npm ci
npm run build
```

The build output is written to `_site/`.

## Local preview

```bash
./serve.sh
```

Then open `http://localhost:8080`.

## Docker preview

```bash
docker build -t mtla-landing .
docker run --rm -p 8080:80 mtla-landing
```

The Docker image builds the same `_site/` artifact and serves it with nginx.
