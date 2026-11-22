# syntax=docker/dockerfile:1.7
# Serves a built dist/ (npm run build) with Caddy. The release workflow builds dist/ once, packs the tarball from it, and
# copies the same files here, so the image holds no Node toolchain and needs no registry token.
# Only the builder stage runs commands (on the build machine); the final stage is COPY-only, so no platform is emulated.
ARG CADDY_VERSION=2.11.9
ARG CADDY_BUILDER_IMAGE=caddy:2.11.9-builder-alpine@sha256:646fee578e680989ca5c7fd1ce6f1de574d19fd71ef2221810cc0510a9f40c86
ARG ALPINE_IMAGE=alpine:3.24.4@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf

FROM --platform=$BUILDPLATFORM ${CADDY_BUILDER_IMAGE} AS builder
ARG CADDY_VERSION
ARG TARGETOS
ARG TARGETARCH
# The builder image sets XCADDY_SETCAP=1, a file capability that makes exec fail once capabilities are dropped; low ports use the sysctl.
RUN XCADDY_SETCAP=0 CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    xcaddy build "v${CADDY_VERSION}" --with github.com/caddy-dns/cloudflare@v0.2.4 --output /out/usr/bin/caddy \
    && mkdir -p /out/data

FROM ${ALPINE_IMAGE}
ARG VERSION=dev
ARG REVISION=unknown
LABEL org.opencontainers.image.title="pyn-web" \
      org.opencontainers.image.source="https://github.com/avalon-initiative/pyn-web" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"
# PYN_TLS and PYN_SITE are unset: plain HTTP on 8080, as before. /data holds certificates and the internal root; /tmp is Caddy's config dir.
ENV PYN_API_URL=http://pyn-core:7878 \
    XDG_DATA_HOME=/data \
    XDG_CONFIG_HOME=/tmp
COPY --from=builder --chmod=0755 /out/usr/bin/caddy /usr/bin/caddy
COPY --from=builder --chown=65532:65532 /out/data /data
COPY docker/caddy/Caddyfile /etc/caddy/Caddyfile
COPY docker/caddy/tls /etc/caddy/tls
COPY docker/caddy/log /etc/caddy/log
COPY --chmod=0755 docker/caddy/entrypoint.sh /usr/local/bin/pyn-web-entrypoint
COPY dist /srv
USER 65532:65532
VOLUME /data
EXPOSE 80 443 443/udp 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8082/health || exit 1
# Caddy shuts down gracefully on SIGTERM, within grace_period.
STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/local/bin/pyn-web-entrypoint"]
