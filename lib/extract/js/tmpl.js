var at = require('basisjs-tools-ast').js;
var hasOwnProperty = Object.prototype.hasOwnProperty;

module.exports = function(file, flow, defineHandler){
  var fconsole = flow.console;

  var getTheme = function(name){
    if (!name)
      name = 'base';

    if (flow.tmpl.themes[name])
      return flow.tmpl.themes[name];

    var fn = function(name){
      return at.createRunner(function(token, this_, args){
        fconsole.log('[basis.template] template#' + name + ' call', args);
      });
    };

    function addSource(key, value, callInfo){
      if (!hasOwnProperty.call(resources, key))
      {
        fconsole.log('[basis.template] define template `' + key + '` in `' + theme.name + '` theme');
        resources[key] = value;
        if (value.type == 'CallExpression' && value.resourceRef)
          value.themeDefined = true;
      }
      else
      {
        flow.warn({
          file: callInfo.file,
          loc: callInfo.loc.start,
          theme: theme.name,
          fatal: true,
          message: 'Duplicate template path for theme `' + theme.name + '`: ' + key
        });
      }

      return resources[key];
    }

    var resources = {};
    var theme = {
      name: name,
      fallback: at.createRunner(function(token, this_, args, scope){
        if (!args[0])
          return;

        var fallback = scope.simpleExpression(args[0]);

        if (!fallback || fallback.type != 'Literal')
          return flow.warn({
            fatal: true,
            file: this.file.relpath,
            message: 'basis.template.theme(' + name + '): first parameter is not resolved, token: ' + at.translate(token)
          });

        theme.fallback_ = fallback.value;
        fconsole.log('[basis.template] set fallback `' + fallback.value + '` for theme `' + name + '`');

        token.obj = theme;
      }),
      define: at.createRunner(function(token, this_, args, scope){
        //fconsole.log('define', args);
        if (!args.length || !args[0])
          return flow.warn({
            fatal: true,
            file: this.file.relpath,
            message: ['basis.template.define w/o args', args]
          });

        var what = scope.simpleExpression(args[0]);
        var by = args[1] ? scope.simpleExpression(args[1]) : null;
        var callInfo = {
          file: this.file.filename,
          loc: this.file.location(token.loc.start)
        };

        //fconsole.log('define', what, by);
        if (!what && args[0])
          return flow.warn({
            fatal: true,
            file: this.file.relpath,
            message: 'basis.template.define: first parameter is not resolved, token: ' + at.translate(token)
          });

        if (!by && args[1])
          return flow.warn({
            fatal: true,
            file: this.file.relpath,
            message: 'basis.template.define: second parameter is not resolved, token: ' + at.translate(token)
          });

        if (what.type == 'Literal')
        {
          if (!by || by.type != 'ObjectExpression')
          {
            if (!by || args.length == 1)
            {
              // return getSourceByPath(what);
            }
            else
            {
              return addSource(what.value, by, callInfo);
            }
          }
          else
          {
            var namespace = what.value;
            var result = {
              type: 'ObjectExpression',
              properties: []
            };

            var props = by.properties;
            result.obj = {};

            for (var i = 0; i < props.length; i++)
            {
              var prop = props[i];
              var key = prop.key.type == 'Literal' ? prop.key.value : prop.key.name;

              result.obj[namespace + '.' + key] = addSource(namespace + '.' + key, prop.value, callInfo);
            }

            return result;
          }
        }
        else
        {
          if (what.type == 'ObjectExpression')
          {
            props = what.properties;

            for (var i = 0; i < props.length; i++) {
              var prop = props[i];
              var key = prop.key.type == 'Literal' ? prop.key.value : prop.key.name;

              addSource(key, prop.value, callInfo);
            }

            return theme;
          }
          else
          {
            flow.warn({
              file: this.file.relpath,
              message: 'Wrong first argument for basis.template.Theme#define'
            });
          }
        }
      }),
      apply: fn('apply'),
      getSource: fn('getSource'),
      drop: at.createRunner(function(){
        flow.warn({
          file: this.file.relpath,
          message: 'basis.template.theme#drop should never be called in build'
        });
      })
    };

    flow.tmpl.themes[name] = theme;
    flow.tmpl.themeResources[name] = resources;

    return theme;
  };

  getTheme('base');

  // basis.template.theme
  if (file.jsScope.get('getTheme'))
  {
    flow.tmpl.themeModule = file;
    defineHandler(file.jsScope, 'getTheme', function(token, this_, args){
      //fconsole.log('getTheme');
      var name = args[0] && args[0].type == 'Literal' ? args[0].value : '';
      token.obj = getTheme(name);
    });
  }
};
