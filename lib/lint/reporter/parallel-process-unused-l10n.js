module.exports = function handleUnusedL10n(tasks){
  var usedL10nTokens = {};
  var unusedL10nTokens = {};

  // merge used l10n tokens from tasks
  // and collect used and unused l10n tokens
  tasks.forEach(function(task){
    if (task.result.usedL10nTokens)
      for (var dictFileName in task.result.usedL10nTokens.items)
      {
        var absDictFilename = task.result.usedL10nTokens.basePath + dictFileName;
        var tokenUsageInfo = task.result.usedL10nTokens.items[dictFileName];

        usedL10nTokens[absDictFilename] = usedL10nTokens[absDictFilename] || {};
        unusedL10nTokens[absDictFilename] = unusedL10nTokens[absDictFilename] || {};

        for (var tokenName in tokenUsageInfo)
          if (tokenUsageInfo.hasOwnProperty(tokenName))
          {
            var used = tokenUsageInfo[tokenName];
            var alreadyUsed = usedL10nTokens[absDictFilename].hasOwnProperty(tokenName);

            if (alreadyUsed)
              continue;

            if (!used)
              unusedL10nTokens[absDictFilename][tokenName] = true;
            else
            {
              usedL10nTokens[absDictFilename][tokenName] = true;
              delete unusedL10nTokens[absDictFilename][tokenName];
            }
          }

        if (!Object.keys(unusedL10nTokens[absDictFilename]).length)
          delete unusedL10nTokens[absDictFilename];
      }
  });

  // warn about unused l10n tokens
  if (Object.keys(unusedL10nTokens).length)
  {
    for (var dictFileName in unusedL10nTokens)
    {
      var tokenNames = unusedL10nTokens[dictFileName];

      dictFileName = dictFileName.slice(process.cwd().length);

      var key = 'unused l10n tokens at ' + dictFileName;
      var task = { name: key, result: { warnings: [] } };

      for (var tokenName in tokenNames)
      {
        task.result.warnings.push({
          file: tokenName
        });
      }

      tasks.push(task);
    }
  }
};
