# Build the app, then serve the files with nginx.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Fixed here because .dockerignore keeps the local .env out of the image.
ENV VITE_API_URL=/api
ENV VITE_CHAIN_ID=31337
ENV VITE_USE_MOCKS=false
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
