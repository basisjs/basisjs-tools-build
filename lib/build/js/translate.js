var at = require('basisjs-tools-ast').js;
var utils = require('basisjs-tools-ast/lib/js/utils');

function repeat(str, count) {
    return new Array(count + 1).join(str);
}

(module.exports = function(flow) {
    var queue = flow.files.queue;
    var fconsole = flow.console;
    var basisFile = flow.js.basisScript && flow.files.get(flow.js.basisScript);

    var defaultParams = {
        format: {
            indent: {
                style: '  '
            },
            compact: flow.options.pack
        }
    };

    for (var i = 0, file; file = queue[i]; i++) {
        if (file.type == 'script') {
            if ((file.htmlNode || file.outputFilename) && file !== basisFile) {
                fconsole.log(file.relpath);

                if (!file.outputFilename) {
                    var indentStart = 0;

                    if (!flow.options.pack) {
                        indentStart = 2;
                        if (file.htmlNode && file.htmlNode.parent) {
                            var children = file.htmlNode.parent.children;
                            var idx = children.indexOf(file.htmlNode);

                            if (idx > 0) {
                                var prevNode = children[idx - 1];

                                if (prevNode && prevNode.type == 'text') {
                                    indentStart = prevNode.data.split(/[\r\n]+/).pop().length + 2;
                                }
                            }
                        }
                    }

                    var params = utils.extend({}, defaultParams, {
                        format: {
                            base: indentStart
                        }
                    });

                    file.outputContent = at.translate(file.originalAst || file.ast, params);

                    if (indentStart) {
                        file.outputContent = '\n' + file.outputContent + '\n' + repeat(' ', Math.max(0, indentStart - 2));
                    }
                } else {
                    file.outputContent = at.translate(file.originalAst || file.ast);
                }
            }
        }
    }

}).handlerName = '[js] Translate';
