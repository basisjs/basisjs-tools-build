var walk = require('basisjs-tools-ast').js.walk;

(module.exports = function(flow) {
    function checkDuplicateParameters(token) {
        var params = token.params;
        var names = {};

        for (var i = 0; i < params.length; i++) {
            if (hasOwnProperty.call(names, params[i].name)) {
                flow.warn({
                    file: file.hostFilename,
                    message: 'Strict mode function may not have duplicate parameter names: ' + params[i].name,
                    loc: file.location(params[i].loc && params[i].loc.start)
                });
            }

            names[params[i].name] = true;
        }
    }

    function checkDuplicateProperty(token) {
        var properties = token.properties;
        var names = {};

        for (var i = 0; i < properties.length; i++) {
            var prop = properties[i];
            var key = prop.key.type == 'Literal' ? prop.key.value : prop.key.name;

            if (hasOwnProperty.call(names, key)) {
                flow.warn({
                    file: file.hostFilename,
                    message: 'Strict mode object may not have duplicate property names: ' + key,
                    loc: file.location(prop.loc.start)
                });
            }

            names[key] = true;
        }
    }

    var fconsole = flow.console;
    var queue = flow.files.queue;
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    var ignoreBasisImplicitNames = ['require', 'exports', 'module', '__filename', '__resources__', '__namespace_map__'];

    for (var i = 0, file; file = queue[i]; i++) {
        if (file.type == 'script' && file.ast) {
            var strictScopes = 0;

            fconsole.start(file.relpath);

            file.ast.scopes.forEach(function(scope) {
                scope.usage = {};
                strictScopes += scope.strict;
            });

            // check for implicit names usage
            file.ast.names.forEach(function(info) {
                var token = info.token;
                var name = token.name;
                var scope = info.scope.scopeByName(name);

                if (!scope) {
                    // temporary ignore some basis.js implicit names usage for now
                    if (file.hostFilename == flow.js.basisScript && ignoreBasisImplicitNames.indexOf(name) != -1) {
                        return;
                    }

                    flow.warn({
                        file: file.hostFilename,
                        message: 'Implicit global usage: ' + name,
                        loc: file.location(token.loc.start)
                    });
                } else {
                    if (!scope.usage) {
                        return;
                    }

                    info = scope.getOwn(name);

                    var type = info.type;

                    // if some argument in argument list is used then all
                    // other arguments before it considered as used too, i.e.
                    // | 'foo'.replace(/x(\d+)/g, function(m, num){
                    // |   return num * 2;
                    // | });
                    // in this case `m` will be considered used as can't be
                    // removed or omited
                    if (type == 'arg' && info.args) {
                        for (var i = 0; i < info.index; i++) {
                            scope.usage[info.args[i].name] = true;
                        }
                    }

                    scope.usage[name] = true;
                }
            });

            // check all declared names in use
            file.ast.scopes.forEach(function(scope) {
                scope.getOwnNames().forEach(function(name) {
                    // ignore scope if created by function but body is empty
                    // (treat those functions as placeholder)
                    if (scope.type == 'function' && scope.sourceToken && (!scope.sourceToken.body || !scope.sourceToken.body.body.length)) {
                        return;
                    }

                    var info = scope.getOwn(name);
                    var type = info.type;

                    // ignore any names except var and function declarations,
                    // and arguments but not for implicit scopes (implicit module wrapper function scope)
                    if (type != 'var' && type != 'FunctionDeclaration' && (type != 'arg' || scope.implicit)) {
                        return;
                    }

                    if (!hasOwnProperty.call(scope.usage, name)) {
                        flow.warn({
                            file: file.hostFilename,
                            message: 'Defined but never used: ' + name,
                            loc: file.location(info.loc.start)
                        });
                    }
                });
            });

            // check for top level duplicate var declarations
            file.ast.scopes.forEach(function(scope) {
                if (!scope.declarations) {
                    return;
                }

                var names = new Set();

                scope.declarations.forEach(function(info) {
                    var parentType = info.parent.type;

                    if (parentType == 'Program' ||
                        parentType == 'FunctionDeclaration' ||
                        parentType == 'FunctionExpression') {
                        var name = info.name;

                        if (names.has(name)) {
                            flow.warn({
                                file: file.hostFilename,
                                message: 'Duplicate top-level var declaration: ' + name,
                                loc: file.location(info.loc.start)
                            });
                        }

                        names.add(name);
                    }
                });
            });

            // make some checks for strict mode as something may break build in IE
            if (strictScopes) {
                walk(file.ast, {
                    FunctionDeclaration: checkDuplicateParameters,
                    FunctionExpression: checkDuplicateParameters,
                    ObjectExpression: checkDuplicateProperty
                });
            }

            fconsole.endl(file.relpath);
        }
    }
}).handlerName = '[js] Collect info';
