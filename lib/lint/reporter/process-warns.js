var isChildProcess = typeof process.send == 'function'; // child process has send method
var collectFiles = require('./collectFiles');

module.exports = function(flow, options){
  var result = {};
  var warns = flow.warns;
  var fileFilter = options.filter;

  warns.forEach(function(warn){
    var filename = warn.file || '<UnknownFile>';

    if (fileFilter && filename.indexOf(fileFilter) !== 0)
      return;

    if (!result[filename])
      result[filename] = [];

    result[filename].push({
      loc: warn.loc,
      message: warn.message
    });
  });

  if (!isChildProcess)
  {
    var basePath;
    var collectedFiles;

    if (options.warnUnusedFiles && flow.usedFiles)
    {
      var usedFilesInfo = flow.usedFiles;
      var usedFiles = {};

      basePath = usedFilesInfo.collectPath;
      collectedFiles = collectFiles(basePath);

      usedFilesInfo.items.forEach(function(filename){
        usedFiles[usedFilesInfo.basePath + filename] = true;
      });

      for (var usedFile in usedFiles)
        delete collectedFiles[usedFile];

      for (var unusedName in collectedFiles) {
        unusedName = unusedName.slice(process.cwd().length);
        result['unused files'] = result['unused files'] || [];
        result['unused files'].push({
          loc: unusedName,
          message: unusedName
        });
      }
    }
  }

  return result;
};
