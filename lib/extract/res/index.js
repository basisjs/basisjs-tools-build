var resolveUri = require('../misc/resolveUri');
var html = require('../html');
var atHtml = require('basisjs-tools-ast').html;
var atCss = require('basisjs-tools-ast').css;
var atTmpl = require('basisjs-tools-ast').tmpl;

(module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  flow.resLinks = [];

  for (var i = 0, file; file = queue[i]; i++)
  {
    switch (file.type)
    {
      case 'html':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        if (!file.ast)
          html.processFile(file, flow);

        atHtml.walk(file.ast, {
          'tag': function(node){
            var attrs = atHtml.getAttrs(node);

            switch (node.name)
            {
              case 'source':
                if (attrs.srcset)
                  htmlSrcset(flow, file, node, attrs);
                break;

              case 'img':
                if (attrs.srcset)
                  htmlSrcset(flow, file, node, attrs);

                // ignore if no src value
                if (!attrs.src)
                  return;

                var uri = resolveResourceUri(attrs.src);

                if (uri)
                {
                  fconsole.log('Found <img src="' + uri.filename + uri.hash + '"/>');

                  node.loc = file.location(node.info.start);

                  var imageFile = resolveImage(flow, uri.filename, node, null, {
                    file: file,
                    loc: node.loc,
                    token: atHtml.translate(node)
                  });

                  if (imageFile)
                    //attrs.src = imageFile.fileRef + uri.hash;
                    flow.resLinks.push({
                      type: 'img-src',
                      sourceFile: file,
                      file: imageFile,
                      hash: uri.hash,
                      host: attrs
                    });
                  else
                    flow.warn({
                      file: file.relpath,
                      message: 'Image reference is not resolved (ignored)'
                    });
                }

                break;

              case 'link':
                if (/^image\//.test(attrs.type) ||
                    atHtml.rel(node, 'icon') ||
                    atHtml.rel(node, 'apple-touch-icon') ||
                    atHtml.rel(node, 'apple-touch-icon-precomposed') ||
                    atHtml.rel(node, 'apple-touch-startup-image') ||
                    atHtml.rel(node, 'image_src'))
                {
                  var uri = resolveResourceUri(attrs.href);

                  if (uri)
                  {
                    fconsole.log('Found <link rel="' + atHtml.rel(node).join(' ') + '" href="' + uri.filename + uri.hash + '"/>');

                    node.loc = file.location(node.info.start);

                    var imageFile = resolveImage(flow, uri.filename, node, null, {
                      file: file,
                      loc: node.loc,
                      token: atHtml.translate(node)
                    });

                    if (imageFile)
                      //attrs.href = imageFile.fileRef + uri.hash;
                      flow.resLinks.push({
                        type: 'link-href',
                        sourceFile: file,
                        file: imageFile,
                        hash: uri.hash,
                        host: attrs
                      });
                    else
                      flow.warn({
                        file: file.relpath,
                        message: 'Image reference is not resolved (ignored)'
                      });
                  }
                }

                break;

              case 'meta':
                if (attrs.name == 'msapplication-TileImage' ||
                    attrs.name == 'msapplication-square70x70logo' ||
                    attrs.name == 'msapplication-square150x150logo' ||
                    attrs.name == 'msapplication-wide310x150logo' ||
                    attrs.name == 'msapplication-square310x310logo')
                {
                  var uri = resolveResourceUri(attrs.content);

                  if (uri)
                  {
                    fconsole.log('Found <meta name="' + attrs.name + '" content="' + uri.filename + uri.hash + '"/>');

                    node.loc = file.location(node.info.start);

                    var imageFile = resolveImage(flow, uri.filename, node, null, {
                      file: file,
                      loc: node.loc,
                      token: atHtml.translate(node)
                    });

                    if (imageFile)
                      flow.resLinks.push({
                        type: 'meta-content',
                        sourceFile: file,
                        file: imageFile,
                        hash: uri.hash,
                        host: attrs
                      });
                    else
                      flow.warn({
                        file: file.relpath,
                        message: 'Image reference is not resolved (ignored)'
                      });
                  }
                }

                break;
            }
          }
        });

        fconsole.endl();
      break;

      case 'style':
      case 'style-block':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        atCss.walk(file.ast, {
          'uri': function(token){
            fconsole.log('Found ' + atCss.translate(token));

            var uri = resolveResourceUri(atCss.unpackUri(token));

            if (uri)
            {
              token.loc = file.location(token[0]);
              var imageFile = resolveImage(flow, uri.filename, token, null, {
                file: file,
                loc: token.loc,
                token: atCss.translate(token)
              });

              if (imageFile)
              {
                imageFile.cssResource = true;
                //atCss.packUri(imageFile.fileRef + uri.hash, token);
                flow.resLinks.push({
                  type: 'css-url',
                  sourceFile: file,
                  file: imageFile,
                  hash: uri.hash,
                  token: token
                });
              }
              else
                flow.warn({
                  file: file.relpath,
                  message: 'Image reference is not resolved (ignored)'
                });
            }
          }
        });

        fconsole.endl();
      break;

      case 'template':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        if (file.ast)
        {
          atTmpl.walk(file.ast, flow.js.basis.template, {
            'attr': function(token, parentToken){
              var attributeName = this.tokenName(token);
              var attributeValue = this.tokenValue(token);

              switch (attributeName)
              {
                case 'src':
                  var tagName = this.tokenName(parentToken);

                  if (tagName == 'img')
                  {
                    fconsole.log('Found <' + tagName + ' src="' + attributeValue + '"/>');

                    if (this.hasBindings(token))
                    {
                      fconsole.log('[i] Ignored, token has bindings on `src` attribute');
                      return;
                    }

                    var uri = resolveResourceUri(attributeValue);

                    if (uri)
                    {
                      var imageFile = resolveImage(flow, uri.filename, token, flow.indexFile, {
                        file: file,
                        loc: token.loc
                      });

                      if (imageFile)
                      {
                        imageFile.cssResource = true;
                        //this.tokenValue(token, imageFile.fileRef + uri.hash);
                        flow.resLinks.push({
                          type: 'tmpl-' + attributeName,
                          sourceFile: file,
                          file: imageFile,
                          hash: uri.hash,
                          token: token,
                          context: this
                        });
                      }
                      else
                      {
                        flow.warn({
                          file: file.relpath,
                          message: 'Image reference `' + attributeValue + '` is not resolved (ignored)'
                        });
                      }
                    }
                  }
                  break;

                case 'srcset':
                  var tagName = this.tokenName(parentToken);

                  if (tagName == 'img' || tagName == 'source')
                  {
                    fconsole.log('Found <' + tagName + ' srcset="' + attributeValue + '"/>');

                    if (this.hasBindings(token))
                    {
                      fconsole.log('[i] Ignored, token has bindings on `srcset` attribute');
                      return;
                    }

                    var images = attributeValue.trim().split(/\s*,\s*/).map(function(src){
                      var parts = src.split(/\s+/);
                      var reference = parts.shift();
                      var uri = resolveResourceUri(reference);

                      if (uri)
                      {
                        var imageFile = resolveImage(flow, uri.filename, token, flow.indexFile, {
                          file: file,
                          loc: token.loc
                        });

                        if (imageFile)
                        {
                          imageFile.cssResource = true;
                          return {
                            file: imageFile,
                            hash: uri.hash,
                            settings: parts
                          };
                        }
                        else
                        {
                          flow.warn({
                            file: file.relpath,
                            message: 'Image reference `' + reference + '` is not resolved (ignored)'
                          });
                        }
                      }

                      return {
                        static: src
                      };
                    });

                    flow.resLinks.push({
                      type: 'tmpl-' + attributeName,
                      sourceFile: file,
                      tag: tagName,
                      images: images,
                      token: token,
                      context: this
                    });
                  }
                  break;

                case 'style':
                  if (!/^b:/.test(this.tokenName(parentToken)) && attributeValue)
                  {
                    fconsole.log('Style attribute found');
                    file.link(flow.files.add({
                      type: 'style-block',
                      inline: true,
                      tmplFile: file,
                      tmplToken: token,
                      tmplContext: this,
                      baseURI: flow.indexFile.baseURI,
                      content: this.tokenValue(token),
                      ast: atCss.parse(this.tokenValue(token), true)
                    }), token);
                  }
                  break;
              }
            }
          });
        }

        fconsole.endl();
      break;
    }
  }
}).handlerName = '[res] Extract';

