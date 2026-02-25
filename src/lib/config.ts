/**
 * config.ts — Lê e salva configurações locais do app Bip Certo.
 * Usa localStorage como storage (compatível com Web + Tauri WebView).
 * Quando Tauri plugin-store estiver disponível, pode migrar facilmente.
 */

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

const CONFIG_KEY = 'bip_certo_config';

export function getConfig(): AppConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    if (!parsed.supabaseUrl || !parsed.supabaseAnonKey) return null;
    return parsed as AppConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: AppConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function clearConfig(): void {
  localStorage.removeItem(CONFIG_KEY);
}

export function hasConfig(): boolean {
  return getConfig() !== null;
}
