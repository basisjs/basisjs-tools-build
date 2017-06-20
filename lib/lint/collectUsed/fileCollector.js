module.exports = function collectFiles(flow, callback){
  var stack = [flow.files.queue[0]];
  var collectedFiles = {};
  var handled = {};
  var cursor;

  while (cursor = stack.pop())
  {
    // mark file as handled
    handled[cursor.uniqueId] = true;
    callback(cursor);
    cursor.linkTo.forEach(function(link){
      // prevent handling files that are already handled
      if (link[0] && !handled[link[0].uniqueId]) {
        stack.push(link[0]);
      }
    });
  }

  return collectedFiles;
};
