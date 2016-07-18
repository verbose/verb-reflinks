'use strict';

require('mocha');
var assert = require('assert');
var reflinks = require('./');
var verb = require('templates');
var app;

describe('verb-reflinks', function() {
  beforeEach(function() {
    app = verb();
    app.create('docs');
    app.option('engine', '*');
    app.engine('*', function(file, locals, cb) {
      cb(null, file);
    });
  });

  describe('lib', function() {
    it('should export a function', function() {
      assert.equal(typeof reflinks, 'function');
    });

    it('should expose a `.matches` method', function() {
      assert.equal(typeof reflinks.matches, 'function');
    });

    it('should expose a `.diff` method', function() {
      assert.equal(typeof reflinks.diff, 'function');
    });
  });

  describe('middleware', function() {
    it('should find reflinks in a file and add them to `file._reflinks`', function(cb) {
      var count = 0;
      app.postRender(/./, reflinks());
      app.postRender(/./, function(file, next) {
        assert(file._reflinks);
        assert(Array.isArray(file._reflinks));
        assert.equal(file._reflinks[0], 'generate');
        assert.equal(file._reflinks[1], 'verb');
        app.union('cache.reflinks', file._reflinks);
        count = file._reflinks.length;
        next();
      });
      var view = app.docs.addView('foo', {content: 'This is a reflink\n[verb][]\n[generate][]\n'});
      app.render(view, function(err, view) {
        if (err) return cb(err);
        assert.equal(count, 2);
        cb();
      });
    });

    it('should not add local reflinks to `file._reflinks`', function(cb) {
      var count = 0;
      app.postRender(/./, reflinks());
      app.postRender(/./, function(file, next) {
        assert(file._reflinks);
        assert(Array.isArray(file._reflinks));
        assert.equal(file._reflinks[0], 'generate');
        app.union('cache.reflinks', file._reflinks);
        count = file._reflinks.length;
        next();
      });
      var view = app.docs.addView('foo', {content: 'This is a reflink\n[documentation][docs]\n[generate][]\n'});
      app.render(view, function(err, view) {
        if (err) return cb(err);
        assert.equal(count, 1);
        cb();
      });
    });
  });

  describe('.matches', function() {
    it('should expose an `.matches` method', function() {
      assert.equal(typeof reflinks.matches, 'function');
    });

    it('should extract matches from a string', function() {
      var matches = reflinks.matches('This is a reflink\n[verb][]\n[generate][]\n');
      assert(matches);
      assert(Array.isArray(matches));
      assert.equal(matches.length, 2);
    });
  });
});
