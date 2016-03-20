var at = require('basisjs-tools-ast').css;
var at_js = require('basisjs-tools-ast').js;
var html_at = require('basisjs-tools-ast').html;

module.exports = function(flow){
  var fconsole = flow.console;
  var themeUrlsMap = false;
  var customFilenames = true; //flow.options.sameFilenames || (flow.tmpl.hasIsolated && !flow.tmpl.isolationReproducible);

  fconsole.start('Process packages');
  flow.css.packages = flow.css.packages.filter(function(file){
    var outputContent = at.translate(file.ast);
    var isEmpty = !outputContent.length;

    if (isEmpty && !file.themeUrlsMap)
    {
      fconsole.log('[!] ' + file.relOutputFilename + ' is empty - reject');

      // 'cut' token from html
      if (file.htmlNode)
      {
        file.htmlFile.unlink(file, file.htmlNode);
        html_at.removeToken(file.htmlNode, true);
      }
    }
    else
    {
      fconsole.log('[OK] ' + file.relOutputFilename);

      file.outputContent = outputContent;

      if (!flow.options.singleFile)
      {
        if (customFilenames)
        {
          file.htmlRef = file.proposedOutputFilename + '?' + file.digest;
          file.outputFilename = file.proposedOutputFilename;
        }
        else
        {
          file.htmlRef = flow.outputResourceDir + file.digest + '.css';
          file.outputFilename = file.htmlRef;
        }
      }
      else
      {
        if (flow.js.rootNSFile.basis)
        {
          // temp solution
          // TODO: make it better
          var ast = flow.js.rootNSFile.basis.ast[1][1][1][1][3];
          ast.splice(ast.length - 1, 0, at_js.parse(
            'basis.require("./' + file.jsRef + '").startUse();'
          )[1][0]);
        }
        else
        {
          flow.exit('Can\'t inject css into result bundle. --single-file w/o basis.js is not supported for now.');
        }
      }

      if (file.themeUrlsMap)
      {
        themeUrlsMap = file.themeUrlsMap;
        file.themeUrlsMap[file.themeName] = file.htmlRef || file.outputFilename;
        fconsole.log('  [+] add to theme map: ' + file.themeName + ' -> ' + file.themeUrlsMap[file.themeName]);
      }

      if (file.htmlNode)
      {
        if (file.inline && file.htmlId)
        {
          // replace content for <style> with id attribute
          fconsole.log('  replace <style> content for new one');
          file.htmlNode.children[0].data = outputContent;
        }
        else
        {
          // replace html token otherwise
          var attrs = {
            rel: 'stylesheet',
            type: 'text/css',
            id: file.htmlId,
            media: file.media,
            href: file.htmlRef || file.relOutputFilename
          };

          if (!attrs.id)
            delete attrs.id;

          fconsole.log('  replace <link> href to ' + attrs.href);
          html_at.replaceToken(file.htmlNode, {
            type: 'tag',
            name: 'link',
            children: [],
            attribs: attrs
          });
        }
      }
    }

    return !isEmpty; // keep not empty
  });
  fconsole.endl();

  if (themeUrlsMap)
  {
    fconsole.start('Inject startup style theme choose script');

    var file = flow.indexFile;
    var script = '(' + function(defaultTheme, themeStyles){
      /*global window, document */
      var storage = window.localStorage || {};
      var themeName = defaultTheme || 'base';
      var linkEl = document.getElementById('theme-style');
      try {
        themeName = storage['_basisjs_theme_'] || themeName;
      } catch(e){}
      if (linkEl && themeName in themeStyles)
      {
        linkEl.startupTheme = themeName;
        linkEl.href = themeStyles[themeName];
      }
    } + ')(' + JSON.stringify(flow.options.tmplDefaultTheme) + ', ' + JSON.stringify(themeUrlsMap) + ')';
    var scriptNode = {
      type: 'tag',
      name: 'script',
      attribs: {},
      children: [
        {
          type: 'text',
          data: script
        }
      ]
    };

    fconsole.log('[+] inject stub <link rel="stylesheet"> to <head>');
    html_at.injectToHead(file.ast, {
      type: 'tag',
      name: 'link',
      children: [],
      attribs: {
        rel: 'stylesheet',
        id: 'theme-style'
      }
    });

    fconsole.log('[+] inject <script> to <head>');
    html_at.injectToHead(file.ast, scriptNode);

    fconsole.log('[+] add script to file graph');
    file.link(flow.files.add({
      type: 'script',
      inline: true,
      htmlFile: file,
      htmlNode: scriptNode,
      baseURI: file.baseURI,
      content: script,
      ast: at_js.parse(script),
      deps: [],
      resources: [],
      throwCodes: []
    }), scriptNode);

    fconsole.endl();
  }

  fconsole.start('Process style attributes');
  for (var i = 0, file; file = flow.files.queue[i]; i++)
    if (file.type == 'style-block')
    {
      var outputContent = at.translate(file.ast);
      outputContent = outputContent.substr(1, outputContent.length - 2);

      var fileRef = file.relpath;
      var noSource = false;

      if (file.htmlFile)
        fileRef += ' in ' + file.htmlFile.relpath;
      else
        if (file.tmplFile)
          fileRef += ' in ' + file.tmplFile.relpath;
        else
          noSource = true;

      if (!outputContent.length && file.htmlFile)
      {
        fconsole.log('[!] ' + fileRef + ' - style is empty, attribute removed');

        if (file.htmlFile)
          delete html_at.getAttrs(file.htmlNode).style;
      }
      else
      {

        if (file.content == outputContent)
        {
          fconsole.log('[ ] ' + fileRef + ' - no changes required');
          continue;
        }

        if (noSource)
        {
          fconsole.start('[!] ' + fileRef + ' - no source found, can\'t be changed');
          continue;
        }

        if (file.htmlFile)
        {
          fconsole.start(fileRef + ' - update attribute content');
            fconsole.log(file.content);
            fconsole.log(outputContent);
          fconsole.endl();

          html_at.getAttrs(file.htmlNode).style = outputContent;
          continue;
        }

        if (file.tmplFile)
        {
          fconsole.start(fileRef + ' - update attribute content');
            fconsole.log(file.content);
            fconsole.log(outputContent);
          fconsole.endl();

          file.tmplContext.tokenValue(file.tmplToken, outputContent);
          continue;
        }
      }
    }
  fconsole.end();
};

module.exports.handlerName = '[css] Translate';
