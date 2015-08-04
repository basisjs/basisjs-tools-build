var path = require('path');

module.exports = function(flow){
  var result = {};
  var fileFilter = flow.options.filter;

  flow.warns.stat = {
    files: 0,
    warnings: 0
  };

  flow.warns.forEach(function(warn){
    var filename = warn.file;

    if (!filename)
      return;

    if (fileFilter && filename.indexOf(fileFilter) !== 0)
      return;

    if (!result[filename])
    {
      flow.warns.stat.files++;
      result[filename] = [];
    }

    flow.warns.stat.warnings++;
    result[filename].push({
      loc: warn.loc,
      message: warn.message
    });
  });

  return result;
};
