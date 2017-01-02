'use strict';

var debug = require('debug')('verb-reflinks');
var expand = require('expand-reflinks');
var reflinks = require('reflinks');
var unique = require('array-unique');
var union = require('arr-union');
var diff = require('arr-diff');

/**
 * Lint a markdown string for missing reflinks and append them
 * to the end of the string.
 */

module.exports = function(options) {
  options = options || {};

  return function(file, next) {
    if (!file.isBuffer()) {
      next();
      return;
    }

    debug('matching reflinks in <%s>', file.path);
    var str = expand(file.contents.toString());
    var arr = getMatches(str);
    if (arr.length === 0) {
      next(null, file);
      return;
    }

    debug('found %s missing reflink(s): %j', arr.length, arr);
    file._reflinks = arr;

    // add `options.reflinks` to file.contents, but not to `file._reflinks`
    var list = union([], options.reflinks, arr);
    reflinks(list, options, function(err, res) {
      if (err) {
        next(err);
        return;
      }

      // filter out reflinks that are already in the file.contents
      var links = res.links.filter(function(link) {
        return str && str.indexOf(link) === -1;
      });

      if (links.length === 0) {
        next(null, file);
        return;
      }

      str += '\n\n' + links.join('\n');

      file.contents = new Buffer(str);
      next(null, file);
    });
  };
};

function getMatches(str) {
  var regex = /((?!`)\[[^\W][^\]]+\]\[\](?!`)|(?!`)\[[^\W][^\]]+\](?![`(\[])|(?!`)\[[^\]]+\]\[[^\]]+\](?!`)|(?!.*[`\]])\[[^\W][^\]]+\](?= |$))/gm;

  var matches = unique(str.match(regex) || []);
  var len = matches.length;
  var arr = [];

  for (var i = 0; i < len; i++) {
    var match = matches[i];
    var m = /(\[([^\]]+)\])(\[([^\]]+)\])?/.exec(match);
    var name = m[4] || m[2];

    if (!name || arr.indexOf(name) !== -1) {
      continue;
    }

    if (!/^[-a-z0-9.]+$/.test(name) || /^v?\d+\./.test(name)) {
      continue;
    }

    // don't add the reflink if it already exists
    var re = new RegExp(`(^|\\n)\\[${name}\\]: .`, 'gm');
    if (re.test(str)) {
      continue;
    }

    arr.push(name);
  }

  arr.sort();
  return arr;
}

/**
 * Get the unique reflinks from `app.cache.reflinks` that do not
 * already exist on the given `array`. (Use a middleware to add the reflinks on
 * `file._reflinks` to `app.cache.reflinks`).
 *
 * ```js
 * app.set('cache.reflinks', ['foo']);
 * var diff = reflinks.diff(app, ['foo', 'bar', 'baz']);
 * console.log(diff);
 * //=> ['bar', baz']
 * ```
 *
 * @param {Object} `app` Instance of [verb], [assemble], [generate], or [update].
 * @param {Array} `arr` Array of reflinks remove from the returned array.
 * @return {Array}
 * @api public
 */

function getDiff(app, existing) {
  return diff(app.get('cache.reflinks') || [], existing || []);
}

/**
 * Expose helper functions as methods
 */

module.exports.matches = getMatches;
module.exports.diff = getDiff;
