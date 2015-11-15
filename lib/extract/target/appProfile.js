var path = require('path');

(module.exports = function(flow){
  var content = [];
  var nodeCount = flow.files.queue.length;
  var edgeCount = 0;

  // build graph file content
  flow.files.queue.forEach(function(file){
    edgeCount += file.linkTo.length;

    if (!name(file))
      return;

    content.push({
      type: file.type,
      name: name(file)
    });
  });

  // add archive as single result file

  var content = [
    '"files":' + JSON.stringify(content),
    '"links":' + JSON.stringify(
      flow.files.links.map(function(link){
        var fn1 = name(link[0], true);
        var fn2 = name(link[1]);
        return fn1 && fn2 ? [fn1, fn2] : null;
      }).filter(Boolean)
    ),
    '"warns":' + JSON.stringify(flow.warns.map(function(warn){
      warn.message = String(warn.message);
      if (warn.file)
        warn.file = flow.files.resolve(warn.file);
      return warn;
    }))
  ];

  if (flow.l10n && flow.l10n.version == 2)
    content.push('"l10n":' + JSON.stringify(getL10nDictionaries(flow)));

  flow.result = '{\n' + content.join(',\n') + '\n' + '}';
}).handlerName = 'Make file map';

function resolveLinkTo(link){
  var n = name(link[0]);
  if (n)
    return [n];
  else
    return link[0].linkTo.map(resolveLinkTo).reduce(function(item, res){
      if (item)
        return res.concat(item);
      else
        return res;
    }, []);
}

function name(file, implicit){
  function rel(name){
    return name ? String(name).replace(/^\//, '') : name;
  }

  if (file.filename)
    file.graphName = file.filename;

  if (file.sourceFilename)
    file.graphName = file.sourceFilename;

  if (!file.graphName && implicit && file.inline && file.htmlFile)
    return rel(file.htmlFile.filename);

  return rel(file.graphName);
}

function getL10nDictionaries(flow){
  var result = {};

  for (var filename in flow.l10n.dictionaries)
  {
    var dict = flow.l10n.dictionaries[filename];
    var file = dict.file;

    var data = {};

    for (var key in dict.tokens)
    {
      var token = dict.tokens[key];
      var refs = [];

      for (var i = 0, ref; ref = token.ref[i]; i++)
      {
        var filename = name(ref.file);
        if (refs.indexOf(filename) == -1)
          refs.push(filename);
      }

      data[key] = {
        type: token.type,
        implicit: token.implicit,
        files: refs
      };
    }

    result[name(file)] = data;
  }

  return result;
}
