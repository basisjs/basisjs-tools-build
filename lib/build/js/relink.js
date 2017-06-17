var at = require('basisjs-tools-ast').js;
var pathUtils = require('path');
var utils = require('basisjs-tools-ast/lib/js/utils');

//
// export handler
//

(module.exports = function(flow) {
    var queue = flow.files.queue;
    var fconsole = flow.console;

    for (var i = 0, file; file = queue[i]; i++) {
        if (file.type == 'script') {
            if (flow.options.jsOptimizeThrows) {
                // replace value for idx
                // TODO: make sure it's has no side effect, otherwise this replacement may break code
                file.throwCodes.forEach(function(item) {
                    var expr = item[2].argument;

                    // throw 'string'  =>  throw 123
                    if (expr.type == 'Literal') {
                        item[2].arguments = utils.createLiteral(Number(expr.value));

                        return;
                    }

                    // throw new Error(expr)  => throw new Error(123)
                    if (expr.type == 'NewExpression' && expr.argument.type == 'Identifier' && expr.argument.name == 'Error' && expr.arguments.length <= 1) {
                        expr.arguments = [utils.createLiteral(item[0])];

                        return;
                    }
                });
            }

            if (file.deps.length || file.resources.length) {
                fconsole.start(file.relpath);

                file.ast = at.walk(file.ast, {
                    CallExpression: function(token) {
                        switch (token.replaceFor_) {
                            case 'basis.resource':
                                var code = at.translate(token);
                                var file = token.resourceRef;

                                if (file && file.jsRef) {
                                    token.callee = at.parse('basis.resource', true);
                                    token.arguments = [utils.createLiteral('./' + file.jsRef)];
                                    flow.console.log(code + ' -> ' + at.translate(token));
                                } else {
                                    if (file) {
                                        flow.warn({
                                            file: this.file.relpath,
                                            message: code + ' has no jsRef (ignored)'
                                        });
                                    }
                                }

                                break;

                            case 'basis.require':
                                if (!token.resourceRef) {
                                    // console.log(at.translate(token));
                                    flow.warn({
                                        fatal: true,
                                        file: this.file.relpath,
                                        message: 'token `' + at.translate(token) + '` has no file ref'
                                    });
                                }

                                token.callee = at.parse('basis.require', true);
                                token.arguments = [utils.createLiteral('./' + token.resourceRef.jsRef)];

                                break;

                            case 'basis.template.get':
                                token.callee = at.parse('basis.template.get', true);
                                token.arguments = token.replaceForArgs_;
                                break;
                        }
                    }
                }, { file: file });

                fconsole.endl();
            }
        }
    }

    //
    // relink assets
    //
    if (flow.js.asset.length) {
        fconsole.start('Relink assets');

        var stat = flow.js.asset.reduce(function(res, asset) {
            var path = asset.sourceFile.relpath;

            if (!res.hasOwnProperty(path)) {
                res[path] = [];
            }
            res[path].push(asset);

            return res;
        }, {});

        for (var path in stat) {
            fconsole.start(path);
            stat[path].forEach(function(asset) {
                var replacement;

                // inline asset content
                if (asset.inline) {
                    replacement = asset.file.content;
                    fconsole.log(at.translate(asset.token) + ' -> [content of `' + asset.file.relpath + '`]');
                } else {
                    replacement = asset.file.fileRef || '';

                    if (asset.sourceFile.outputFilename) {
                        replacement = pathUtils.relative(pathUtils.dirname(asset.sourceFile.outputFilename), replacement);
                    }

                    fconsole.log(at.translate(asset.token) + ' -> "' + replacement + '"');
                }

                utils.replaceNode(asset.token, utils.createLiteral(replacement));
            });
            fconsole.endl();
        }

        fconsole.endl();
    }

}).handlerName = '[js] Relink';
