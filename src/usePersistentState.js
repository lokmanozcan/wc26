/**
 * usePersistentState
 * 
 * useState gibi çalışır ama değeri Supabase'deki `app_state` tablosuna da yazar.
 * Supabase yoksa (geliştirme ortamı gibi) saf useState gibi davranır.
 * 
 * Tablo şeması (Supabase SQL Editor'da bir kere çalıştır):
 *   create table if not exists app_state (
 *     key   text primary key,
 *     value jsonb not null
 *   );
 *   alter table app_state enable row level security;
 *   create policy "public read"  on app_state for select using (true);
 *   create policy "public write" on app_state for all using (true) with check (true);
 */

import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const SAVE_DEBOUNCE_MS = 800; // art arda girişlerde yazma fırtınası önleme

export function usePersistentState(key, defaultValue) {
  const [value, setValue] = useState(defaultValue);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef(null);

  // İlk yüklemede Supabase'den oku
  useEffect(() => {
    if (!supabase) { setLoaded(true); return; }

    supabase
      .from("app_state")
      .select("value")
      .eq("key", key)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data?.value !== undefined && data?.value !== null) {
          setValue(data.value);
        }
        setLoaded(true);
      });
  }, [key]);

  // Değer değişince debounced kaydet
  const setAndPersist = (newValueOrFn) => {
    setValue((prev) => {
      const next =
        typeof newValueOrFn === "function" ? newValueOrFn(prev) : newValueOrFn;

      if (supabase && loaded) {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          supabase
            .from("app_state")
            .upsert({ key, value: next }, { onConflict: "key" })
            .then(({ error }) => {
              if (error) console.error(`[persist] ${key} kaydedilemedi:`, error.message);
            });
        }, SAVE_DEBOUNCE_MS);
      }

      return next;
    });
  };

  return [value, setAndPersist, loaded];
}
