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

If you deploy a fork under another domain, update these files before the first push:

- `CNAME`
- `index.html`
- `scripts/build.mjs`
- `sitemap.xml`
- `robots.txt`
- `llms.txt`

This repository is configured for `mtla.me`, so leaving those values unchanged on a fork will produce working HTML but incorrect canonical/SEO metadata.

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
