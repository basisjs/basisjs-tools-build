var collect = require('./fileCollector');

function isTarget(basePath, collectPath, file){
  return file.filename && (basePath + file.filename).indexOf(collectPath + '/') === 0;
}

module.exports = function collectUsedFiles(flow){
  var options = flow.options;
  var basePath = options.base;
  var collectPath = flow.files.abspath(basePath, options.warnUnusedFiles);
  var usedFiles = {};

  collect(flow, function(file){
    if (isTarget(basePath, collectPath, file))
      usedFiles[file.filename] = true;

    if (file.type == 'template')
    {
      if (file.decl.deps)
      {
        file.decl.deps.forEach(function(resource){
          if (!resource.virtual && isTarget(basePath, collectPath, { filename: resource.url }))
            usedFiles[resource.url] = true;
        });
      }
      if (file.decl.l10n)
      {
        file.decl.l10n.forEach(function(item){
          var l10nInfo = item.split('@');
          var dictFilename = l10nInfo[1];

          if (isTarget(basePath, collectPath, { filename: dictFilename }))
            usedFiles[dictFilename] = true;
        });
      }
      if (file.decl.styles)
      {
        file.decl.styles.forEach(function(style){
          if (!style.resource && isTarget(basePath, collectPath, { filename: style.sourceUrl }))
            usedFiles[style.sourceUrl] = true;
        });
      }
    }
  });

  flow.usedFiles = {
    basePath: basePath,
    collectPath: collectPath,
    items: Object.keys(usedFiles)
  };
};
