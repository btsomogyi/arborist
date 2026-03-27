import { registry } from '../core/language-registry.js';
import { typescriptProvider, tsxProvider } from './typescript.js';
import { pythonProvider } from './python.js';
import { goProvider } from './go.js';
import { rustProvider } from './rust.js';

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
  if (!registry.has('go')) {
    registry.register(goProvider);
  }
  if (!registry.has('rust')) {
    registry.register(rustProvider);
  }
}

// Auto-register on import
registerBuiltinProviders();

export { typescriptProvider, tsxProvider } from './typescript.js';
export { pythonProvider } from './python.js';
export { goProvider } from './go.js';
export { rustProvider } from './rust.js';
