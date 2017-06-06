module.exports = function(flow) {
    var fconsole = flow.console;
    var fileTypeMap = {};
    var fileMap = {};
    var outputFileCount = 0;
    var outputSize = 0;

    if (!flow.options.verbose) {
        fconsole.resetDeep();
        fconsole.enabled = true;
        fconsole.log();
    }

    flow.files.queue.forEach(function(file) {
        var stat = fileTypeMap[file.type];

        if (!stat) {
            stat = fileTypeMap[file.type] = {
                queueFiles: [],
                outputFiles: [],
                outputSize: 0
            };
        }

        stat.queueFiles.push(file.filename);

        if (file.outputFilename && 'outputContent' in file) {
            if (!fileMap[file.outputFilename]) { // prevent duplicates
                fileMap[file.outputFilename] = true;
                outputFileCount++;

                var fileSize = Buffer.byteLength(file.outputContent, file.encoding);

                outputSize += fileSize;
                stat.outputSize += fileSize;
                stat.outputFiles.push(file.outputFilename + ' ' + fileSize + ' bytes');
            }
        }
    }, fileTypeMap);

    fconsole.start('File queue:');
    for (var key in fileTypeMap) {
        fconsole.log(key + ': ' + fileTypeMap[key].queueFiles.length);
    }
    fconsole.endl();

    fconsole.start('Output ' + outputFileCount + ' files in ' + outputSize + ' bytes:');
    for (key in fileTypeMap) {
        var files = fileTypeMap[key].outputFiles;

        if (!files.length) {
            continue;
        }

        var header = key + ': ' + files.length + ', ' + fileTypeMap[key].outputSize + ' bytes';

        if (key == 'script' || key == 'style') {
            fconsole.start(header);
            fconsole.list(files);
            fconsole.end();
        } else {
            fconsole.log(header);
        }
    }
    fconsole.end();
};

module.exports.handlerName = 'Build stat';
module.exports.silent = true;
module.exports.skip = function(flow) {
    return !flow.options.stat;
};
