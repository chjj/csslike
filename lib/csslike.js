/**
 * csslike
 * Attempt at implementing the most recent www-style proposals.
 * Copyright (c) 2011, Christopher Jeffrey. (MIT Licensed)
 */

var fs = require('fs')
  , join = require('path').join;

var lex = require('./lexer')
  , parse = require('./parser');

var style = exports
  , cache = style.cache = {};

/**
 * Handler
 */

var pathname = function(req) {
  req.pathname = require('url').parse(req.url).pathname;
  return req.pathname;
};

style.handle = function(opt) {
  return function(req, res, next) {
    if (req.method !== 'GET' 
        && req.method !== 'HEAD') return next();

    var file = opt.file;
    if (!file) {
      if (~req.url.indexOf('.css')) {
        file = req.pathname || pathname(req);
        if (~file.indexOf('..')) return next(403);
      } else {
        return next();
      }
    }

    if (opt.cache) {
      var cached = cache[file];
      if (cached) {
        res.setHeader('Last-Modified', cached.updated);
        var since = +req.headers['if-modified-since'];
        if (since && since === cached.updated) {
          res.statusCode = 304;
          return res.end();
        }
      }
    }

    style.load(file, function(err, css) {
      if (err) return next(err);
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.setHeader('Content-Length', !Buffer.isBuffer(css)
        ? Buffer.byteLength(css)
        : css.length
      );
      res.end(css);
    }, opt);
  };
};

/**
 * Load
 */

style.load = function(file, func, opt) {
  fs.stat(file, function(err, stat) {
    if (err) return func(err);

    var mtime = stat.mtime.getTime()
      , cached = cache[file] || (cache[file] = {});

    cached.updated = mtime;
    if (opt.cache) {
      if (cached.data && mtime <= cached.updated) {
        return func(null, cached.data);
      }
    }

    fs.readFile(file, 'utf8', function(err, css) {
      if (err) return func(err);
      style.compile(css, function(err, css) {
        if (err) return func(err);
        if (opt.cache) {
          css = cached.data = new Buffer(css);
        }
        func(null, css);
      }, opt);
    });
  });
};

/**
 * Compiler
 */

style.compile = function(css, func, opt) {
  try {
    css = parse(lex(css), opt);
    func(null, css);
  } catch(e) {
    func(e);
  }
};

style.middleware = style.handle;
style.lexer = lex;
style.parser = parse;