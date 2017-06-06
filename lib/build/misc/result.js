var path = require('path');

(module.exports = function(flow) {
    var queue = flow.files.queue;
    var fconsole = flow.console;

    flow.result = [];

    for (var i = 0, file; file = queue[i]; i++) {
        if (file.outputFilename && 'outputContent' in file) {
            fconsole.log(file.relpath + ' -> ' + file.relOutputFilename);

            flow.result.push({
                path: path.resolve(flow.options.output, file.outputFilename),
                content: file.outputContent,
                encoding: file.encoding
            });
        }
    }
}).handlerName = '[fs] Prepare output';
