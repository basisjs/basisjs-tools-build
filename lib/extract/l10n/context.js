var Dictionary = require('./Dictionary.js');
var path = require('path');

//
// exports
//
module.exports = {
  create: function(flow, file){
    return {
      version: 2,
      module: file,

      cultures: { 'en-US': {} },
      dictionaries: {},

      getToken: function(path){
        var parts = path.split('@');
        var name = parts[0];
        var dictionary = this.getDictionary(parts[1]);

        return dictionary.getToken(name);
      },
      getDictionary: function(filename){
        var basisjsDictionary = flow.js.basis.require('basis.l10n').dictionary(filename);

        filename = basisjsDictionary.resource.url;

        var dictionary = this.dictionaries[filename];

        if (!dictionary)
        {
          var file = flow.files.add({
            type: 'l10n',
            jsRefCount: 0,
            filename: filename
          });
          file.isResource = true;

          dictionary = this.dictionaries[filename] = new Dictionary(file, flow, basisjsDictionary);
        }

        return dictionary;
      }
    };
  }
};
