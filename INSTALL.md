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
npm run check
```

The command verifies the agreement provenance record, recreates `_site/`, and runs the regression suite. Use `npm run build` only when tests have already passed and you need to recreate the artifact.

## Updating the agreement

The two files in `documents/` are controlled copies of the authoritative [MTLA-Documents repository](https://github.com/Montelibero/MTLA-Documents), not independent translations.

1. Check out the exact authoritative commit to a separate local directory.
2. Copy `Internal/Agreement/Agreement.en.md` and `Internal/Agreement/Agreement.ru.md` into `documents/` without editing their contents.
3. In `documents/UPSTREAM.json`, update `commit`, `verifiedAt`, and both SHA-256 values. Keep full 40-character commit and 64-character lowercase hashes.
4. Verify the controlled copies against that checkout:

```bash
npm run verify:documents -- --upstream-dir /path/to/MTLA-Documents
npm run check
```

Commit the two Markdown files and `UPSTREAM.json` together. A mismatched or unrecorded document makes the build fail.

## Local preview

```bash
./serve.sh
```

Then open `http://127.0.0.1:8080`.

## Docker preview

```bash
docker build -t mtla-landing .
docker run --rm -p 127.0.0.1:8080:80 mtla-landing
```

The Docker image builds the same `_site/` artifact and serves it with nginx.

## Production controls

The workflow validates pull requests and deploys commits on `v2` using immutable action commit SHAs. Configure GitHub Pages to deploy from GitHub Actions with the custom domain `mtla.me` and HTTPS enabled. To roll back a release, revert its commit on `v2` and let the workflow rebuild and deploy the previous content.

Only `_site/` is published. Repository instructions, local production notes, and audit reports are excluded from the site artifact. Keep internal approval records and production notes outside version control; the local `PRODUCTION.md` file is ignored.
