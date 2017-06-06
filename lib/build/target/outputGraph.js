/* graph generator */

module.exports = function(flow) {
    var fconsole = flow.console;
    var content = [];

    fconsole.start('Build output file graph');

    var files = flow.files.queue.filter(function(file) {
        return file.outputFilename && 'outputContent' in file;
    });
    var nodeCount = files.length;
    var edgeCount = 0;

    // build graph file content
    fconsole.start('Build graph.');
    content.push('digraph graph {');
    files.forEach(function(file) {
        var c = color(file);

        if (c) {
            content.push(name(file) + c);
        }

        edgeCount += file.linkTo.length;
        file.linkTo.forEach(function(linkTo) {
            var fileTo = linkTo[0];

            if (!fileTo.inline) {
                content.push(name(file) + '->' + name(fileTo));
            }
        });
    });
    content.push('}');

    // out statistic
    fconsole.log('Node count:' + nodeCount);
    fconsole.log('Edge count: ' + edgeCount);
    fconsole.end();

    // remove all files
    fconsole.log('Drop all output files.');
    flow.files.clear();

    // add archive as single result file
    fconsole.log('Add output graph as single result file.');
    flow.files.add({
        type: 'text',
        outputFilename: 'output-graph.dot',
        outputContent: content.join('\n')
    });
};

module.exports.handlerName = '[misc] Make output graph';

var noFilenameSeed = 0;

function name(file) {
    if (!file.outputFilename) {
        if (!file.graphName) {
            file.graphName = '[no filename ' + (noFilenameSeed++) + ']';
        }
        
        return '"' + file.graphName + '"';
    }
    
    return '"' + file.relOutputFilename + '"';
}

function color(file) {
    switch (file.type) {
        case 'html':
            return ' [color="1 0 0"]';
        case 'script':
            return ' [color="0.7 0.8 0.9"]';
        case 'style':
            return ' [color="1 1 0.8"]';
        case 'template':
            return ' [color="0.7 1 0.7"]';
        case 'l10n':
            return ' [color="1 0.9 0.5"]';
        case 'image':
            return ' [color="0.6 0.9 1"]';
    }
    
    return '';
}
