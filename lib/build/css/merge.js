var path = require('path');
var html_at = require('basisjs-tools-ast').html;

(module.exports = function(flow){
  var fconsole = flow.console;
  var packages = flow.css.packages;
  var newPackages = [];
  var idx = '';
  var indexFileBasename = path.basename(flow.options.file, path.extname(flow.options.file));
  var filenamePrefix = flow.options.sameFilenames ? indexFileBasename : 'style';
  var themeFilenamePrefix = flow.options.sameFilenames ? indexFileBasename + '-' : '';

  for (var i = 0, file, prev; file = packages[i]; i++)
  {
    var filename = file.outputFilename;
    if (!file.htmlId &&
        prev &&
        prev.media == file.media &&
        prev.theme == file.theme)
    {
      // add file content to prev file
      prev.ast.push.apply(prev.ast, file.ast.slice(2));

      // copy links to files from merged file
      file.linkTo.forEach(function(link){
        prev.link(link[0], link[1]);
      });

      // remove link and token
      file.htmlFile.unlink(file, file.htmlNode);
      html_at.removeToken(file.htmlNode, true);
    }
    else
    {
      if (prev)
      {
        fconsole.endl();
      }

      prev = file.htmlId ? null : file;
      newPackages.push(file);

      if (file.theme)
      {
        file.outputFilename = themeFilenamePrefix + file.theme + '.css';
      }
      else
      {
        if (!file.htmlId || !file.inline)
        {
          file.outputFilename = filenamePrefix + idx + '.css';
          idx++;
        }

        if (file.htmlId)
        {
          fconsole.log(file.relpath + ' unmerged as has id attribute\n');
          continue;
        }
      }

      fconsole.start('Merge into ' + file.relOutputFilename + ' (media: ' + file.media + ')');
    }

    fconsole.log(file.relpath);
  }

  flow.css.packages = newPackages;
}).handlerName = '[css] Merge packages';

module.exports.skip = function(flow){
  if (!flow.options.cssSingleFile)
    return 'Don\'t use --no-css-single-file or --no-single-file to allow css file merge.';
};
