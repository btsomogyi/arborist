import { ProviderError } from './errors.js';
import type { LanguageProvider } from './types.js';
import { extname } from 'node:path';

export class LanguageProviderRegistry {
  private providers: Map<string, LanguageProvider> = new Map();
  private extensionMap: Map<string, string> = new Map();

  register(provider: LanguageProvider): void {
    if (!provider.id || provider.id.trim() === '') {
      throw new ProviderError('Provider id must be a non-empty string', {
        provider: provider.id,
      });
    }

    if (!provider.extensions || provider.extensions.length === 0) {
      throw new ProviderError(
        `Provider "${provider.id}" must have at least one file extension`,
        { provider: provider.id },
      );
    }

    for (const ext of provider.extensions) {
      const existing = this.extensionMap.get(ext);
      if (existing && existing !== provider.id) {
        throw new ProviderError(
          `Extension "${ext}" is already registered to provider "${existing}"`,
          { extension: ext, existingProvider: existing, newProvider: provider.id },
        );
      }
    }

    this.providers.set(provider.id, provider);
    for (const ext of provider.extensions) {
      this.extensionMap.set(ext, provider.id);
    }
  }

  get(languageId: string): LanguageProvider | undefined {
    return this.providers.get(languageId);
  }

  inferFromExtension(ext: string): LanguageProvider | undefined {
    const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
    const languageId = this.extensionMap.get(normalizedExt);
    if (!languageId) return undefined;
    return this.providers.get(languageId);
  }

  inferFromFilePath(filePath: string): LanguageProvider | undefined {
    const ext = extractExtension(filePath);
    if (!ext) return undefined;
    return this.inferFromExtension(ext);
  }

  list(): LanguageProvider[] {
    return Array.from(this.providers.values());
  }

  has(languageId: string): boolean {
    return this.providers.has(languageId);
  }

  clear(): void {
    this.providers.clear();
    this.extensionMap.clear();
  }
}

function extractExtension(filePath: string): string | undefined {
  const basename = filePath.split('/').pop() ?? filePath;

  // Handle compound extensions: .d.ts, .d.mts, .d.cts
  if (/\.d\.[mc]?ts$/.test(basename)) {
    return '.ts';
  }

  // Handle .test.ts, .spec.ts — the meaningful extension is .ts
  // But for language detection, we care about the actual file extension
  const ext = extname(basename);
  return ext || undefined;
}

/** Default singleton registry instance */
export const registry = new LanguageProviderRegistry();
