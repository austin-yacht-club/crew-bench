# Stage 1: build the React app
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Optional bake-time overrides (prefer runtime API_BASE_PATH via entrypoint).
ARG REACT_APP_API_URL=
ARG REACT_APP_RECAPTCHA_SITE_KEY=
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_RECAPTCHA_SITE_KEY=$REACT_APP_RECAPTCHA_SITE_KEY

RUN npm run build

# Stage 2: serve static files and proxy /api to backend
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
COPY --from=builder /app/build /usr/share/nginx/html

# Default browser API path; override at runtime without rebuilding.
ENV API_BASE_PATH=/api

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
