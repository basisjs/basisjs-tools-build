var path = require('path');
var fs = require('fs');

module.exports = function(base, extFilter){
  var stack = [base];
  var cursor;
  var collectedFiles = {};

  while (cursor = stack.pop())
  {
    if (!fs.existsSync(cursor))
      continue;

    var stat = fs.lstatSync(cursor);

    if (stat.isSymbolicLink())
    {
      var resolvedLink = path.resolve(cursor, fs.readlinkSync(cursor));

      stack.push(resolvedLink);
    }
    else if (stat.isDirectory())
    {
      var items = fs.readdirSync(cursor);

      for (var i = 0; i < items.length; i++)
        stack.push(path.join(cursor, items[i]));
    }
    else
    {
      if (extFilter)
      {
        var fileExt = path.extname(cursor);

        if (fileExt.toLowerCase() === extFilter.toLowerCase())
          collectedFiles[cursor] = true;
      }
      else
        collectedFiles[cursor] = true;
    }
  }

  return collectedFiles;
};
