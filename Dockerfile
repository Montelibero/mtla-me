# Minimal static file server using nginx alpine
FROM nginx:alpine as base

# Use a builder stage to prepare the site tree (sync i18n -> root)
FROM alpine:3.20 as build
WORKDIR /src

# Copy repository files into build context
COPY . .

# Sync i18n/<lang> into /src/<lang> similar to CI/serve.sh (POSIX shell)
RUN set -e; \
    for d in i18n/*/; do \
      lang="$(basename "$d")"; \
      rm -rf "$lang" && mkdir -p "$lang"; \
      cp -R "$d". "$lang"/; \
    done

# Nginx to serve static files
FROM nginx:alpine

# Copy prepared site from builder
COPY --from=build /src /usr/share/nginx/html/

# Expose port 80
EXPOSE 80
