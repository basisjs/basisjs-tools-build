var path = require('path');

module.exports = function(flow){
  var fconsole = flow.console;
  var queue = flow.files.queue;

  fconsole.start('Search for first JavaScript file');
  for (var i = 0, file; file = queue[i]; i++)
    if (file.outputFilename && file.type === 'script' && 'outputContent' in file)
    {
      fconsole.log('File found: ' + file.outputFilename);

      fconsole.start('Build bundle');
      var bundleFormat = flow.options.jsBundle;
      var bundleName = flow.options.jsBundleName;
      var bundle = {
        deps: queue.map(function(file){
          return !file.inline && file !== flow.indexFile ? file.filename : false;
        }).filter(Boolean),
        content: file.outputContent
      };
      fconsole.log('Content: ' + bundle.content.length + ' bytes');
      fconsole.log('Dependencies: ' + bundle.deps.length);
      fconsole.end();

      if (bundleFormat === 'js')
        bundle = bundle.content;
      else if (flow.options.target !== 'none')
        bundle = JSON.stringify(bundle);

      // remove all files
      fconsole.log('Drop all output files.');
      flow.files.clear();

      // add archive as single result file
      fconsole.log('Add bundle as single result file.');
      flow.files.add({
        type: 'json',
        outputFilename: bundleName + '.' + bundleFormat,
        outputContent: bundle
      });

      return;
    }

  fconsole.log('[WARN] File not found');
};

module.exports.handlerName = '[misc] Build bundle';
module.exports.skip = function(flow){
  if (!flow.options.jsBundle)
    return 'Use option `--js-bundle`';
};
