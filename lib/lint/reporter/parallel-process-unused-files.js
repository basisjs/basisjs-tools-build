var path = require('path');
var collectFiles = require('../helpers/fs-files-collector');

module.exports = function handleUnusedFiles(tasks){
  var basePaths = {};
  var usedFiles = {};

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
        {
          // warm about unused file
          fileName = path.relative(process.cwd(), fileName);
          task.result.warnings.push({
            file: fileName
          });
        }
    }

    tasks.push(task);
  }
};
