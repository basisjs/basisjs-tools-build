module.exports = function(flow){
  var fconsole = flow.console;

  if (flow.warns.length)
  {
    var warnByFilename = require('./process-warns.js')(flow);
    var warnToShowCount = Object.keys(warnByFilename).reduce(function(res, key){
      return res + warnByFilename[key].length;
    }, 0);

    fconsole.start(
      'Warnings (' +
        (warnToShowCount != flow.warns.length ? warnToShowCount + ' of ' : '') +
        flow.warns.length +
      '):\n'
    );

    Object.keys(warnByFilename).sort().forEach(function(key){
      fconsole.start(key);
      fconsole.list(warnByFilename[key].map(function(w){
        return w.message;
      }));
      fconsole.endl();
    });
  }
  else
    fconsole.log('No warnings found.');
};
