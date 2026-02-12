import { createLogger } from "../utils/logger.js";
import type { ApiKeys } from "../models/types.js";

const log = createLogger("ai-registry");

// ─── Provider Definitions ────────────────────────────────────────

export type AiCapability = "text" | "image" | "video" | "audio" | "tts" | "stt";

export interface AiProvider {
  id: string;
  name: string;
  capabilities: AiCapability[];
  apiKeyField: keyof ApiKeys;
  models: AiModel[];
  baseUrl?: string;
}

export interface AiModel {
  id: string;
  name: string;
  capability: AiCapability;
  costPerUnit?: number;
  unitType?: "token" | "second" | "image" | "minute";
}

const PROVIDERS: AiProvider[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    capabilities: ["text"],
    apiKeyField: "anthropicApiKey",
    models: [
      { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5", capability: "text" },
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", capability: "text" },
    ],
  },
  {
    id: "google",
    name: "Google AI",
    capabilities: ["image"],
    apiKeyField: "googleAiApiKey",
    models: [
      { id: "imagen-4-fast", name: "Imagen 4 Fast", capability: "image", costPerUnit: 0.02, unitType: "image" },
      { id: "imagen-4", name: "Imagen 4", capability: "image", costPerUnit: 0.04, unitType: "image" },
    ],
  },
  {
    id: "runway",
    name: "Runway",
    capabilities: ["video"],
    apiKeyField: "runwayApiKey",
    models: [
      { id: "gen4", name: "Gen-4", capability: "video", costPerUnit: 0.05, unitType: "second" },
    ],
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    capabilities: ["tts", "audio"],
    apiKeyField: "elevenLabsApiKey",
    models: [
      { id: "eleven_multilingual_v2", name: "Multilingual v2", capability: "tts", costPerUnit: 0.30, unitType: "minute" },
      { id: "eleven_turbo_v2_5", name: "Turbo v2.5", capability: "tts", costPerUnit: 0.15, unitType: "minute" },
    ],
  },
];

// ─── Registry ────────────────────────────────────────────────────

export class AiServiceRegistry {
  private providers = new Map<string, AiProvider>();

  constructor() {
    for (const p of PROVIDERS) {
      this.providers.set(p.id, p);
    }
  }

  /** Get all registered providers */
  listProviders(): AiProvider[] {
    return Array.from(this.providers.values());
  }

  /** Get providers that support a given capability */
  getProvidersFor(capability: AiCapability): AiProvider[] {
    return this.listProviders().filter((p) => p.capabilities.includes(capability));
  }

  /** Get a specific provider */
  getProvider(id: string): AiProvider | undefined {
    return this.providers.get(id);
  }

  /** Get models for a capability */
  getModelsFor(capability: AiCapability): Array<AiModel & { providerId: string }> {
    const results: Array<AiModel & { providerId: string }> = [];
    for (const p of this.providers.values()) {
      for (const m of p.models) {
        if (m.capability === capability) {
          results.push({ ...m, providerId: p.id });
        }
      }
    }
    return results;
  }

  /** Check if API key is configured for a provider */
  isConfigured(providerId: string, apiKeys: ApiKeys): boolean {
    const provider = this.providers.get(providerId);
    if (!provider) return false;
    return !!apiKeys[provider.apiKeyField];
  }

  /** Get API key for a provider, throws if not configured */
  getApiKey(providerId: string, apiKeys: ApiKeys): string {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Unknown AI provider: ${providerId}`);
    const key = apiKeys[provider.apiKeyField];
    if (!key) throw new Error(`API key not configured for ${provider.name} (field: ${provider.apiKeyField})`);
    return key;
  }

  /** Get available capabilities for a set of API keys */
  getAvailableCapabilities(apiKeys: ApiKeys): AiCapability[] {
    const caps = new Set<AiCapability>();
    for (const p of this.providers.values()) {
      if (apiKeys[p.apiKeyField]) {
        for (const c of p.capabilities) caps.add(c);
      }
    }
    return Array.from(caps);
  }

  /** Register a custom provider (for future extensibility) */
  registerProvider(provider: AiProvider): void {
    this.providers.set(provider.id, provider);
    log.info({ providerId: provider.id, capabilities: provider.capabilities }, "custom AI provider registered");
  }
}

/** Singleton registry instance */
export const aiRegistry = new AiServiceRegistry();
