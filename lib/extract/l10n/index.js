var tmplAt = require('basisjs-tools-ast').tmpl;

(module.exports = function(flow){
  var fconsole = flow.console;

  // Todo: remove
  // build is broken otherwise (investigate why?)
  flow.js.basis.require('basis.l10n');

  //
  // Collect template l10n paths
  //
  var l10nPrefix = /^l10n:/;
  var tmplRefs = [];

  fconsole.start('# Collect keys in templates');
  flow.files.queue.forEach(function(file){
    if (file.type == 'template')
    {
      fconsole.start(file.relpath);

      tmplAt.walk(file.ast, flow.js.basis.template, {
        text: function(token){
          var bindName = token[1];
          if (l10nPrefix.test(bindName))
          {
            var l10nTokenRef = bindName.substr(5);
            var parts = l10nTokenRef.split('@');
            var tokenName = parts[0];
            var dictFilename = parts[1];
            var tokenNameParts = tokenName.match(/^(.+?)\.{(.+?)}/);

            if (tokenNameParts && tokenNameParts.length == 3) {
              tokenName = tokenNameParts[1];
            }

            l10nTokenRef = tokenName + '@' + dictFilename;

            var l10nToken = flow.l10n.getToken(l10nTokenRef);
            var name = l10nToken.name;
            var dictionary = l10nToken.dictionary;

            fconsole.log(name + ' @ ' + dictionary.file.relpath);

            var tmplRef = {
              file: this.file,
              name: name,
              dictionary: dictionary,
              key: l10nTokenRef,
              host: token,
              idx: 1
            };

            dictionary.file.jsRefCount++;
            dictionary.addRef(this.file);
            this.file.link(dictionary.file);

            // collect through refs
            tokenName.split('.').reduce(function(prev, current){
              var l10nToken = flow.l10n.getToken(prev + '@' + dictFilename);

              l10nToken.addRef(this.file, tmplRef, 'through');

              return prev + '.' + current;
            }.bind(this));
            // add explicit ref
            l10nToken.addRef(this.file, tmplRef, 'explicit');

            tmplRefs.push(tmplRef);
          }
        },
        attr: function(token){
          var attrName = this.tokenName(token);
          if (token[1] && token[0] == 2 && attrName != 'class' && attrName != 'style')
            for (var i = 0, bindings = token[1][0], bindName; bindName = bindings[i]; i++)
              if (l10nPrefix.test(bindName))
              {
                var l10nTokenRef = bindName.substr(5);
                var parts = l10nTokenRef.split('@');
                var tokenName = parts[0];
                var dictFilename = parts[1];
                var tokenNameParts = tokenName.match(/^(.+?)\.{(.+?)}/);

                if (tokenNameParts && tokenNameParts.length == 3) {
                  tokenName = tokenNameParts[1];
                }

                l10nTokenRef = tokenName + '@' + dictFilename;

                var l10nToken = flow.l10n.getToken(l10nTokenRef);
                var name = l10nToken.name;
                var dictionary = l10nToken.dictionary;

                fconsole.log(name + ' @ ' + dictionary.file.relpath);

                var tmplRef = {
                  file: this.file,
                  name: name,
                  dictionary: dictionary,
                  key: l10nTokenRef,
                  host: bindings,
                  idx: i
                };

                dictionary.file.jsRefCount++;
                dictionary.addRef(this.file);
                this.file.link(dictionary.file);

                // collect through refs
                tokenName.split('.').reduce(function(prev, current){
                  var l10nToken = flow.l10n.getToken(prev + '@' + dictFilename);

                  l10nToken.addRef(this.file, tmplRef, 'through');

                  return prev + '.' + current;
                }.bind(this));
                // add explicit ref
                l10nToken.addRef(this.file, tmplRef, 'explicit');

                tmplRefs.push(tmplRef);
              }
        }
      }, { file: file });

      fconsole.endl();
    }
  });
  fconsole.endl();

  // extend l10n
  flow.l10n.tmplRefs = tmplRefs;

}).handlerName = '[l10n] Extract';

module.exports.skip = function(flow){
  if (!flow.l10n)
    return 'basis.l10n not found';
};
