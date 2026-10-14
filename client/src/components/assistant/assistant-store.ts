import { useSyncExternalStore } from "react";

// What is shared across the assistant's screens: which conversation is open, and which ones are answering right now.
// It is module-level on purpose, so a conversation keeps working (and its spinner keeps showing in the list) while another is open.
const STORAGE_KEY = "assistant.chat";

export interface RunState { text?: string; answering?: boolean }

let activeId: string | null = readStored();
let running: ReadonlyMap<string, RunState> = new Map();
let snapshot = { activeId, running };
const listeners = new Set<() => void>();

function readStored(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function emit() {
  snapshot = { activeId, running };
  listeners.forEach((l) => l());
}

export const assistantStore = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  getSnapshot: () => snapshot,
  setActive(id: string | null) {
    if (id === activeId) return;
    activeId = id;
    try { id ? localStorage.setItem(STORAGE_KEY, id) : localStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
    emit();
  },
  start(id: string, state: RunState) { running = new Map(running).set(id, state); emit(); },
  finish(id: string) { const next = new Map(running); next.delete(id); running = next; emit(); },
};

export function useAssistantStore() {
  return useSyncExternalStore(assistantStore.subscribe, assistantStore.getSnapshot, assistantStore.getSnapshot);
}
