var isChildProcess = typeof process.send == 'function'; // child process has send method

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
    if (options.warnUnusedL10n && flow.usedL10nTokens)
    {
      var usedL10nTokensInfo = flow.usedL10nTokens;

      for (var dictFileName in usedL10nTokensInfo.items){
        var tokenNames = usedL10nTokensInfo.items[dictFileName];

        for (var tokenName in tokenNames) {
          if (!tokenNames[tokenName]) {
            result[dictFileName] = result[dictFileName] || [];
            result[dictFileName].push({
              loc: dictFileName,
              message: tokenName
            });
          }
        }
      }
    }
  }

  return result;
};
