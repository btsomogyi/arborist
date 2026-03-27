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

export const testGoProvider: LanguageProvider = {
  id: 'go',
  displayName: 'Go',
  extensions: ['.go'],
  astGrepLang: 'go',
  patterns: {
    functionDeclaration: 'func $NAME($$$PARAMS) $$$RET { $$$BODY }',
    classDeclaration: 'type $NAME struct { $$$FIELDS }',
    variableDeclaration: 'var $NAME $TYPE = $VALUE',
    importStatement: 'import $$$IMPORTS',
    exportStatement: 'func $NAME($$$PARAMS) $$$RET { $$$BODY }',
    fmtPrintln: 'fmt.Println($$$ARGS)',
  },
  nodeTypes: {
    function: ['function_declaration', 'method_declaration'],
    class: ['type_declaration'],
    variable: ['var_declaration', 'short_var_declaration'],
    import: ['import_declaration'],
    parameter: ['parameter_declaration'],
    identifier: ['identifier', 'field_identifier', 'package_identifier', 'type_identifier'],
  },
};

export function registerTestProviders(): void {
  if (!registry.has('typescript')) {
    registry.register(testTypescriptProvider);
  }
  if (!registry.has('python')) {
    registry.register(testPythonProvider);
  }
  if (!registry.has('go')) {
    registry.register(testGoProvider);
  }
}
