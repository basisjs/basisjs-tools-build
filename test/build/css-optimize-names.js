var cli = require('../../lib/cli.js');
var path = require('path');
var assert = require('assert');

describe('build with --css-optimize-names', function(){
  it('should replace classes but don\'t ids', function(){
    var cwd = __dirname + '/env/app';
    process.env.PWD = cwd;

    return cli.build.run(['--silent', '--target', 'none', '--css-optimize-names'])
      .then(function(flow){
        var outputMap = flow.result.reduce(function(map, file){
          map[path.relative(cwd, file.path).replace(/\\/g, '/')] = file;
          return map;
        }, {});

        function content(filename){
          if (outputMap[filename])
            return outputMap[filename].content || '';
        }

        // index.html
        assert(!/html-class-test/.test(content('build/index.html')));
        assert(/class="c"/.test(content('build/index.html')));
        assert(/id="html-id-test"/.test(content('build/index.html')));


        // style.css
        assert(!/\.file-class-test/.test(content('build/style.css')));
        assert(/\.a\{/.test(content('build/style.css')));
        assert(/\#file-id-test/.test(content('build/style.css')));
        assert(!/\.inline-class-test/.test(content('build/style.css')));
        assert(/\.d\{/.test(content('build/style.css')));
        assert(/\#inline-id-test/.test(content('build/style.css')));

        // script.js
        assert(!/"tmpl-class-test"/.test(content('build/script.js')));
        assert(/"tmpl-id-test"/.test(content('build/script.js')));
      });
  });
});
