var fs = require('fs');
var path = require('path');

(module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  //
  // Save output files to disk
  //

  for (var i = 0, file; file = flow.result[i]; i++)
  {
    fconsole.log(file.path);

    fs.writeFile(
      resolveDirPath(fconsole, file.path),
      file.content,
      file.encoding
    );
  }
}).handlerName = '[fs] Write files';


function resolveDirPath(fconsole, filename){
  var dirpath = path.dirname(path.normalize(filename));

  if (!fs.existsSync(dirpath))
  {
    var parts = dirpath.split(path.sep);
    var curpath = parts[0] + path.sep;
    for (var i = 1; i < parts.length; i++)
    {
      curpath += parts[i] + path.sep;

      if (!fs.existsSync(curpath))
      {
        fconsole.log('Create dir', curpath);
        try {
          fs.mkdirSync(curpath);
        } catch(e) {
          fconsole.log('  error', e);
        }
      }
    }
  }

  return filename;
}
