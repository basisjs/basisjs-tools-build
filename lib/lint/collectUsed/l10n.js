function isTarget(flow, basePath, collectPath, file){
  return file.filename && (basePath + file.filename).indexOf(collectPath + '/') === 0 && !flow.ignoreWarning(file.filename);
}

module.exports = function collectUsedL10n(flow){
  var options = flow.options;
  var basePath = options.base;
  var collectPath = flow.files.abspath(basePath, options.warnUnusedL10n);
  var usedTokens = {};

  if (!flow.l10n || !flow.l10n.dictionaries)
    return;

  for (var dictFilename in flow.l10n.dictionaries)
  {
    if (isTarget(flow, basePath, collectPath, { filename: dictFilename }))
    {
      var dict = flow.l10n.dictionaries[dictFilename];
      var dictTokens = dict.tokens;

      // mark tokens as explicitly, implicitly or not used
      for (var tokenName in dictTokens)
      {
        var tokenInfo = dictTokens[tokenName];

        usedTokens[dictFilename] = usedTokens[dictFilename] || {};

        if (tokenInfo.ref.length)
          usedTokens[dictFilename][tokenName] = tokenInfo.hasExplicitRef ? true : 'implicit';
        else
          usedTokens[dictFilename][tokenName] = false;
      }

      // mark unused tokens in used branches as implicitly used
      for (tokenName in usedTokens[dictFilename])
      {
        if (!usedTokens[dictFilename][tokenName])
        {
          var lastDotIx = tokenName.lastIndexOf('.');

          if (lastDotIx > -1)
          {
            var branchName = tokenName.slice(0, lastDotIx);

            if (usedTokens[dictFilename][branchName])
              usedTokens[dictFilename][tokenName] = 'implicit';
          }
        }
      }
    }
  }

  flow.usedL10nTokens = {
    basePath: basePath,
    collectPath: collectPath,
    items: usedTokens
  };
};
