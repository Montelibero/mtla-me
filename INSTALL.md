# Deployment

## Method 1: GitHub Pages (automatic)

**The easiest way is to deploy automatically with every push:**

1. Upload your code to the GitHub repository
2. Go to **Settings → Pages**
3. In the **Source** section, select **GitHub Actions**
4. Done! Every time you push to `new`, the site will be automatically updated

The workflow is already configured in `.github/workflows/deploy.yml`

**URL update (canonical):**

If you use a custom domain (like `new.mtla.me`), set canonical in `i18n/<lang>/index.html` to the custom domain:
```html
<link rel="canonical" href="https://new.mtla.me/en/">
```
Do the same for other languages (`/ru/`, `/es/`, `/sr/`, etc).

If you do NOT use a custom domain, set canonical to the GitHub Pages URL:
```html
<link rel="canonical" href="https://<username>.github.io/<repository>/en/">
```

## Method 2: GitHub Pages (manual)

1. Upload all files to the root of the repository
2. Go to **Settings → Pages**
3. In the **Source** section, select the `new` branch and the `/ (root)` folder
4. Save your changes
5. The site is available at `https://<username>.github.io/<repository>/`

## Method 3: Docker (locally or on a server)

**Docker:**
```bash
# Build the image
docker build -t mtla-landing .

# Run the container
docker run -d -p 8080:80 --name mtla-landing mtla-landing

# Open in browser: http://localhost:8080
```

Note: The Docker build synchronizes `i18n/<lang>` into `/<lang>` (like CI and `serve.sh`). If you edit files in `i18n/*`, rebuilding the image is enough — no manual copy is needed.

**Docker Compose:**
```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Open in browser: http://localhost:8080
```

**Deployment on the server:**
```bash
# On a server with Docker
git clone https://github.com/<username>/<repository>.git
cd <repository>
docker-compose up -d

# With Nginx reverse proxy, add the configuration
# for proxying to port 8080
```
