var collectFiles = require('./collectFiles');

module.exports = function(tasks){
  var result = {};
  var basePaths = {};
  var usedFiles = {};
  var collectedFiles = {};

  tasks.forEach(function(task){
    var failures = result[task.name] = [];

    if (typeof task.result == 'string')
      failures.push({
        message: task.result
      });
    else
      task.result.warnings.forEach(function(warn){
        var filename = warn.file;

        if (!filename)
          return;

        failures.push({
          loc: warn.loc,
          message: warn.message + ' at ' + filename
        });
      });

    if (task.result.usedFiles)
    {
      basePaths[task.result.usedFiles.collectPath] = true;
      task.result.usedFiles.items.forEach(function(filename){
        usedFiles[task.result.usedFiles.basePath + filename] = true;
      });
    }
  });

  if (Object.keys(basePaths).length)
  {
    for (var basePath in basePaths)
    {
      var files = collectFiles(basePath);

      for (var fileName in files)
        collectedFiles[fileName] = true;
    }

    for (var usedFile in usedFiles)
      delete collectedFiles[usedFile];

    for (var unusedName in collectedFiles)
    {
      unusedName = unusedName.slice(process.cwd().length);
      result['unused files'] = result['unused files'] || [];
      result['unused files'].push({
        loc: unusedName,
        message: unusedName
      });
    }
  }

  return result;
};
