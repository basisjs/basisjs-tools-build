var cssTools = require('basisjs-tools-ast').css;

//
// export handler
//

module.exports = function(flow){
  var packages = flow.css.packages;
  var fconsole = flow.console;

  // process files in reverse order
  for (var i = packages.length - 1, file; file = packages[i]; i--)
  {
    fconsole.start(file.relOutputFilename);

    file.ast = buildFile(file, flow, file.theme);

    fconsole.endl();
  }
};

module.exports.handlerName = '[css] Linear files';

//
// main part
//

function buildFile(file, flow, theme, context){
  if (!context)
    context = [];

  if (context.indexOf(file) != -1)
  {
    var msg = 'Recursion ' +
      context.map(function(item){
        return item == file ? '{ ' + item.relpath + ' }' : item.relpath;
      }).join(' -> ') +
      ' -> { ' + file.relpath + ' }';

    flow.warn({
      file: file.relpath,
      message: msg
    });

    return {
      type: 'StyleSheet',
      loc: null,
      children: new cssTools.List()
        .appendData(cssTools.Comment(' [WARN] ' + msg + ' '))
        .appendData(cssTools.WhiteSpace('\n\n'))
    };
  }

  if (file.used && file.used[theme])
  {
    var msg = '[DUP] ' + (file.filename ? file.relpath : '[inline style]') + ' ignored as already used';
    flow.console.log('# ' + msg);
    return {
      type: 'StyleSheet',
      loc: null,
      children: new cssTools.List()
        .appendData(cssTools.Comment(' ' + msg + ' '))
        .appendData(cssTools.WhiteSpace('\n\n'))
    };
  }

  if (!file.used)
    file.used = {};
  file.used[theme] = true;

  context.push(file);

  for (var i = file.imports.length - 1, importToken; importToken = file.imports[i]; i--)
  {
    var injection = buildFile(importToken.file, flow, theme, context);

    // copy links to files
    importToken.file.linkTo.forEach(function(link){
      file.link(link[0], link[1]);
    });

    if (importToken.media)
    {
      injection.children = new cssTools.List()
        .appendData({
          type: 'Atrule',
          loc: null,
          name: 'media',
          expression: importToken.media,
          block: {
            type: 'Block',
            children: injection.children
              .prependData(cssTools.WhiteSpace('\n'))
              .appendData(cssTools.WhiteSpace('\n'))
          }
        })
        .appendData(cssTools.WhiteSpace('\n'));
    }

    // inject comment
    injection.children
      .prependData(cssTools.WhiteSpace('\n\n'))
      .prependData(cssTools.Comment(importToken.code));

    file.ast.children
      .replace(importToken.item, injection.children);
  }

  context.pop();

  return file.ast;
}
