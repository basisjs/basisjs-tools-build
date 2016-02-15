var atCss = require('basisjs-tools-ast').css;
var path = require('path');

module.exports = function(flow){
  var fconsole = flow.console;

  flow.resLinks.forEach(function(link){
    var newValue = link.file ? link.file.fileRef + link.hash : '';
    var oldValue;
    var wrapper;

    switch (link.type)
    {
      case 'img-src':
        oldValue = link.host.src;
        wrapper = '<img src="{0}">';

        link.host.src = newValue;
        break;

      case 'html-srcset':
        oldValue = link.host.srcset;
        newValue = link.images.map(function(image){
          if (image.static) {
            return image.static;
          }

          return [image.file.fileRef + image.hash].concat(image.settings).join(' ');
        }).join(', ');
        wrapper = '<' + link.tag + ' srcset="{0}">';

        link.host.srcset = newValue;
        break;

      case 'link-href':
        oldValue = link.host.href;
        wrapper = '<link href="{0}">';

        link.host.href = newValue;
        break;

      case 'meta-content':
        oldValue = link.host.content;
        wrapper = '<meta content="{0}">';

        link.host.content = newValue;
        break;

      case 'css-url':
        oldValue = atCss.unpackUri(link.token);
        wrapper = 'url({0})';

        // if (true)
        //   newValue = path.relative(flow.outputResourceDir, link.file.fileRef) + link.hash;

        atCss.packUri(newValue, link.token);
        break;

      case 'tmpl-src':
        oldValue = link.context.tokenValue(link.token);
        wrapper = link.context.tokenName(link.token) + '="{0}"';

        link.context.tokenValue(link.token, newValue);
        break;

      case 'tmpl-srcset':
        oldValue = link.context.tokenValue(link.token);
        newValue = link.images.map(function(image){
          if (image.static) {
            return image.static;
          }

          return [image.file.fileRef + image.hash].concat(image.settings).join(' ');
        }).join(', ');
        wrapper = link.context.tokenName(link.token) + '="{0}"';

        link.context.tokenValue(link.token, newValue);
        break;


      default:
        flow.warn({
          fatal: true,
          message: 'Unknown link type: ' + link.type
        });
    }

    fconsole.start(link.sourceFile.relpath);
    fconsole.log(wrapper.replace('{0}', oldValue) + ' -> ' + wrapper.replace('{0}', newValue));
    fconsole.endl();
  });
};

module.exports.handlerName = '[res] Relink';
