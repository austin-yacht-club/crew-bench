# Stage 1: build the React app
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Env vars for CRA are baked in at build time (default: same-origin /api)
ARG REACT_APP_API_URL=
ARG REACT_APP_RECAPTCHA_SITE_KEY=
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_RECAPTCHA_SITE_KEY=$REACT_APP_RECAPTCHA_SITE_KEY

RUN npm run build

# Stage 2: serve static files and proxy /api to backend
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
