var flowFilesCollector = require('../helpers/flow-file-collector');
var collectFiles = require('../helpers/fs-files-collector');

function isTarget(basePath, collectPath, file){
  return file.filename && (basePath + file.filename).indexOf(collectPath + '/') === 0;
}

exports.collectUsed = function(flow){
  var options = flow.options;
  var basePath = options.base;
  var collectPath = flow.files.abspath(basePath, options.warnUnusedFiles);
  var usedFiles = {};

  flowFilesCollector(flow, function(file){
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

  return {
    basePath: basePath,
    collectPath: collectPath,
    items: Object.keys(usedFiles)
  };
};

exports.warn = function(flow){
  if (flow.options.warnUnusedFiles && flow.usedFiles)
  {
    var usedFilesInfo = flow.usedFiles;
    var usedFiles = {};
    var basePath = usedFilesInfo.collectPath;
    var collectedFiles = collectFiles(basePath);

    usedFilesInfo.items.forEach(function(filename){
      usedFiles[usedFilesInfo.basePath + filename] = true;
    });

    for (var usedFile in usedFiles)
      delete collectedFiles[usedFile];

    for (var unusedName in collectedFiles) {
      unusedName = unusedName.slice(process.cwd().length);
      flow.warn({
        file: 'unused files',
        message: unusedName
      });
    }
  }
};
