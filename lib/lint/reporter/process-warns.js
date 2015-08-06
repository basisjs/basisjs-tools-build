var path = require('path');

module.exports = function(flow){
  var result = {};
  var fileFilter = flow.options.filter;
  var fileCount = 0;

  flow.warns.forEach(function(warn){
    var filename = warn.file;

    if (!filename)
      return;

    if (fileFilter && filename.indexOf(fileFilter) !== 0)
      return;

    if (!result[filename])
    {
      fileCount++;
      result[filename] = [];
    }

    result[filename].push({
      loc: warn.loc,
      message: warn.message
    });
  });

  flow.fileCount = fileCount;

  return result;
};
