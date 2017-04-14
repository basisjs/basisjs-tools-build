var cssAstTools = require('basisjs-tools-ast').css;
var copyAst = cssAstTools.copy;
var compress = cssAstTools.compress;

(module.exports = function(flow){
  var fconsole = flow.console;
  var usage = null;

  if (flow.options.cssUsage && flow.css.usage)
    usage = flow.css.usage;

  fconsole.start('Process packages');
  flow.css.packages.forEach(function(file){
    fconsole.log(file.relOutputFilename);
    // make a copy of ast, as it could has shared parts
    // and csso optimizer might corrupt those parts
    file.ast = compress(copyAst(file.ast), {
      // clone: true,
      usage: usage
    }).ast;
  });
  fconsole.endl();

  fconsole.start('Process style attributes');
  for (var i = 0, file; file = flow.files.queue[i]; i++)
    if (file.type == 'style-block')
    {
      fconsole.log(file.relpath);
      file.ast = compress(file.ast).ast;
    }
  fconsole.end();
}).handlerName = '[css] Compress';

module.exports.skip = function(flow){
  if (!flow.options.cssPack)
    return 'Use option --css-pack for compression';
};
