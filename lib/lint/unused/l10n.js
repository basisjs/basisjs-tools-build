function isTarget(flow, basePath, collectPath, file){
  return file.filename && (basePath + file.filename).indexOf(collectPath + '/') === 0 && !flow.ignoreWarning(file.filename);
}

var TOKEN_REF_UNUSED = 0;
var TOKEN_REF_THROUGH = 1;
var TOKEN_REF_IMPLICIT = 2;
var TOKEN_REF_EXPLICIT = 3;

var usageMap = {
  through: TOKEN_REF_THROUGH,
  implicit: TOKEN_REF_IMPLICIT,
  explicit: TOKEN_REF_EXPLICIT
};

exports.collectUsed = function(flow){
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
          usedTokens[dictFilename][tokenName] = usageMap[tokenInfo.usage];
        else
          usedTokens[dictFilename][tokenName] = TOKEN_REF_UNUSED;
      }

      // mark unused tokens in explicitly used branches as implicitly used
      for (tokenName in usedTokens[dictFilename])
      {
        if (!usedTokens[dictFilename][tokenName])
        {
          var parts = tokenName.split('.');
          var passed = [];

          if (parts.length > 1)
          {
            // collect branches till explicitly used branch
            while (parts.length)
            {
              var currentPath = parts.join('.');

              if (usedTokens[dictFilename][currentPath] === TOKEN_REF_EXPLICIT)
                break;

              passed.push(currentPath);
              parts.pop();
            }

            // if we have an explicitly used branch then mark collected branches as implicitly used
            if (parts.length)
              for (var i = 0; i < passed.length; i++)
                usedTokens[dictFilename][passed[i]] = TOKEN_REF_IMPLICIT;
          }
        }
      }
    }
  }

  return {
    basePath: basePath,
    collectPath: collectPath,
    items: usedTokens
  };
};

exports.warn = function(flow){
  if (flow.options.warnUnusedL10n && flow.usedL10nTokens)
  {
    var usedL10nTokensInfo = flow.usedL10nTokens;

    for (var dictFileName in usedL10nTokensInfo.items){
      var tokenNames = usedL10nTokensInfo.items[dictFileName];

      for (var tokenName in tokenNames) {
        if (!tokenNames[tokenName]) {
          flow.warn({
            file: dictFileName,
            message: tokenName
          });
        }
      }
    }
  }
};
