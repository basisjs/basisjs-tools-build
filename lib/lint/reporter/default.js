module.exports = function(flow){
  var fconsole = flow.console;
  var output = [];

  if (flow.warns.length)
  {
    var warnByFilename = require('./process-warns.js')(flow);
    var warnToShowCount = Object.keys(warnByFilename).reduce(function(res, key){
      return res + warnByFilename[key].length;
    }, 0);

    output.push(
      'Warnings (' +
        (warnToShowCount != flow.warns.length ? warnToShowCount + ' of ' : '') +
        flow.warns.length +
      '):\n'
    );

    Object.keys(warnByFilename).sort().forEach(function(filename){
      output.push('  ' + filename);
      output.push.apply(output, warnByFilename[filename].map(function(w){
        return '    * ' + w.message;
      }));
      output.push('');
    });
  }

  flow.result = output.join('\n');
};
