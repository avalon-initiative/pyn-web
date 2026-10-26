# syntax=docker/dockerfile:1.7
# Serves a built dist/ (npm run build). The release workflow builds it once, packs the tarball from it, and copies the
# same files here, so the image holds no Node toolchain and needs no registry token.
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.31.7-alpine3.24@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e

FROM ${NGINX_IMAGE}
ARG VERSION=dev
ARG REVISION=unknown
LABEL org.opencontainers.image.title="pyn-web" \
      org.opencontainers.image.source="https://github.com/avalon-initiative/pyn-web" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"
# The base entrypoint renders templates/*.template with these variables only, so nginx's own $variables are untouched
ENV PYN_API_URL=http://pyn-core:7878 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 \
    NGINX_ENVSUBST_FILTER="^(PYN_API_URL|NGINX_LOCAL_RESOLVERS)"
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/nginx-health || exit 1
