import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { debugLog } from "./debugStore";

interface SettingsStore {
  // Appearance
  fontSize: number;
  fontFamily: string;
  openStartupFiles: boolean;

  // GitHub (token in Windows Credential Manager, rest in settings.json)
  githubClientId: string;
  githubToken: string;       // in-memory only, source of truth is keyring
  githubUsername: string | null;

  // Linear (key in Windows Credential Manager)
  linearApiKey: string;      // in-memory only, source of truth is keyring
  linearUsername: string | null;

  // Jira (token in Windows Credential Manager, url/email in settings.json)
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;      // in-memory only, source of truth is keyring
  jiraUsername: string | null;

  // Actions
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setOpenStartupFiles: (value: boolean) => void;
  setGithubClientId: (id: string) => void;
  setGithubToken: (token: string) => void;
  setGithubUsername: (name: string | null) => void;
  setLinearApiKey: (key: string) => void;
  setLinearUsername: (name: string | null) => void;
  setJiraBaseUrl: (url: string) => void;
  setJiraEmail: (email: string) => void;
  setJiraApiToken: (token: string) => void;
  setJiraUsername: (name: string | null) => void;
  loadFromDisk: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  fontSize: 14,
  fontFamily: "Cascadia Code, JetBrains Mono, Fira Code, monospace",
  openStartupFiles: false,
  githubClientId: "",
  githubToken: "",
  githubUsername: null,
  linearApiKey: "",
  linearUsername: null,
  jiraBaseUrl: "",
  jiraEmail: "",
  jiraApiToken: "",
  jiraUsername: null,

  setFontSize: (fontSize) => {
    set({ fontSize });
    persistConfig({ fontSize, fontFamily: get().fontFamily, githubClientId: get().githubClientId, jiraBaseUrl: get().jiraBaseUrl, jiraEmail: get().jiraEmail, openStartupFiles: get().openStartupFiles });
  },
  setFontFamily: (fontFamily) => {
    set({ fontFamily });
    persistConfig({ fontSize: get().fontSize, fontFamily, githubClientId: get().githubClientId, jiraBaseUrl: get().jiraBaseUrl, jiraEmail: get().jiraEmail, openStartupFiles: get().openStartupFiles });
  },
  setOpenStartupFiles: (openStartupFiles) => {
    set({ openStartupFiles });
    persistConfig({ fontSize: get().fontSize, fontFamily: get().fontFamily, githubClientId: get().githubClientId, jiraBaseUrl: get().jiraBaseUrl, jiraEmail: get().jiraEmail, openStartupFiles });
  },
  setGithubClientId: (githubClientId) => {
    set({ githubClientId });
    persistConfig({ fontSize: get().fontSize, fontFamily: get().fontFamily, githubClientId, jiraBaseUrl: get().jiraBaseUrl, jiraEmail: get().jiraEmail, openStartupFiles: get().openStartupFiles });
  },
  setGithubToken: (githubToken) => set({ githubToken }),
  setGithubUsername: (githubUsername) => set({ githubUsername }),
  setLinearApiKey: (linearApiKey) => set({ linearApiKey }),
  setLinearUsername: (linearUsername) => set({ linearUsername }),
  setJiraBaseUrl: (jiraBaseUrl) => {
    set({ jiraBaseUrl });
    persistConfig({ fontSize: get().fontSize, fontFamily: get().fontFamily, githubClientId: get().githubClientId, jiraBaseUrl, jiraEmail: get().jiraEmail, openStartupFiles: get().openStartupFiles });
  },
  setJiraEmail: (jiraEmail) => {
    set({ jiraEmail });
    persistConfig({ fontSize: get().fontSize, fontFamily: get().fontFamily, githubClientId: get().githubClientId, jiraBaseUrl: get().jiraBaseUrl, jiraEmail, openStartupFiles: get().openStartupFiles });
  },
  setJiraApiToken: (jiraApiToken) => set({ jiraApiToken }),
  setJiraUsername: (jiraUsername) => set({ jiraUsername }),

  loadFromDisk: async () => {
    debugLog("Settings", "Loading settings from disk", undefined, "info");
    // Load non-sensitive config from settings.json
    try {
      const store = await load("settings.json", { autoSave: false, defaults: {} });
      const fontSize = await store.get<number>("fontSize");
      const fontFamily = await store.get<string>("fontFamily");
      const githubClientId = await store.get<string>("githubClientId");
      const jiraBaseUrl = await store.get<string>("jiraBaseUrl");
      const jiraEmail = await store.get<string>("jiraEmail");
      const openStartupFiles = await store.get<boolean>("openStartupFiles");
      set({
        ...(fontSize != null && { fontSize }),
        ...(fontFamily != null && { fontFamily }),
        ...(githubClientId != null && { githubClientId }),
        ...(jiraBaseUrl != null && { jiraBaseUrl }),
        ...(jiraEmail != null && { jiraEmail }),
        ...(openStartupFiles != null && { openStartupFiles }),
      });
      debugLog("Settings", "Config loaded from disk", { fontSize, fontFamily, githubClientId }, "success");
    } catch {
      // not in Tauri context
    }

    // Load secrets from Windows Credential Manager
    try {
      const secrets = await invoke<{
        github_token: string | null;
        linear_api_key: string | null;
        jira_api_token: string | null;
      }>("cmd_load_integration_secrets");

      if (secrets.github_token) set({ githubToken: secrets.github_token });
      if (secrets.linear_api_key) set({ linearApiKey: secrets.linear_api_key });
      if (secrets.jira_api_token) set({ jiraApiToken: secrets.jira_api_token });
      debugLog("Settings", "Secrets loaded from keyring", { hasGithub: !!secrets.github_token, hasLinear: !!secrets.linear_api_key, hasJira: !!secrets.jira_api_token }, "success");
    } catch {
      // not in Tauri context
    }
  },
}));

// Persist only non-sensitive config to disk
interface Config {
  fontSize: number;
  fontFamily: string;
  githubClientId: string;
  jiraBaseUrl: string;
  jiraEmail: string;
  openStartupFiles: boolean;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function persistConfig(config: Config) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    debugLog("Settings", "Persisting config", { fontSize: config.fontSize, fontFamily: config.fontFamily }, "info");
    try {
      const store = await load("settings.json", { autoSave: false, defaults: {} });
      await store.set("fontSize", config.fontSize);
      await store.set("fontFamily", config.fontFamily);
      await store.set("githubClientId", config.githubClientId);
      await store.set("jiraBaseUrl", config.jiraBaseUrl);
      await store.set("jiraEmail", config.jiraEmail);
      await store.set("openStartupFiles", config.openStartupFiles);
      await store.save();
    } catch {
      // not in Tauri context
    }
  }, 100);
}
