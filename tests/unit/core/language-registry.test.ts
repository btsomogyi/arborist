import { describe, it, expect, beforeEach } from 'vitest';
import { LanguageProviderRegistry } from '../../../src/core/language-registry.js';
import { ProviderError } from '../../../src/core/errors.js';
import type { LanguageProvider } from '../../../src/core/types.js';

function makeProvider(overrides: Partial<LanguageProvider> = {}): LanguageProvider {
  return {
    id: 'test-lang',
    displayName: 'Test Language',
    extensions: ['.test'],
    astGrepLang: 'TestLang',
    patterns: {
      functionDeclaration: 'fn $NAME() {}',
      classDeclaration: 'class $NAME {}',
      variableDeclaration: 'let $NAME = $VALUE',
      importStatement: 'import $NAME',
      exportStatement: 'export $NAME',
    },
    nodeTypes: {
      function: ['function_declaration'],
      class: ['class_declaration'],
      variable: ['variable_declarator'],
      import: ['import_statement'],
      parameter: ['parameter'],
      identifier: ['identifier'],
    },
    ...overrides,
  };
}

describe('LanguageProviderRegistry', () => {
  let reg: LanguageProviderRegistry;

  beforeEach(() => {
    reg = new LanguageProviderRegistry();
  });

  describe('register and get', () => {
    it('registers a provider and retrieves by id', () => {
      const provider = makeProvider();
      reg.register(provider);
      expect(reg.get('test-lang')).toBe(provider);
    });

    it('returns undefined for unknown language id', () => {
      expect(reg.get('nonexistent')).toBeUndefined();
    });

    it('allows re-registering the same provider id (updates)', () => {
      const p1 = makeProvider({ displayName: 'V1' });
      const p2 = makeProvider({ displayName: 'V2' });
      reg.register(p1);
      reg.register(p2);
      expect(reg.get('test-lang')?.displayName).toBe('V2');
    });
  });

  describe('register validation', () => {
    it('rejects provider with empty id', () => {
      expect(() => reg.register(makeProvider({ id: '' }))).toThrow(ProviderError);
    });

    it('rejects provider with whitespace-only id', () => {
      expect(() => reg.register(makeProvider({ id: '   ' }))).toThrow(ProviderError);
    });

    it('rejects provider with no extensions', () => {
      expect(() => reg.register(makeProvider({ extensions: [] }))).toThrow(ProviderError);
    });

    it('rejects duplicate extension registration from different provider', () => {
      reg.register(makeProvider({ id: 'lang-a', extensions: ['.ts'] }));
      expect(() =>
        reg.register(makeProvider({ id: 'lang-b', extensions: ['.ts'] })),
      ).toThrow(ProviderError);
    });

    it('allows same extension if same provider id', () => {
      reg.register(makeProvider({ id: 'lang-a', extensions: ['.ts'] }));
      expect(() =>
        reg.register(makeProvider({ id: 'lang-a', extensions: ['.ts', '.tsx'] })),
      ).not.toThrow();
    });
  });

  describe('inferFromExtension', () => {
    it('infers language from .ts extension', () => {
      reg.register(makeProvider({ id: 'typescript', extensions: ['.ts', '.tsx'] }));
      expect(reg.inferFromExtension('.ts')?.id).toBe('typescript');
    });

    it('infers language from .tsx extension', () => {
      reg.register(makeProvider({ id: 'typescript', extensions: ['.ts', '.tsx'] }));
      expect(reg.inferFromExtension('.tsx')?.id).toBe('typescript');
    });

    it('infers language from .py extension', () => {
      reg.register(makeProvider({ id: 'python', extensions: ['.py'] }));
      expect(reg.inferFromExtension('.py')?.id).toBe('python');
    });

    it('handles extension without leading dot', () => {
      reg.register(makeProvider({ id: 'python', extensions: ['.py'] }));
      expect(reg.inferFromExtension('py')?.id).toBe('python');
    });

    it('returns undefined for unknown extension', () => {
      expect(reg.inferFromExtension('.rs')).toBeUndefined();
    });
  });

  describe('inferFromFilePath', () => {
    beforeEach(() => {
      reg.register(makeProvider({ id: 'typescript', extensions: ['.ts', '.tsx', '.js', '.jsx'] }));
      reg.register(makeProvider({ id: 'python', extensions: ['.py', '.pyi'] }));
    });

    it('infers from simple .ts file path', () => {
      expect(reg.inferFromFilePath('src/auth.ts')?.id).toBe('typescript');
    });

    it('infers from .tsx file path', () => {
      expect(reg.inferFromFilePath('src/App.tsx')?.id).toBe('typescript');
    });

    it('infers from .py file path', () => {
      expect(reg.inferFromFilePath('scripts/run.py')?.id).toBe('python');
    });

    it('infers from .pyi file path', () => {
      expect(reg.inferFromFilePath('stubs/mod.pyi')?.id).toBe('python');
    });

    it('infers from .js file path', () => {
      expect(reg.inferFromFilePath('lib/utils.js')?.id).toBe('typescript');
    });

    it('infers from .jsx file path', () => {
      expect(reg.inferFromFilePath('components/Button.jsx')?.id).toBe('typescript');
    });

    it('handles .d.ts as .ts', () => {
      expect(reg.inferFromFilePath('types/index.d.ts')?.id).toBe('typescript');
    });

    it('handles .test.ts as .ts', () => {
      expect(reg.inferFromFilePath('tests/auth.test.ts')?.id).toBe('typescript');
    });

    it('handles .spec.ts as .ts', () => {
      expect(reg.inferFromFilePath('tests/auth.spec.ts')?.id).toBe('typescript');
    });

    it('handles absolute paths', () => {
      expect(reg.inferFromFilePath('/home/user/project/main.py')?.id).toBe('python');
    });

    it('returns undefined for unknown extension', () => {
      expect(reg.inferFromFilePath('Makefile')).toBeUndefined();
    });

    it('returns undefined for extensionless file', () => {
      expect(reg.inferFromFilePath('README')).toBeUndefined();
    });
  });

  describe('list', () => {
    it('returns all registered providers', () => {
      reg.register(makeProvider({ id: 'a', extensions: ['.a'] }));
      reg.register(makeProvider({ id: 'b', extensions: ['.b'] }));
      const list = reg.list();
      expect(list).toHaveLength(2);
      expect(list.map((p) => p.id).sort()).toEqual(['a', 'b']);
    });

    it('returns empty array when no providers registered', () => {
      expect(reg.list()).toEqual([]);
    });
  });

  describe('has', () => {
    it('returns true for registered provider', () => {
      reg.register(makeProvider({ id: 'typescript', extensions: ['.ts'] }));
      expect(reg.has('typescript')).toBe(true);
    });

    it('returns false for unregistered provider', () => {
      expect(reg.has('rust')).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes all providers and extension mappings', () => {
      reg.register(makeProvider({ id: 'typescript', extensions: ['.ts'] }));
      reg.clear();
      expect(reg.has('typescript')).toBe(false);
      expect(reg.inferFromExtension('.ts')).toBeUndefined();
      expect(reg.list()).toEqual([]);
    });
  });
});
