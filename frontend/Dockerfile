# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["/bin/sh", "-c", "sed -i 's/listen 80;/listen '\"${PORT:-80}\"';/g' /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