function resolveResourceUri(url){
  var uri = resolveUri(url);
  if (uri.filename)
    return uri;
}

function resolveImage(flow, url, token, baseFile, initiator){
  var file = initiator.file;
  var imageFile = flow.files.add({
    initiator: initiator,
    filename: (baseFile || file).resolve(url)
  });

  if (imageFile)
  {
    file.link(imageFile, token);
    imageFile.output = true;
  }

  return imageFile;
}

function htmlSrcset(flow, file, node, attrs) {
  flow.console.log('Found <' + node.name + ' srcset="' + attrs.srcset + '"/>');

  var images = attrs.srcset.trim().split(/\s*,\s*/).map(function(src){
    var parts = src.split(/\s+/);
    var reference = parts.shift();
    var uri = resolveResourceUri(reference);

    if (uri)
    {
      var imageFile = resolveImage(flow, uri.filename, node, null, {
        file: file,
        loc: node.loc,
        token: atHtml.translate(node)
      });

      if (imageFile)
      {
        imageFile.cssResource = true;
        return {
          file: imageFile,
          hash: uri.hash,
          settings: parts
        };
      }
      else
      {
        flow.warn({
          file: file.relpath,
          message: 'Image reference `' + reference + '` is not resolved (ignored)'
        });
      }
    }

    return {
      static: src
    };
  });

  flow.resLinks.push({
    type: 'html-srcset',
    sourceFile: file,
    tag: node.name,
    images: images,
    host: attrs
  });
}
