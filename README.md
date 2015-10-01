[![NPM version](https://img.shields.io/npm/v/basisjs-tools-build.svg)](https://www.npmjs.com/package/basisjs-tools-build)
[![Dependency Status](https://img.shields.io/david/basisjs/basisjs-tools-build.svg)](https://david-dm.org/basisjs/basisjs-tools-build)
[![Build Status](https://travis-ci.org/basisjs/basisjs-tools-build.svg?branch=master)](https://travis-ci.org/basisjs/basisjs-tools-build)

This package provides set of tools to build and lint apps using [basis.js](https://github.com/basisjs/basisjs) framework. Tools could also provide app profile and resolve various path forms.

## Commands

- `build` - build an app.
- `extract` - fetch app profile. Actualy it's first step of building.
- `lint` - lint app code base. It uses `extract` to get app profile and output warning list as result.
- `find` - resolve some file reference to absolute filename.
