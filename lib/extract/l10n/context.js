var path = require('path');

var hasOwnProperty = Object.prototype.hasOwnProperty;

function walkTokens(dictionary, culture, tokens, path){
  var cultureValues = dictionary.cultureValues[culture];

  path = path ? path + '.' : '';

  for (var key in tokens)
    if (hasOwnProperty.call(tokens, key))
    {
      var tokenName = path + key;
      var tokenValue = tokens[key];
      var token = dictionary.tokens[tokenName];

      cultureValues[tokenName] = tokenValue;

      if (tokenName in dictionary.tokens == false)
        token = dictionary.tokens[tokenName] = new Token(dictionary, tokenName);

      token.culture = culture;
      token.branch = tokens;
      token.key = key;

      if (tokenValue && (typeof tokenValue == 'object' || Array.isArray(tokenValue)))
        walkTokens(dictionary, culture, tokenValue, tokenName);
    }
}

function addRef(file, refToken){
  for (var i = 0, ref; ref = this.ref[i]; i++)
    if (ref.file === file && ref.refToken === refToken)
      return;

  this.ref.push({
    file: file,
    refToken: refToken
  });
}

/**
* @class
*/
var Dictionary = function(file, flow){
  function parentTypeIsMarkup(key){
    var parentKey = key.replace(/\.[^\.]+$/, '');

    return parentKey != key ? types[parentKey] == 'enum-markup' || types[parentKey] == 'plural-markup' : false;
  }

  function parentTypeIsPlural(key){
    var parentKey = key.replace(/\.[^\.]+$/, '');

    return parentKey != key ? types[parentKey] == 'plural' || types[parentKey] == 'plural-markup' : false;
  }

  var data = {};

  this.file = file;
  this.tokens = {};
  this.cultureValues = {};
  this.markupTokens = [];
  this.ref = [];

  try {
    // try to parse file content
    data = JSON.parse(file.content);
  } catch(e) {
    flow.warn({
      fatal: true,
      file: this.file.relpath,
      message: 'Can\'t parse content of ' + file.relpath + ': ' + e
    });
  }

  // apply token data
  file.jsResourceContent = data;

  for (var culture in data)
    if (!/^_|_$/.test(culture)) // ignore names with underscore in the begining or ending (reserved for meta)
    {
      this.cultureValues[culture] = {};
      walkTokens(this, culture, data[culture]);
    }

  // apply types
  var types = (data._meta && data._meta.type) || {};
  for (var key in this.tokens)
  {
    if (types[key] == 'default' ||
        types[key] == 'plural' ||
        types[key] == 'markup' ||
        types[key] == 'plural-markup' ||
        types[key] == 'enum-markup')
      this.tokens[key].type = types[key];
    else
    {
      if (types.hasOwnProperty(key))
        flow.warn({
          file: this.file.relpath,
          theme: culture,
          message: 'Unknown token type for path `' + key + '`: ' + types[key]
        });
    }

    if (types[key] == 'markup' || (!types[key] && parentTypeIsMarkup(key)))
      for (var culture in this.cultureValues)
        if (this.cultureValues[culture].hasOwnProperty(key))
        {
          if (typeof this.cultureValues[culture][key] != 'string')
          {
            flow.warn({
              file: this.file.relpath,
              theme: culture,
              message: 'Markup token is not a string: ' + key
            });
            continue;
          }

          var templateKey = '#' + (flow.tmpl.implicitDefineSeed++).toString(36);
          var content = this.cultureValues[culture][key];

          if (typeof content == 'string' && parentTypeIsPlural(key))
            content = content.replace(/\{#\}/g, '{__templateContext}');

          var tokenFile = flow.files.add({
            type: 'template',
            inline: true,
            jsRefCount: 1,
            themes: [],
            isResource: true,
            content: content,
            ownerUrl: file.relpath
          });

          var resource = flow.js.basis.resource.virtual(
            'tmpl',
            tokenFile.content,
            file.relpath
          );

          this.markupTokens.push({
            token: this.tokens[key],
            templatePath: templateKey
          });

          flow.js.basis.template.define(templateKey, resource);
          if (flow.tmpl.defineKeys.indexOf(templateKey) == -1)
            flow.tmpl.defineKeys.push(templateKey);
          flow.tmpl.implicitDefine.base[templateKey] = tokenFile;
          flow.tmpl.themeResources.base[templateKey] = {
            resourceRef: tokenFile,
            themeDefined: true
          };

          tokenFile.filename = 'l10n-template.tmpl';
          tokenFile.filename = tokenFile.jsRef && null; // generate jsRef

          file.link(tokenFile);
        }
  }

  // check type definitions match to token paths
  for (var path in types)
    if (!this.tokens.hasOwnProperty(path))
      flow.warn({
        file: this.file.relpath,
        message: 'Type definition doesn\'t match to any token path: ' + path
      });
};

Dictionary.prototype.getToken = function(name){
  var token = this.tokens[name];
  if (!token)
    token = this.tokens[name] = new Token(this, name, true);

  return token;
};

Dictionary.prototype.addRef = addRef;


/**
* @class
*/
var Token = function(dictionary, name, implicit){
  this.dictionary = dictionary;
  this.name = name;
  this.implicit = implicit;
  this.ref = [];
};

Token.prototype.type = 'default';
Token.prototype.comment = null;

Token.prototype.addRef = addRef;


/**
* @class
*/
var Patch = function(file, dictionary){
  this.file = file;
  this.dictionary = dictionary;
  this.ref = [];

  try {
    // try to parse file content
    data = JSON.parse(file.content);
  } catch(e) {
    flow.warn({
      fatal: true,
      file: this.file.relpath,
      message: 'Can\'t parse content of ' + file.relpath + ': ' + e
    });
  }

  // apply token data
  file.jsResourceContent = data;
};

Patch.prototype.addRef = addRef;


//
// exports
//
module.exports = function(flow, file){
  return {
    module: file,

    cultures: { 'en-US': ['en-US'] },
    dictionaries: {},
    patches: {},

    getToken: function(path){
      var parts = path.split('@');
      return this.getDictionary(parts[1]).getToken(parts[0]);
    },
    getDictionary: function(filename){
      if (path.extname(filename) != '.l10n')
        filename = path.dirname(filename) + '/' + path.basename(filename, path.extname(filename)) + '.l10n';

      var dictionary = this.dictionaries[filename];

      if (!dictionary)
        dictionary = this.dictionaries[filename] = new Dictionary(flow.files.add({
          type: 'l10n',
          jsRefCount: 0,
          filename: filename,
          isResource: true
        }), flow);

      return dictionary;
    },
    getPatch: function(dictFilename, patchFilename){
      var dict = this.getDictionary(dictFilename);
      var patches = this.patches[dict.file.filename];

      if (!patches)
        patches = this.patches[dict.file.filename] = {};

      if (path.extname(patchFilename) != '.l10n')
        patchFilename = path.dirname(patchFilename) + '/' + path.basename(patchFilename, path.extname(patchFilename)) + '.l10n';

      var patch = patches[patchFilename];

      if (!patch)
        patch = patches[patchFilename] = new Patch(flow.files.add({
          type: 'l10n',
          jsRefCount: 0,
          filename: patchFilename,
          isResource: true
        }), dict);

      return patch;
    }
  };
};
