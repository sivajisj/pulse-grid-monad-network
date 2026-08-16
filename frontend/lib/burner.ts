"use client";

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const STORAGE_KEY = "pulsegrid-burner-key";

export function getOrCreateBurnerAccount() {
  if (typeof window === "undefined") return null;

  let key = window.localStorage.getItem(STORAGE_KEY);
  if (!key) {
    key = generatePrivateKey();
    window.localStorage.setItem(STORAGE_KEY, key);
  }
  return privateKeyToAccount(key as `0x${string}`);
}

export function resetBurnerAccount() {
  window.localStorage.removeItem(STORAGE_KEY);
}
