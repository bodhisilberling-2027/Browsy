import fs from "fs-extra";
const DB = "sessions.json";

export type RecordedEvent = {
  t: number; 
  url: string; 
  type: "click"|"input"|"scroll"|"keydown"|"navigate";
  selector?: string; 
  value?: string; 
  x?: number; 
  y?: number; 
  button?: number;
  key?: string;
};

export type Session = {
  name: string;
  events: RecordedEvent[];
  scrapeRequested?: boolean;
  domSnapshot?: string | null; // may hold JSON string from scraper
  createdAt?: number;
};

export async function saveSession(s: Session) {
  const all = await loadAll();
  s.createdAt = Date.now();
  all[s.name] = s;
  await fs.writeJSON(DB, all, { spaces: 2 });
}

export async function loadSession(name: string): Promise<Session|null> {
  const all = await loadAll();
  return all[name] ?? null;
}

export async function loadAll(): Promise<Record<string, Session>> {
  try { 
    return await fs.readJSON(DB); 
  } catch { 
    return {}; 
  }
}

export async function listSessions(): Promise<string[]> {
  const all = await loadAll();
  return Object.keys(all);
}

export async function deleteSession(name: string): Promise<boolean> {
  const all = await loadAll();
  if (all[name]) {
    delete all[name];
    await fs.writeJSON(DB, all, { spaces: 2 });
    return true;
  }
  return false;
}
