var path = require('path');
var htmlAt = require('basisjs-tools-ast').html;

(module.exports = function(flow) {
    var fconsole = flow.console;
    var packages = flow.css.packages;
    var newPackages = [];
    var idx = '';
    var indexFileBasename = path.basename(flow.options.file, path.extname(flow.options.file));
    var filenamePrefix = flow.options.sameFilenames ? indexFileBasename : 'style';
    var themeFilenamePrefix = flow.options.sameFilenames ? indexFileBasename + '-' : '';

    for (var i = 0, file, prev; file = packages[i]; i++) {
        if (flow.options.singleFile && file.htmlNode) {
            flow.exit('Couldn\'t produce single file as has some css file references in html');
        }

        if (!file.htmlId &&
            prev &&
            prev.media == file.media &&
            prev.theme == file.theme) {
            // add file content to prev file
            prev.ast.children.appendList(file.ast.children);

            // copy links to files from merged file
            file.linkTo.forEach(function(link) {
                prev.link(link[0], link[1]);
            });

            // remove link and token
            file.htmlFile.unlink(file, file.htmlNode);
            htmlAt.removeToken(file.htmlNode, true);
        } else {
            if (prev) {
                fconsole.endl();
            }

            prev = file.htmlId ? null : file;
            newPackages.push(file);

            if (flow.options.singleFile) {
                file.isResource = true;
                file.outputFilename = null;
                continue;
            }

            if (file.theme) {
                file.proposedOutputFilename = themeFilenamePrefix + file.theme + '.css';
            } else {
                if (!file.htmlId || !file.inline) {
                    file.proposedOutputFilename = filenamePrefix + idx + '.css';
                    idx++;
                }

                if (file.htmlId) {
                    fconsole.log(file.relpath + ' doesn\'t merged as has id attribute\n');
                    continue;
                }
            }

            fconsole.start('Merge into ' + file.relOutputFilename + ' (media: ' + file.media + ')');
        }

        fconsole.log(file.relpath);
    }

    flow.css.packages = newPackages;
}).handlerName = '[css] Merge packages';
