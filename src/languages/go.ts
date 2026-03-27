import type { LanguageProvider } from '../core/types.js';

export const goProvider: LanguageProvider = {
  id: 'go',
  displayName: 'Go',
  extensions: ['.go'],
  astGrepLang: 'go',
  patterns: {
    functionDeclaration: 'func $NAME($$$PARAMS) $$$RET { $$$BODY }',
    classDeclaration: 'type $NAME struct { $$$FIELDS }',
    variableDeclaration: 'var $NAME $TYPE = $VALUE',
    shortVarDeclaration: '$NAME := $VALUE',
    importStatement: 'import $$$IMPORTS',
    exportStatement: 'func $NAME($$$PARAMS) $$$RET { $$$BODY }',
    methodDeclaration: 'func ($RECV $TYPE) $NAME($$$PARAMS) $$$RET { $$$BODY }',
    interfaceDeclaration: 'type $NAME interface { $$$METHODS }',
    constDeclaration: 'const $NAME = $VALUE',
    goroutine: 'go $CALL',
    deferStatement: 'defer $CALL',
    channelSend: '$CH <- $VALUE',
    fmtPrintln: 'fmt.Println($$$ARGS)',
    errorCheck: 'if $ERR != nil { $$$BODY }',
  },
  nodeTypes: {
    function: ['function_declaration', 'method_declaration', 'func_literal'],
    class: ['type_declaration'],
    variable: ['var_declaration', 'short_var_declaration', 'const_declaration'],
    import: ['import_declaration'],
    export: ['function_declaration'],
    parameter: ['parameter_declaration'],
    identifier: ['identifier', 'field_identifier', 'package_identifier', 'type_identifier'],
    type: ['type_declaration', 'interface_type'],
  },
};
