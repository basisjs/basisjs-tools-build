module.exports = function(tasks){
  var result = {};

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
  });

  return result;
};
