import { registry } from '../core/language-registry.js';
import { typescriptProvider, tsxProvider } from './typescript.js';
import { pythonProvider } from './python.js';

export function registerBuiltinProviders(): void {
  if (!registry.has('typescript')) {
    registry.register(typescriptProvider);
  }
  if (!registry.has('tsx')) {
    registry.register(tsxProvider);
  }
  if (!registry.has('python')) {
    registry.register(pythonProvider);
  }
}

// Auto-register on import
registerBuiltinProviders();

export { typescriptProvider, tsxProvider } from './typescript.js';
export { pythonProvider } from './python.js';
