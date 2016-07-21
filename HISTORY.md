## 1.7.2 (July 21, 2016)

- Changed path format for implicit `SourceWrappers` to neutral one (change prefix `#N` → `.N`) to fix issue when `SourceWrapper#path` is using as `<b:include>` source (`src` attribute value)

## 1.7.1 (July 18, 2016)

- Fixed wrong inclusion culture packages in bundle when using `--l10n-package` (#13)

## 1.7.0 (July 15, 2016)

- Don't pack JavaScript with implicit `jsPackCmd`, but using `uglify.js` instead or explicit `jsPackCmd` if specified
- Fixed warning count on build in non-verbose mode
- Added warning count output for each build handler summary
- Implemented option `--l10n-package` to store l10n cultures outside of bundle (except selected one) and load them asynchronously on demand (@fateevv)
- Bump `basisjs-tools-ast` to [1.4.0](https://github.com/basisjs/basisjs-tools-ast/releases/tag/v1.4.0)

## 1.6.0 (June 24, 2016)

- Added support for `<link rel="image-src">` (@istrel)
- Added support for basis.js 1.7 dictionaries
- Added deletion all non-culture and non-meta branches from dictionaries
- Fixed markup token issue for basis.js prior 1.7
- Fixed `anim:` class name renaming (`--css-optimize-names`)
- Fixed class renaming in CSS usage data when `--css-optimize-names` is used

## 1.5.1 (March 25, 2016)

- fix build done time output

## 1.5.0 (March 25, 2016)

- bump `basisjs-tools-ast` to `1.3.0` (using `CSSO` 1.8.0 with usage data support)

### extract

- new target `css-usage` that output collected `CSS` usage data in `JSON` format

### build

- new CLI option `--css-usage` to use usage data (class names white list and scopes) for `CSS` compression
- new CLI option `--stat` to output build statistics in non-verbose mode

## 1.4.1 (March 19, 2016)

- fix `csso` version issue

## 1.4.0 (March 19, 2016)

### Extract

- support of new `basis.js` template declaration resources format
- add `preset` support (w/o parallel running)

### Build

- add non-style resource list if any to template description in resource map (makes non-style resources work as in dev)

### Common

- fix CLI values overriding by preset values (CLI values has higher priority)
- return non-zero code on parallel task running when one of task is failed (#9)
- make possible to specify input file when presets are setup
- always exit on `Flow#exit()` but throw exception in some cases
- bump dependencies
  - `clap` [1.1.0](https://github.com/lahmatiy/clap/releases/tag/v1.1.0)
  - `basisjs-tools-config` [1.1.0](https://github.com/basisjs/basisjs-tools-config/releases/tag/v1.1.0) (config in `package.json` support)
  - `csso` 1.7.1

## 1.3.2 (February 16, 2016)

- FIX: first url in `srcset` isn't parse correctly if value starts with whitespaces

## 1.3.1 (February 16, 2016)

- FIX: issue when execute `basis.js` modules with all debug info cut off (because of `--js-cut-dev`)
- FIX: try to use plugin only if `target` setting is not set or has some special value (fixes #7)
  - For every builder tasks (except `find`) `build` value should be used. To set specific command its name should be starts with `build:` prefix, i.e. `build:lint` for `lint`.

## 1.3.0 (February 16, 2016)

- **NEW**: basic plugins support similar to dev-server (replacement for preprocess settings). See example [basisjs-tools-babel-plugin](https://github.com/wuzyk/basisjs-tools-babel-plugin) by @wuzyk
  - `preprocess` and `extFileTypes` options aren't supported in `basis.config` anymore
- **NEW**: support for `srcset` attribute on `<img>` and `<source>` elements (for HTML and templates)
- extract: better warn message construct when process arguments from `basis.dev.warn()` and `basis.dev.error()`
- lint: fix output warnings with no file (wrongly omit before)

## 1.2.1 (January 21, 2016)

- extract: don't warn on ids with no css rulesets for them (#3)

## 1.2.0 (January 19, 2016)

- lint: check for top level duplicate `var` declarations
- build: don't exit on `closure-compiler` notify message about stdin input
- extract: don't warn on unknown type for `<script>` (since could be used for templates)
- bump dependencies

## 1.1.0 (November 23, 2015)

- build: new option `--silent` to prevent any output to `stdout`
- build: new value `none` for `--target` option (prevents file writing to FS)
- build: don't minimize `id` names when `--css-optimize-names` is using, since unsafe as tools don't found every `id` usage case for now

## 1.0.2 (November 22, 2015)

- extract: return paths reltaive to `base`
- extract: remove old `basis.js` l10n support in result (prior to `1.0`)
- extract: fix `require` resolving for paths w/o extension for `basis.js` 1.5

## 1.0.1 (November 10, 2015)

- bump `csso` version to `1.4.2`

## 1.0 (November 8, 2015)

Initial release as separate module

### extract

- output `app` profile by default
- doesn't create any file anymore
- to output extract log `--target log` should be used
- remove `none` value for `--target`
- no more `AST` modifications on extract (`basis.resource`, `basis.require` etc.)
- make `basis.js` config parse error as fatal
- support for images in `<meta name="msapplication-*">`
- fix: exception on html extract when `<link>` has no `href` attribute
- make template isolate prefix reproducible (preparation for script and style freeze, `basis.js` support required)
- take in account special comment (`/* basisjs-tools:disable-warnings */`) in css to avoid warnings for this file
- improve warnings about missed files
- warn on broken links (fatal) in some missed hard cases (didn't check before):
    - reference by namespace in template, i.e. `<b:include src="foo.bar"/>`
    - broken links in markup `l10n` tokens (warn doesn't add to flow)
- drop support for `basis.l10n` v1 (`basis.js` prior `1.0`)
- add some checks for duplicate parameter/property names in strint mode
- add some ES6 globals to dict

### build

- return promise
- add support to work as child process
- add parallel run support
- add presets support
- basic `--single-file` implementation
- fix `--css-inline-image` option
- remove `zip` target
- make command multi-run ready
- support for images in `<meta name="msapplication-*">`
- prevent accident original files rewrite
- compress implicit template names for `l10n` markup tokens (reduce build size)
- don't set `type="text/javascript"` for `<script>` in resulting html

### lint

- return promise
- add support to work as child process
- add parallel run support
- add presets support
- make possible set default reporter (`console`) via option
- implement `junit` reporter

### Misc

- new command `find` that resolve filename by `basis.js` file reference
- trailing slash is not adding to `--base` and `--output` values
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
