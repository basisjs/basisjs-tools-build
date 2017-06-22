var collectFiles = require('../helpers/fs-files-collector');

module.exports = function handleUnusedFiles(tasks){
  var basePaths = {};
  var usedFiles = {};
  var unusedFiles = {};

  // merge used files from tasks
  tasks.forEach(function(task){
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
    var task = { name: 'unused files', result: { warnings: [] } };

    // collect unused files
    for (var basePath in basePaths)
    {
      var files = collectFiles(basePath);

      for (var fileName in files)
        if (!usedFiles.hasOwnProperty(fileName))
          unusedFiles[fileName] = true;
    }

    // warn about unused files
    for (var unusedFile in unusedFiles)
    {
      unusedFile = unusedFile.slice(process.cwd().length);
      task.result.warnings.push({
        file: unusedFile
      });
    }

    tasks.push(task);
  }
};
