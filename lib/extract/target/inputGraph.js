/* graph generator */

module.exports = function(flow){
  var content = [];
  var nodeCount = flow.files.queue.length;
  var edgeCount = 0;

  // build graph file content
  content.push('digraph graph {');
  flow.files.queue.forEach(function(file){
    var c = color(file);
    if (c)
      content.push(name(file) + c);

    edgeCount += file.linkTo.length;
    file.linkTo.forEach(function(linkTo){
      content.push(name(file) + '->' + name(linkTo[0]));
    });
  });
  content.push('}');

  // remove all files
  flow.result = content.join('\n');
};

module.exports.handlerName = 'Make input graph';

var noFilenameSeed = 0;
function name(file){
  if (!file.filename)
  {
    if (!file.graphName)
      file.graphName = file.sourceFilename || '[no filename ' + (noFilenameSeed++) + ']';
    return '"' + file.graphName + '"';
  }
  return '"' + file.relpath + '"';
}

function color(file){
  switch (file.type){
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
