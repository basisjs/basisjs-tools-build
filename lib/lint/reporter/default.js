module.exports = function(data){
  var output = [];
  var names = Object.keys(data);

  if (names.length)
  {
    var warnToShowCount = names.reduce(function(res, key){
      return res + data[key].length;
    }, 0);

    output.push(
      'Warnings (' + warnToShowCount + '):\n'
    );

    Object.keys(data).sort().forEach(function(filename){
      output.push('  ' + filename);
      output.push.apply(output, data[filename].map(function(w){
        return '    * ' + w.message;
      }));
      output.push('');
    });
  }

  return output.join('\n');
};
