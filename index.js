'use strict';

const validateName = require('validate-npm-package-name');
const expand = require('expand-reflinks');
const reflinks = require('reflinks');
const unique = require('array-unique');
const union = require('arr-union');
const diff = require('arr-diff');

/**
 * Lint a markdown string for missing reflinks and append them
 * to the end of the string.
 */

module.exports = function(options = {}) {
  return function(file, next) {
    if (!file.isBuffer()) {
      next();
      return;
    }

    let str = expand(file.contents.toString());
    let arr = getMatches(str);
    if (arr.length === 0) {
      next(null, file);
      return;
    }

    file._reflinks = arr;

    // add `options.reflinks` to file.contents, but not to `file._reflinks`
    let list = union([], options.reflinks, arr);
    reflinks(list, options, function(err, res) {
      if (err) {
        next(err);
        return;
      }

      // filter out reflinks that are already in the file.contents
      let links = res.links.filter(function(link) {
        return str && str.indexOf(link) === -1;
      });

      if (links.length === 0) {
        next(null, file);
        return;
      }

      str += '\n\n' + links.join('\n');

      file.contents = Buffer.from(str);
      next(null, file);
    });
  };
};

function getMatches(str) {
  let regex = /(`\[|\[[^\W][^\]]+\]\[\](?!`)|(?!`)\[[^\W][^\]]+\](?![`(\[])|(?!`)\[[^\]]+\]\[[^\]]+\](?!`)|(?!.*[`\]])\[[^\W][^\]]+\](?= |$))/gm;

  let matches = (str.match(regex) || []).filter((e, i, arr) => arr.indexOf(e) === i);
  let len = matches.length;
  let arr = [];

  for (let i = 0; i < len; i++) {
    let match = matches[i];
    if (match.charAt(0) === '`') {
      continue;
    }

    let m = /(\[([^\]]+)\])(\[([^\]]+)\])?/.exec(match);
    let name = m[4] || m[2];

    if (!name || arr.indexOf(name) !== -1) {
      continue;
    }

    if (!isValidPackageName(name)) {
      continue;
    }

    if (!/^[-a-z0-9.]+$/i.test(name) || /^v?\d+\./.test(name)) {
      continue;
    }

    // don't add the reflink if it already exists
    let re = new RegExp(`(^|\\n)\\[${name}\\]: .`, 'gm');
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
 * let diff = reflinks.diff(app, ['foo', 'bar', 'baz']);
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
 * Returns true if the given name is a valid npm package name
 */

function isValidPackageName(name) {
  const stats = validateName(name);
  return stats.validForNewPackages === true
    && stats.validForOldPackages === true;
}

/**
 * Expose helper functions as methods
 */

module.exports.matches = getMatches;
module.exports.diff = getDiff;

