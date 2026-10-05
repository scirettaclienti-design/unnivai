// Gate QUOTA-SERVER — sostituto di https://deno.land/std@0.177.0/http/server.ts
// per eseguire le Edge Function sotto Vitest (alias in vitest.config.js).
// `serve(handler)` non apre nessuna porta: salva l'handler su globalThis, da
// dove il test lo prende e lo chiama con una Request vera.
export const serve = (handler) => {
  globalThis.__edgeHandler = handler;
};
