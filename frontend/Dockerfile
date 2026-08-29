# --- Derleme ---
# node:24 → npm 11: package-lock.json npm 11 ile uretildi, npm 10 bazi
# hatalari "Exit handler never called" diye gizliyor.
# Calisma imaji alpine oldugu icin nihai boyut etkilenmiyor.
FROM node:24-slim AS build
WORKDIR /build

# Lock dosyasiyla birebir kurulum; build'ler tekrarlanabilir olsun.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Servis ---
FROM nginx:alpine
COPY --from=build /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
