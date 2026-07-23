import { useEffect, type EffectCallback } from "react";

// Roda um efeito só na montagem (assinar listener global, criar o AudioContext,
// ler um canal de hand-off). É o único uso de `useEffect(fn, [])` que as regras
// permitem - dar-lhe nome deixa a intenção explícita e evita salpicar
// `eslint-disable exhaustive-deps` pelos componentes. O cleanup retornado roda na
// desmontagem, como em qualquer efeito.
export function useMountEffect(effect: EffectCallback): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}
