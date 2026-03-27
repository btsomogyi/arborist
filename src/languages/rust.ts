import type { LanguageProvider } from '../core/types.js';

export const rustProvider: LanguageProvider = {
  id: 'rust',
  displayName: 'Rust',
  extensions: ['.rs'],
  astGrepLang: 'rust',
  patterns: {
    functionDeclaration: 'fn $NAME($$$PARAMS) $$$RET { $$$BODY }',
    classDeclaration: 'struct $NAME { $$$FIELDS }',
    variableDeclaration: 'let $NAME = $VALUE',
    mutVariableDeclaration: 'let mut $NAME = $VALUE',
    importStatement: 'use $$$PATH',
    exportStatement: 'pub fn $NAME($$$PARAMS) $$$RET { $$$BODY }',
    implBlock: 'impl $NAME { $$$METHODS }',
    implForTrait: 'impl $TRAIT for $NAME { $$$METHODS }',
    traitDeclaration: 'trait $NAME { $$$METHODS }',
    enumDeclaration: 'enum $NAME { $$$VARIANTS }',
    matchExpression: 'match $EXPR { $$$ARMS }',
    printlnMacro: 'println!($$$ARGS)',
    constDeclaration: 'const $NAME: $TYPE = $VALUE',
    closureExpression: '|$$$PARAMS| $BODY',
  },
  nodeTypes: {
    function: ['function_item', 'closure_expression'],
    class: ['struct_item', 'enum_item'],
    variable: ['let_declaration', 'const_item', 'static_item'],
    import: ['use_declaration'],
    export: ['function_item'],
    parameter: ['parameter', 'self_parameter'],
    identifier: ['identifier', 'field_identifier', 'type_identifier'],
    type: ['struct_item', 'enum_item', 'trait_item', 'type_item'],
  },
};
