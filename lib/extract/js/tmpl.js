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
        if (value[0] == 'call' && value.resourceRef)
          value.themeDefined = true;
      }
      else
      {
        flow.warn({
          file: callInfo.file,
          loc: callInfo.loc,
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

        if (!fallback || fallback[0] != 'string')
          return flow.warn({
            fatal: true,
            file: this.file.relpath,
            message: 'basis.template.theme(' + name + '): first parameter is not resolved, token: ' + at.translate(token)
          });

        theme.fallback_ = fallback[1];
        fconsole.log('[basis.template] set fallback `' + fallback[1] + '` for theme `' + name + '`');

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
          loc: this.file.location(token.start)
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

        if (what[0] == 'string')
        {
          if (!by || by[0] != 'object')
          {
            if (!by || args.length == 1)
            {
              // return getSourceByPath(what);
            }
            else
            {
              return addSource(what[1], by, callInfo);
            }
          }
          else
          {
            var namespace = what[1];
            var props = by[1];
            var result = ['object', []];
            result.obj = {};

            for (var i = 0; i < props.length; i++)
              result.obj[namespace + '.' + props[i][0]] = addSource(namespace + '.' + props[i][0], props[i][1], callInfo);

            return result;
          }
        }
        else
        {
          if (what[0] == 'object')
          {
            var props = what[1];

            for (var i = 0; i < props.length; i++)
              addSource(props[i][0], props[i][1], callInfo);

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
      var name = args[0] && args[0][0] == 'string' ? args[0][1] : '';
      token.obj = getTheme(name);
    });
  }
};
