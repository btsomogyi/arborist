/**
 * Minimal language providers for engine tests.
 * These will be replaced by full providers in Phase 4.
 */
import { registry } from '../../src/core/language-registry.js';
import type { LanguageProvider } from '../../src/core/types.js';

const minimalPatterns = {
  functionDeclaration: 'function $NAME($$$PARAMS) { $$$BODY }',
  classDeclaration: 'class $NAME { $$$BODY }',
  variableDeclaration: 'const $NAME = $VALUE',
  importStatement: 'import $NAME from $SOURCE',
  exportStatement: 'export $$$DECL',
};

const minimalNodeTypes = {
  function: ['function_declaration'],
  class: ['class_declaration'],
  variable: ['variable_declarator'],
  import: ['import_statement'],
  parameter: ['required_parameter'],
  identifier: ['identifier'],
};

export const testTypescriptProvider: LanguageProvider = {
  id: 'typescript',
  displayName: 'TypeScript',
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
  astGrepLang: 'TypeScript',
  patterns: minimalPatterns,
  nodeTypes: minimalNodeTypes,
};

export const testPythonProvider: LanguageProvider = {
  id: 'python',
  displayName: 'Python',
  extensions: ['.py', '.pyi'],
  astGrepLang: 'Python',
  patterns: {
    ...minimalPatterns,
    functionDeclaration: 'def $NAME($$$PARAMS)',
    classDeclaration: 'class $NAME',
    variableDeclaration: '$NAME = $VALUE',
    importStatement: 'import $MODULE',
    printCall: 'print($$$ARGS)',
  },
  nodeTypes: {
    ...minimalNodeTypes,
    function: ['function_definition'],
    class: ['class_definition'],
    variable: ['assignment'],
    import: ['import_statement'],
    identifier: ['identifier'],
  },
};

export function registerTestProviders(): void {
  if (!registry.has('typescript')) {
    registry.register(testTypescriptProvider);
  }
  if (!registry.has('python')) {
    registry.register(testPythonProvider);
  }
}
