var fs = require('fs');
var path = require('path');
var Flow = require('../common/flow');
var command = require('./command');


//
// launched by another module
//
exports.find = function(config){
  if (this === command)
    find(config);

  if (this === exports)
    find(command.normalize(config));
};

//
// launched directly (i.e. node index.js ..)
//
if (process.mainModule === module)
  command.run();


//
// main function
//
function find(config){

  //
  // init
  //

  var options = command.norm(config);
  var inputFilename = options.file;
  var flow = new Flow(options);
  var fconsole = flow.console;

  fconsole.enabled = options.verbose;

  //
  // process input
  //

  // check input file exists
  if (!fs.existsSync(inputFilename) || !fs.statSync(inputFilename).isFile())
    flow.exit('Input file ' + inputFilename + ' not found');

  // add input file in queue
  flow.indexFile = flow.files.add({
    isIndexFile: true,
    filename: path.basename(inputFilename)
  });


  //
  // Main part
  //

  require('../extract/html/index.js')(flow);

  var queue = flow.files.queue;
  var basisResolveNSFilename;
  var basisResolveURI;
  var result;

  flow.js = {
    rootNSFile: {},
    rootBaseURI: {},
    rootFilename: {}
  };

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script')
    {
      var attrs = file.htmlNode.attribs || {};
      var configAttr = false;

      if (attrs.hasOwnProperty('data-basis-config'))
        configAttr = 'data-basis-config';
      else
        if (attrs.hasOwnProperty('basis-config'))
          configAttr = 'basis-config';

      if (configAttr)
      {
        var processBasisFile = require('../extract/js/processBasisFile');
        processBasisFile(flow, file, attrs[configAttr] || '');
        basisResolveNSFilename = flow.js.basis.resolveNSFilename;
        basisResolveURI = flow.js.basis.resource.resolveURI;
        break;
      }
    }

  if (!basisResolveNSFilename && !basisResolveURI)
  {
    console.warn('Resolve functions doesn\'t found');
    return;
  }

  if (typeof basisResolveNSFilename == 'function')
  {
    if (!/[^a-z0-9_\.]/i.test(options.reference) && path.extname(options.reference) != '.js')
    {
      result = basisResolveNSFilename(options.reference);
      if (result)
        console.log(flow.files.getFSFilename(result));
      return;
    }
  }

  if (typeof basisResolveURI == 'function')
  {
    result = basisResolveURI(options.reference);
    if (result)
      console.log(flow.files.getFSFilename(result));
  }
}
