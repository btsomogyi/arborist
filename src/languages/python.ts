import type { LanguageProvider } from '../core/types.js';

export const pythonProvider: LanguageProvider = {
  id: 'python',
  displayName: 'Python',
  extensions: ['.py', '.pyi'],
  astGrepLang: 'Python',
  patterns: {
    functionDeclaration: 'def $NAME($$$PARAMS)',
    classDeclaration: 'class $NAME',
    classWithBase: 'class $NAME($$$BASES)',
    variableDeclaration: '$NAME = $VALUE',
    importStatement: 'import $MODULE',
    importFrom: 'from $MODULE import $$$NAMES',
    exportStatement: '$NAME = $VALUE',
    decorator: '@$NAME',
    decoratorWithArgs: '@$NAME($$$ARGS)',
    asyncFunction: 'async def $NAME($$$PARAMS)',
    methodDefinition: 'def $NAME(self, $$$PARAMS)',
    printCall: 'print($$$ARGS)',
  },
  nodeTypes: {
    function: ['function_definition'],
    class: ['class_definition'],
    variable: ['assignment', 'augmented_assignment'],
    import: ['import_statement', 'import_from_statement'],
    parameter: ['identifier', 'default_parameter', 'typed_parameter'],
    identifier: ['identifier'],
    decorator: ['decorator'],
  },
};
