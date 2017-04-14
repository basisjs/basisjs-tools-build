var resolveUri = require('../misc/resolveUri');
var cssTools = require('basisjs-tools-ast').css;
//var parseTime = 0;

module.exports = function(flow){

  var fconsole = flow.console;
  var queue = flow.files.queue;


  //
  // Prepare output style file list
  //

  fconsole.log('Prepare output files');
  var outputFiles = queue.filter(function(file){
    return file.type == 'style' && file.htmlNode;
  });


  //
  // Process files
  //

  fconsole.start('Process files');
  for (var i = 0, file; file = flow.files.queue[i]; i++)
  {
    if (file.type == 'style')
    {
      fconsole.start(file.relpath + ' (' + (file.themes ? file.themes.join(',') : 'all') + ')');
      processFile(file, flow);
      fconsole.endl();
    }
  }
  fconsole.endl();


  //
  // Process style attributes
  //

  fconsole.start('Process style attributes');
  for (var i = 0, file; file = flow.files.queue[i]; i++)
    if (file.type == 'style-block')
    {
      fconsole.log(file.relpath);
      processFile(file, flow);
    }
  fconsole.endl();

  //
  // Save result in flow
  //

  flow.css = {
    outputFiles: outputFiles
  };

  //console.log('time:', parseTime/1e6)
};

module.exports.handlerName = '[css] Extract';


//
// Main part: file process
//

function dropThemes(file, stack){
  if (!stack)
    stack = [];
  if (stack.indexOf(file) == -1)
  {
    stack.push(file);

    for (var i = 0, refFile; refFile = file.linkTo[i]; i++)
      dropThemes(refFile, stack);

    file.themes = null;

    stack.pop();
  }
}

function processFile(file, flow){
  function correctLoc(loc){ // TODO: find out why we need this
    if (loc && offsetMap)
      if (loc.offset in offsetMap)
      {
        var lastLineBreak = file.source.lastIndexOf('\n', offsetMap[loc.offset]);
        loc = {
          line: loc.line,
          column: offsetMap[loc.offset] - (lastLineBreak == -1 ? -1 : lastLineBreak)
        };
      }

    return loc;
  }

  var fconsole = flow.console;
  var offsetMap = file.sourceOffsetMap;

  // import tokens
  file.imports = [];
  file.classes = [];
  file.ids = [];

  // parse css into tree
  try {
    //var tt = process.hrtime();
    file.ast = cssTools.parse(file.content, file.relpath, file.rule);
    //var diff = process.hrtime(tt);
    //parseTime += diff[0] * 1e9 + diff[1];
  } catch(e) {
    file.ast = cssTools.parse('', file.relpath, file.rule);;
    flow.warn({
      fatal: true,
      file: file.relpath,
      message: 'CSS parse error of ' + file.relpath + ':\n' + (e.message || e)
    });
  }

  // search and extract css files
  cssTools.walk(file.ast, {
    Comment: function(node){
      if (/basisjs-tools:disable-warnings/.test(node.value))
      {
        file.ignoreWarnings = true;
        fconsole.log('Istruction `basisjs-tools:disable-warnings` found. Disable warnings for this file.');
      }
    },
    IdSelector: function(node){
      var entry = node;

      entry.loc = file.location(correctLoc(entry.loc));

      file.ids.push(entry);
    },
    ClassName: function(token){
      var entry = token[2];

      entry.loc = file.location(correctLoc(entry.loc));

      file.classes.push(entry);
    },
    Atrule: function(node, item, list){
      // @import
      if (node.name.toLowerCase() === 'import')
      {
        var expression = node.expression.children;
        var uri = resolveUri(
          cssTools.unpackUri(expression.first())
        );

        // ignore externals
        if (uri.url)
          return;

        // resolve import file
        node.loc = file.location(node.loc);
        var importFile = flow.files.add(
          uri.filename
            ? {
                filename: file.resolve(uri.filename),
                initiator: {
                  file: file,
                  loc: node.loc,
                  token: cssTools.translate(node)
                }
              }
            : {
                type: 'style',
                baseURI: file.baseURI,
                content: uri.content,
                initiator: {
                  file: file,
                  loc: node.loc,
                  token: cssTools.translate(node)
                }
              }
        );

        // inherit themes, that's important for template theming
        if (file.themes)
        {
          if (importFile.themes)
            file.themes.forEach(function(themeName){
              if (this.indexOf(themeName) == -1)
                this.push(themeName);
            }, importFile.themes);
          else
          {
            if (!importFile.noThemes)
              importFile.themes = file.themes.slice();
          }
        }
        else
        {
          // drop themes on file that refer file with no themes
          if (importFile.themes)
            dropThemes(importFile);
        }

        // resolve media
        var media = expression.last().type === 'MediaQueryList'
          ? expression.last()
          : null;

        // add link
        file.link(importFile, node);

        // add import
        file.imports.push({
          list: list,
          item: item,
          code: cssTools.translate(node),
          file: importFile,
          media: media
        });
      }
    }
  });
}
