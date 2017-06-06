var htmlAt = require('basisjs-tools-ast').html;

(module.exports = function(flow) {
    var fconsole = flow.console;
    var queue = flow.files.queue;

    for (var i = 0, file; file = queue[i]; i++) {
        if (file.type == 'script' && file.htmlNode) {
            fconsole.log(file.relpath);
            if (file.outputFilename) {
                htmlAt.replaceToken(file.htmlNode, {
                    type: 'script',
                    name: 'script',
                    attribs: {
                        src: file.htmlRef || file.outputFilename
                    },
                    children: []
                });
            } else {
                if (!file.outputContent) {
                    file.htmlFile.unlink(file, file.htmlNode);
                    htmlAt.removeToken(file.htmlNode, true);
                } else {
                    htmlAt.replaceToken(file.htmlNode, {
                        type: 'script',
                        name: 'script',
                        attribs: {},
                        children: [
                            {
                                type: 'text',
                                data: file.outputContent
                            }
                        ]
                    });
                }
            }
        }
    }
}).handlerName = '[js] Modify <script> entry in html file';
