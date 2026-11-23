# CI only: Pterodactyl Panel (official image, pinned by digest) with Blueprint (pinned release,
# checked by sha256) set up the way Blueprint's own docker image does it. The Lumen extension is
# installed later, in the running container, with `blueprint -install lumen` (it needs the
# database). Versions: ci/versions.env.
ARG PANEL_IMAGE
FROM ${PANEL_IMAGE}

ARG BLUEPRINT_VERSION
ARG BLUEPRINT_SHA256
WORKDIR /app
SHELL ["/bin/ash", "-eo", "pipefail", "-c"]

RUN apk add --no-cache bash curl unzip zip git coreutils sed rsync ncurses nodejs npm

RUN mkdir -p /app/var \
    && printf '[mysql]\nskip-ssl\n' > /etc/my.cnf.d/ci.cnf
# The disposable CI database has no TLS; Laravel's schema import uses the MariaDB CLI.
RUN printf '[client]\nskip-ssl\n' > /etc/my.cnf.d/ci.cnf \
    && mkdir -p /app/var
# The entrypoint keeps its generated .env in /app/var; the CI database has no TLS, and the newer
# MariaDB client refuses plain connections unless told so (used by Laravel's schema load).
RUN mkdir -p /app/var /etc/my.cnf.d \
    && printf '[client]\nskip-ssl\n' > /etc/my.cnf.d/lumen-ci.cnf

RUN curl -fsSL -o /tmp/blueprint.zip \
        "https://github.com/BlueprintFramework/framework/releases/download/${BLUEPRINT_VERSION}/release.zip" \
    && echo "${BLUEPRINT_SHA256}  /tmp/blueprint.zip" | sha256sum -c - \
    && unzip -o -q /tmp/blueprint.zip -d /app \
    && rm /tmp/blueprint.zip \
    && touch /.dockerenv

RUN npm install -g yarn@1.22.22 \
    && yarn install --network-timeout 300000 --non-interactive

ENV TERM=xterm
RUN printf 'WEBUSER="nginx";\nOWNERSHIP="nginx:nginx";\nUSERSHELL="/bin/bash";\n' > /app/.blueprintrc \
    && chmod +x blueprint.sh \
    && bash blueprint.sh \
    && rm -rf node_modules/.cache
