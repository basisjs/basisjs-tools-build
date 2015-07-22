var path = require('path');

module.exports = function(flow){
  var result = {};
  var fileFilter = flow.options.filename_;

  flow.warns.forEach(function(warn){
    var filename = warn.file;

    if (!filename)
      return;

    if (fileFilter && flow.files.getFSFilename(filename).indexOf(fileFilter) !== 0)
      return;

    if (!result[filename])
      result[filename] = [];

    result[filename].push({
      loc: warn.loc,
      message: warn.message
    });
  });

  return result;
};
