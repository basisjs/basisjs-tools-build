var cli = require('../../lib/cli.js');
var path = require('path');
var assert = require('assert');

describe('build with --css-optimize-names', function(){
  process.env.PWD = __dirname + '/env/app';

  it('should replace classes but don\'t ids', function(){
    return cli.build.run(['--silent', '--css-optimize-names'])
      .then(function(flow){
        var outputMap = flow.files.queue.reduce(function(map, file){
          if (file.outputFilename)
            map[file.outputFilename] = file;
          return map;
        }, {});

        function content(filename){
          if (outputMap[filename])
            return outputMap[filename].outputContent || '';
        }

        // index.html
        assert(!/html-class-test/.test(content('index.html')));
        assert(/class="b"/.test(content('index.html')));
        assert(/id="html-id-test"/.test(content('index.html')));

        // style.css
        assert(!/\.file-class-test/.test(content('style.css')));
        assert(/\.a \{/.test(content('style.css')));
        assert(/\#file-id-test/.test(content('style.css')));
        assert(!/\.inline-class-test/.test(content('style.css')));
        assert(/\.c \{/.test(content('style.css')));
        assert(/\#inline-id-test/.test(content('style.css')));

        // script.js
        assert(!/"tmpl-class-test"/.test(content('script.js')));
        assert(/"tmpl-id-test"/.test(content('script.js')));
      });
  });
});
