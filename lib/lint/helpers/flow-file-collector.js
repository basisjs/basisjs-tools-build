module.exports = function collectFiles(flow, callback){
  var stack = [flow.files.queue[0]];
  var collectedFiles = {};
  var handled = new WeakSet();
  var cursor;

  while (cursor = stack.pop())
  {
    // mark file as handled
    handled.add(cursor);
    callback(cursor);
    cursor.linkTo.forEach(function(link){
      // prevent handling files that are already handled
      if (link[0] && !handled.has(link[0])) {
        stack.push(link[0]);
      }
    });
  }

  return collectedFiles;
};
