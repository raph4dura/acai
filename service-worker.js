
const CACHE_NAME = "cantinho-acai-v1";

const ARQUIVOS = [
  "/",
  "/manifest.json",
  "/icon.png"
];

// Instala o service worker e guarda apenas arquivos estáticos.
self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ARQUIVOS))
      .then(() => self.skipWaiting())
  );
});

// Remove versões antigas do cache.
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes
          .filter((nome) =>
            nome.startsWith("cantinho-acai-") &&
            nome !== CACHE_NAME
          )
          .map((nome) => caches.delete(nome))
      )
    ).then(() => self.clients.claim())
  );
});

// APIs sempre consultam a rede: não armazenar pedidos ou preços.
self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);

  if (
    evento.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Para páginas e arquivos, tenta a rede primeiro.
  evento.respondWith(
    fetch(evento.request).catch(async () => {
      const arquivoEmCache = await caches.match(evento.request);

      if (arquivoEmCache) {
        return arquivoEmCache;
      }

      if (evento.request.mode === "navigate") {
        return caches.match("/");
      }

      return new Response("Conteúdo indisponível offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    })
  );
});
