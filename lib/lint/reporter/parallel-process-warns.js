module.exports = function(tasks){
  var result = {};
  var unusedL10nTokens = {};

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

    if (task.result.usedL10nTokens)
    {
      for (var dictFileName in task.result.usedL10nTokens.items) {
        var absDictFilename = task.result.usedL10nTokens.basePath + dictFileName;
        var tokenNames = task.result.usedL10nTokens.items[dictFileName];

        unusedL10nTokens[absDictFilename] = unusedL10nTokens[absDictFilename] || {};

        for (var tokenName in tokenNames)
        {
          if (tokenNames.hasOwnProperty(tokenName))
          {
            if (!tokenNames[tokenName])
              unusedL10nTokens[absDictFilename][tokenName] = true;
            else
              delete unusedL10nTokens[absDictFilename][tokenName];
          }
        }

        if (!Object.keys(unusedL10nTokens[absDictFilename]).length)
          delete unusedL10nTokens[absDictFilename];
      }
    }
  });

  if (Object.keys(unusedL10nTokens).length) {
    for (var dictFileName in unusedL10nTokens){
      var tokenNames = unusedL10nTokens[dictFileName];

      dictFileName = dictFileName.slice(process.cwd().length);

      for (var tokenName in tokenNames)
      {
        result['unused l10n tokens'] = result['unused l10n tokens'] || [];
        result['unused l10n tokens'].push({
          loc: dictFileName,
          message: tokenName + ' at ' + dictFileName
        });
      }
    }
  }

  return result;
};
