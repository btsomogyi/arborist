import type { LanguageProvider } from '../core/types.js';

export const typescriptProvider: LanguageProvider = {
  id: 'typescript',
  displayName: 'TypeScript',
  extensions: ['.ts', '.js', '.mjs', '.cjs'],
  astGrepLang: 'TypeScript',
  patterns: {
    functionDeclaration: 'function $NAME($$$PARAMS) { $$$BODY }',
    typedFunctionDeclaration: 'function $NAME($$$PARAMS): $RET { $$$BODY }',
    arrowFunction: 'const $NAME = ($$$PARAMS) => $BODY',
    typedArrowFunction: 'const $NAME = ($$$PARAMS): $RET => $BODY',
    asyncFunction: 'async function $NAME($$$PARAMS) { $$$BODY }',
    typedAsyncFunction: 'async function $NAME($$$PARAMS): $RET { $$$BODY }',
    classDeclaration: 'class $NAME { $$$BODY }',
    classWithExtends: 'class $NAME extends $BASE { $$$BODY }',
    variableDeclaration: 'const $NAME = $VALUE',
    letDeclaration: 'let $NAME = $VALUE',
    importStatement: 'import $$$IMPORTS from $SOURCE',
    importDefault: 'import $NAME from $SOURCE',
    importNamed: 'import { $$$NAMES } from $SOURCE',
    exportStatement: 'export $$$DECL',
    exportDefault: 'export default $EXPR',
    interfaceDeclaration: 'interface $NAME { $$$BODY }',
    typeAlias: 'type $NAME = $TYPE',
    consoleLog: 'console.log($$$ARGS)',
  },
  nodeTypes: {
    function: [
      'function_declaration',
      'arrow_function',
      'method_definition',
      'function_expression',
    ],
    class: ['class_declaration', 'class_expression'],
    variable: [
      'variable_declarator',
      'lexical_declaration',
    ],
    import: ['import_statement', 'import_declaration'],
    export: ['export_statement', 'export_declaration'],
    parameter: ['required_parameter', 'optional_parameter', 'rest_pattern'],
    identifier: ['identifier', 'property_identifier', 'type_identifier'],
    type: [
      'interface_declaration',
      'type_alias_declaration',
    ],
  },
};

export const tsxProvider: LanguageProvider = {
  id: 'tsx',
  displayName: 'TSX/JSX',
  extensions: ['.tsx', '.jsx'],
  astGrepLang: 'Tsx',
  patterns: {
    ...typescriptProvider.patterns,
    jsxElement: '<$NAME $$$ATTRS>$$$CHILDREN</$NAME>',
    jsxSelfClosing: '<$NAME $$$ATTRS />',
  },
  nodeTypes: {
    ...typescriptProvider.nodeTypes,
    jsx: ['jsx_element', 'jsx_self_closing_element', 'jsx_fragment'],
  },
};
