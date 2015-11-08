## 1.0 (November 8, 2015)

Initial release as separate module

### extract

- output `app` profile by default
- doesn't create any file anymore
- to output extract log `--target log` should be used
- remove `none` value for `--target`
- no more `AST` modifications on extract (`basis.resource`, `basis.require` etc.)
- make template isolate prefix reproducible (preparation for script and style freeze, `basis.js` support required)
- take in account special comment (`/* basisjs-tools:disable-warnings */`) in css to avoid warnings for this file
- improve warnings about missed files
- warn on broken links (fatal) in some missed hard cases (didn't check before):
    - reference by namespace in template, i.e. `<b:include src="foo.bar"/>`
    - broken links in markup `l10n` tokens (warn doesn't add to flow)
- add some checks for duplicate parameter/property names in strint mode

### build

- return promise
- add support to work as child process
- add parallel run support
- add presets support
- basic `--single-file` implementation
- remove `zip` target
- make command multi-run ready
- prevent accident original files rewrite
- compress implicit template names for `l10n` markup tokens (reduce build size)

### lint

- return promise
- add support to work as child process
- add parallel run support
- add presets support
- make possible set default reporter (`console`) via option

### Misc

- trailing slash is not adding to `--base` and `--output` values
- new command `find` that resolve filename by `basis.js` file reference
- `--output` option available only for `build` command
- new option `--theme` that specify what themes should used for result
(all themes by default), for now it's just ignore warnings for not in
list themes
- remove options:
    - `--js-build-mode`
    - `--(css-|js-)no-single-file`
    - `--css-cut-unused`
    - `--tmpl-pregenerate`
    - `--js-info`
- use `basisjs-tools-ast` and `basisjs-tools-config` as dependencies
- strip code for `basis.js` prior `1.0` and related refactoring
- set min `node.js` version to `0.12`
- many other bug fixes, improvements and refactoring
