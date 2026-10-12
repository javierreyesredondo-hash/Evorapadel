#!/usr/bin/env node
// Pasarela local mínima que imita las rutas de Kong en Supabase:
//   /auth/v1/*  → GoTrue      /rest/v1/* → PostgREST
// Solo para el Supabase LOCAL de scripts/supabase-local.mjs. No valida la
// apikey como Kong: PostgREST y GoTrue verifican igualmente los JWT.
import http from "node:http";

const puerto = Number(process.env.PASARELA_PUERTO ?? 54321);
const destinos = [
  ["/auth/v1", new URL(process.env.PASARELA_AUTH ?? "http://127.0.0.1:54329")],
  ["/rest/v1", new URL(process.env.PASARELA_REST ?? "http://127.0.0.1:54331")],
];

http
  .createServer((req, res) => {
    const encontrado = destinos.find(([prefijo]) => req.url === prefijo || req.url.startsWith(`${prefijo}/`) || req.url.startsWith(`${prefijo}?`));
    if (!encontrado) {
      res.writeHead(404, { "content-type": "application/json" }).end('{"message":"ruta no encontrada"}');
      return;
    }
    const [prefijo, destino] = encontrado;
    const ruta = req.url.slice(prefijo.length) || "/";
    const salida = http.request(
      { hostname: destino.hostname, port: destino.port, path: ruta.startsWith("/") ? ruta : `/${ruta}`, method: req.method,
        headers: { ...req.headers, host: destino.host } },
      (respuesta) => {
        res.writeHead(respuesta.statusCode ?? 502, respuesta.headers);
        respuesta.pipe(res);
      },
    );
    salida.on("error", () => res.writeHead(502).end());
    req.pipe(salida);
  })
  .listen(puerto, "127.0.0.1");
