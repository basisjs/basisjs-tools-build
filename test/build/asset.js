var assert = require('assert');
var path = require('path');
var fs = require('fs');
var cli = require('../../lib/cli.js');
var translate = require('basisjs-tools-ast').js.translate;
var testDir = path.join(__dirname, '/env/asset');

describe('assets', function(){
  it('should resolve assets', function(){
    return cli.build.run([
        '--silent',
        '--target', 'none',
        '--base', testDir,
        '--file', path.join(testDir, 'index.html')
      ])
      .then(function(flow){
        function test(filename) {
            return [
                // actual
                translate(flow.files.get(filename).ast)
                    .trimRight()
                    .split('\n')
                    .slice(1, -1),
                // expected
                fs.readFileSync(path.join(testDir, filename + '.expected'), 'utf8')
                    .trimRight()
                    .split('\n'),
                filename
            ];
        }

        assert.deepEqual.apply(null, test('./test.js'));
        assert.deepEqual.apply(null, test('./nested/test.js'));

        var outputFiles = flow.result.map(function(file){
            return path.relative(flow.options.output, file.path);
        }).sort();
        assert.deepEqual(outputFiles, [
            'index.html',
            'res/2UXU8U3kxAevHpp6qHrcjg.js',
            'res/sCYCBPgDT7PfyU6bFmdPuQ.js',
            'script.js'
        ], 'output files shouldn\'t contain only inlined assert');
      });
  });
});
