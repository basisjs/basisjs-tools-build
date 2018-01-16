var path = require('path');
var fs = require('fs');
var crypto = require('crypto');

var externalRx = /^(\s*[a-z0-9\-]+:)?\/\//i;
var queryAndHashRx = /[\?\#].*$/;
var slashRx = /\\/g;

var textFileExt = ['.css', '.js', '.json', '.tmpl', '.txt', '.svg', '.html'];
var textType = ['script', 'style', 'template', 'json', 'l10n', 'culture', 'xml', 'svg', 'text'];

var typeByExt = {
  '.js': 'script',
  '.css': 'style',
  '.tmpl': 'template',
  '.html': 'html',
  '.json': 'json',
  '.l10n': 'json',
  '.xml': 'xml',
  '.svg': 'svg',
  '.cur': 'image',
  '.ico': 'image',
  '.bmp': 'image',
  '.gif': 'image',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.tiff': 'image',
  '.ttf': 'font',
  '.woff': 'font',
  '.eot': 'font'
};

var typeNotFoundHandler = {
  '.js': '/* Javascript file {filename} not found */',
  '.css': '/* CSS file {filename} not found */'
};

function getFileContentOnFailure(filename){
  return (typeNotFoundHandler[path.extname(filename)] || '').replace(/\{filename\}/, filename);
}

function unixpath(filename){
  return path.normalize(filename).replace(slashRx, '/').replace(/^[a-z]\:/i, '');
}

function abspath(baseURI, filename){
  return unixpath(path.resolve(baseURI, filename.replace(queryAndHashRx, '')).replace(/^[a-z]\:/i, ''));
}

function isExternal(uri){
  return externalRx.test(uri);
}

function getRef(seed, type){
  seed[type] = (type in seed ? seed[type] : -1) + 1;
  return seed[type].toString(36) + type;
}


/**
 * @class File
 */

function File(manager, cfg){
  this.manager = manager;
  this.linkTo = [];
  this.linkBack = [];

  for (var key in cfg)
    this[key] = cfg[key];

  if (!this.type)
    this.type = manager.typeByExt[this.ext] || typeByExt[this.ext] || 'unknown';

  if (!this.filename)
  {
    var type = (this.generated ? 'generated-' : '') + this.type;
    manager.inline[type] = (manager.inline[type] || 0) + 1;
    this.inlineId = '[' + (this.inline ? 'inline ' : '') + type + '#' + manager.inline[type] + ']';
  }
};

File.prototype = {
  resolve: function(filename){
    if (isExternal(filename))
      return filename;

    // remove everything after ? (query string) or # (hash)
    filename = filename.replace(queryAndHashRx, '');

    return unixpath(path.resolve(this.baseURI, filename));
  },

  // input filename
  get dirname(){
    return this.filename
      ? path.dirname(this.filename)
      : '';
  },
  get basename(){
    return this.filename
      ? path.basename(this.filename)
      : '';
  },
  get name(){
    return this.filename
      ? path.basename(this.filename, path.extname(this.filename))
      : '';
  },
  get ext(){
    return this.filename
      ? path.extname(this.filename)
      : '';
  },
  get relpath(){
    return this.filename
      ? unixpath(path.relative(this.manager.baseURI, this.filename))
      : this.sourceFilename || this.inlineId;
  },
  get reldir(){
    return this.filename
      ? path.dirname(this.relpath)
      : this.sourceFilename || this.inlineId;
  },
  get fsFilename(){
    return this.filename
      ? this.manager.getFSFilename(this.filename)
      : this.sourceFilename || this.inlineId;
  },

  // input baseURI
  get baseURI(){
    if (!this.baseURI_)
      this.baseURI_ = unixpath(this.filename ? path.dirname(this.filename) + '/' : '');
    return this.baseURI_;
  },
  set baseURI(uri){
    if (!this.filename)
      this.baseURI_ = unixpath(path.resolve(this.manager.baseURI, uri) + '/');
  },

  // output filename
  get outputFilename(){
    return this.outputFilename_;
  },
  set outputFilename(filename){
    this.outputFilename_ = filename && unixpath(filename);
    this.inline = false;
  },
  get relOutputFilename(){
    return this.outputFilename || ('outputContent' in this ? this.inlineId : '[no output]');
  },

  // refs
  get jsRef(){
    if (!this.jsRef_)
      this.jsRef_ = this.manager.getRef(this.ext);
    return this.jsRef_;
  },
  set jsRef(ref){
    this.jsRef_ = ref;
  },

  // links
  link: function(file, token){
    var link = [file, token];
    token = token || null;

    this.linkTo.push(link);
    this.manager.links.push([this, file]);
    file.linkBack.push([this, token]);

    if (token)
    {
      if (file.warn)
      {
        var loc = token.loc || '';
        var warn = {
          fatal: true,
          loc: loc,
          file: this.filename || this.relpath || loc.replace(/:\d+:\d+$/, ''),
          message: file.warn.message
        };

        if (!this.manager.flow.hasWarn(warn))
          this.manager.flow.warn(warn);
      }
    }
  },
  linkFrom: function(file){
    file.link(this);
  },
  unlink: function(file, token){
    token = token || null;

    for (var i = this.linkTo.length - 1; i >= 0; i--)
    {
      var link = this.linkTo[i];
      if (link[0] === file && link[1] === token)
        this.linkTo.splice(i, 1);
    }

    for (var i = this.linkBack.length - 1; i >= 0; i--)
    {
      var link = this.linkBack[i];
      if (link[0] === file && link[1] === token)
        this.linkBack.splice(i, 1);
    }
  },

  hasLinkTo: function(file){
    return this.linkTo.some(function(link){
      return link[0] == file;
    });
  },
  hasLinkFrom: function(file){
    return file.hasLinkTo(this);
  },
  hasLinkType: function(type){
    return this.linkBack.some(function(link){
      return link[0].type == type;
    });
  },

  // misc
  get digest(){
    if (!this.digest_)
    {
      var hash = crypto.createHash('md5');
      hash.update(this.outputContent || this.content || '');
      this.digest_ = hash.digest('base64')
        // remove trailing == which always appear on md5 digest, save 2 bytes
        .replace(/=+$/, '')
        // make digest web safe
        .replace(/\//g, '_')
        .replace(/\+/g, '-');
    }

    return this.digest_;
  },
  get encoding(){
    return textType.indexOf(this.type) == -1 && textFileExt.indexOf(this.ext) == -1 ? 'binary' : 'utf-8';
  },

  get hostFilename(){
    return this.embed ? this.embed.file : this.filename;
  },
  location: function(loc){
    if (loc)
    {
      if (this.inline && this.embed)
        loc = this.embed.start
          ? [
              this.embed.file,
              this.embed.start.line + loc.line,
              (loc.line ? 0 : this.embed.start.column) + loc.column
            ]
          : [
              this.embed.file
            ];
      else
      {
        loc = loc.start || loc;
        loc = [
          this.filename,
          loc.line,
          loc.column
        ];
      }

      return loc.join(':');
    }
  }
};

/**
 * @class FileManager
 */

var FileManager = function(baseURI, relBaseURI, console, flow){
  this.baseURI = abspath('/', relBaseURI);
  this.fsBaseURI = baseURI;
  this.console = console;
  this.preprocess = {};
  this.typeByExt = {};
  this.refSeed = {};
  this.inline = {};
  this.flow = flow;

  this.map = {};
  this.queue = [];
  this.symlinks = {};
  this.links = [];
  this.warns = [];

  this.readInfo = [];
};

FileManager.prototype = {
  resolve: function(filename, baseURI){
    return abspath(abspath(baseURI || '.', this.baseURI), filename);
  },

  relative: function(filename){
    return abspath('/', path.relative(this.fsBaseURI, filename));
  },

  addSymlink: function(from, to){
    from = path.normalize(from).replace(/\\/g, '/').replace(/\/$/, '');
    to = path.resolve(this.fsBaseURI, to).replace(/\\/g, '/').replace(/\/$/, '');
    this.symlinks[from] = to;
  },

 /**
  * Returns absolute filesystem filename.
  * @param {string} filename
  * @return {string}
  */
  getFSFilename: function(filename){
    // resolve by symlink if possible
    for (var from in this.symlinks)
      if (filename.indexOf(from) === 0 && (filename === from || filename[from.length] === '/'))
        return this.symlinks[from] + filename.substr(from.length);

    return path.resolve(this.fsBaseURI, filename.replace(/^[\\\/]/, ''));
  },

 /**
  * Generate reference for ext.
  * @param {string} ext
  * @return {string}
  */
  getRef: function(ext){
    return getRef(this.refSeed, ext || '.inline');
  },

 /**
  * Get reference for File by filename.
  * @param {string} filename Path to file.
  * @returns {File} Returns file if exists.
  */
  get: function(filename){
    return this.map[abspath(this.baseURI, filename)];
  },

  read: function(filename){
    function warn(message){
      if (this.contextFile_)
      {
        var warn = {
          fatal: true,
          file: this.contextFile_,
          message: message
        };

        this.warns.push(warn);
        this.flow.warn(warn);
      }
    }

    filename = abspath(this.baseURI, filename);

    var fsFilename = this.getFSFilename(filename);
    var file = this.map[filename];
    var content = '';

    if (file)
      return file.content;

    if (!fs.existsSync(fsFilename))
    {
      warn.call(this, 'File `' + filename + '` not found');
      return '';
    }

    var stat = fs.statSync(fsFilename);
    if (!stat.isFile())
    {
      warn.call(this, '`' + filename + '` is not a file');
      return '';
    }

    file = new File(this, { filename: filename });
    file.mtime = stat.mtime;

    content = fs.readFileSync(fsFilename, file.encoding);

    // collect data to produce content digest
    this.readInfo.push({
      filename: filename,
      encoding: file.encoding,
      content: content
    });

    // preprocessing by extension
    var preprocessors = this.preprocess[file.ext] || [];
    for (var i = 0, processor; processor = preprocessors[i]; i++)
      content = processor(content, file, this.fsBaseURI, this.console);

    // preprocessing by type
    var preprocessors = this.preprocess[file.type] || [];
    for (var i = 0, processor; processor = preprocessors[i]; i++)
      content = processor(content, file, this.fsBaseURI, this.console);

    return content;
  },

 /**
  * Create new file or return existing. It can returns undefined if filename is external reference.
  * @param {object} data Config object to create new file.
  * @return {File|undefined}
  *
  * TODO: extend file with ?, if it already exists
  * TODO: create file with uri, if it's external?
  */
  add: function(data){
    function getLocation(initiator){
      if (!initiator)
        return null;

      if (initiator.loc)
        return initiator.loc;

      var result = initiator.file.filename;
      if (initiator.start)
        result += ':' + initiator.start.line + ':' + initiator.start.column;
      return result;
    }

    var initiator = data.initiator;
    var file;

    delete data.initiator;

    if (!data.filename)
    {
      file = new File(this, data);
      this.console.log('[+] ' + file.relpath + ' (' + file.type + (file.generatedFrom ? ', source: ' + file.generatedFrom : '') + ')');
    }
    else
    {
      // ignore references for external resources
      if (isExternal(data.filename))
      {
        // external resource
        this.console.log('[i] External resource `' + data.filename + '` ignored');
        return;
      }

      var filename = abspath(this.baseURI, data.filename);

      if (this.map[filename]) // ignore duplicates
      {
        this.console.log('[ ] ' + unixpath(path.relative(this.baseURI, filename)) + ' (already in queue)');
        return this.map[filename];
      }

      // create file
      data.filename = filename;
      file = new File(this, data);

      // read content
      var fsFilename = this.getFSFilename(filename);
      if (fs.existsSync(fsFilename))
      {
        if (fs.statSync(fsFilename).isFile())
        {
          this.console.start('[+] ' + filename + ' (' + file.type + ')');

          file.content = this.read(filename);

          this.console.end();
        }
        else
        {
          file.warn = '`' + filename + '` is not a file';
        }
      }
      else
      {
        file.warn = 'File `' + filename + '` not found';
      }


      if (file.warn)
      {
        file.warn = {
          fatal: true,
          file: initiator ? initiator.file.filename : file.relpath,
          message: file.warn + (initiator && initiator.token ? ': ' + initiator.token : ''),
          loc: getLocation(initiator)
        };
        this.warns.push(file.warn);
        this.flow.warn(file.warn);
        file.content = getFileContentOnFailure(filename);
      }

      this.map[filename] = file;
    }

    this.queue.push(file);

    return file;
  },

 /**
  * Remove a file from manager and break all links between files.
  * @param {File|string} fileRef File name or File instance to be removed.
  */
  remove: function(fileRef){
    var filename;
    var file;

    if (fileRef instanceof File)
    {
      file = fileRef;
      filename = file.filename;
    }
    else
    {
      filename = abspath(this.baseURI, fileRef);
      file = this.map[filename];

      if (!file)
      {
        this.flow.warn({
          file: filename,
          message: 'File `' + fileRef + '` not found in map'
        });
        return;
      }
    }

    // remove links
    for (var i = file.linkTo.length, linkTo; linkTo = file.linkTo[i]; i--)
      file.unlink(linkTo);

    for (var i = file.linkBack.length, linkBack; linkBack = file.linkBack[i]; i--)
      linkBack.unlink(file);

    // remove from queue
    var index = this.queue.indexOf(file);

    if (index != -1)
      this.queue.splice(index, 1);

    // remove from map
    if (filename)
      delete this.map[filename];
  },

 /**
  * Remove all files
  */
  clear: function(){
    this.queue.slice().forEach(this.remove, this);
  },

  mkdir: function(dirpath){
    if (!fs.existsSync(dirpath))
    {
      this.console.log('Create folder ' + dirpath);
      fs.mkdirSync(dirpath);
    }
  }
};

//
// export
//

module.exports = FileManager;
