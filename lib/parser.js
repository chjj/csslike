/**
 * csslike - Parser
 * Copyright (c) 2011, Christopher Jeffrey. (MIT Licensed)
 */

var lex = require('./lexer');

var fs = require('fs')
  , path = require('path')
  , join = path.join
  , dirname = path.dirname
  , extname = path.extname;

/**
 * Parser (Recursive Descent)
 * Pretty prints by default
 */

var options
  , token
  , tokens
  , variables
  , traits
  , depth;

var indent = function() {
  return '\n' + Array(depth + 1).join('  ');
};

var next = function() {
  token = tokens.pop();
  return token;
};

var rule = function() {
  var body = []
    , below = []
    , selector = token.selector;

  depth++;

  while (next().type !== 'end') { 
    switch (token.type) {
      case 'rule':
        token.selector = nest(selector, token.selector);
        ; // FALL-THROUGH
      case 'nested_at':
        below.push(tok());
        break;
      default:
        body.push(tok());
        break;
    }
  }

  depth--;

  // clean up extra whitespace
  selector = selector
    .replace(/\s+/g, ' ')
    .replace(/,\s*/g, ',' + indent());

  return selector
         + ' {' 
         + body.join('') 
         + indent() 
         + '}' 
         + below.join('');
};

var nest = function(parent, child) {
  return parent
    .split(/\s*,\s*(?![^\[]*["'])/)
    .map(function(s) {
      return child.replace(/&/g, s);
    }).join(', ');
};

var replace = function(val) {
  return val.replace(/\$[\w-]+/g, function(name) {
    if (!variables[name]) {
      throw new 
        Error('Undeclared variable: ' + name
              + '\nLine: ' + token.line);
    }
    return variables[name];
  });
};

var property = function() {
  var val = token.val;

  val = base64(val);

  // clean whitespace
  val = val.replace(
    /(\() +| +(\))|(, ) +/g, 
    '$1$2$3'
  );

  return token.key + ': ' + val + ';';
};

var trait = function() {
  var token_ = token
    , body = [];

  depth++;

  while (next().type !== 'end') { 
    if (token.type !== 'property') {
      throw new
        Error('Unexpected token in trait: ' 
              + JSON.stringify(token));
    }
    body.push(indent() + property());
  }

  depth--;

  trait.compile(token_, body.join(''));

  return '';
};

trait.compile = function(token, body) {
  var header = token.params
    , $ = /^([\w-]+)\s*(?:\(([^)]+)\))?/.exec(header)
    , name = $[1]
    , args = $[2]
    , params = {};

  if (args) {
    args.split(/\s*,\s*/).forEach(function(val, i) {
      params[val] = i;
    });
  }

  traits[name] = function() {
    var args = arguments;
    // local variables
    body = body.replace(/\$[\w\-]+/g, function(name) {
      return args[params[name]] || name;
    });
    // global variables
    body = replace(body);
    return body;
  };
};

trait.mixin = function(token) {
  var header = token.params
    , pair = /^([\w-]+)\s*(?:\(([^)]+)\))?/.exec(header)
    , name = pair[1]
    , args = pair[2]
    , trait_ = traits[name];

  if (!trait_) {
    throw new 
      Error('Undeclared mixin: ' + name
            + '\nLine: ' + token.line);
  }

  if (args) {
    args = args
      .split(/\s*,\s*(?![^(]*\))/)
      .map(function(arg) { 
        return arg[0] === '(' 
          ? arg.slice(1, -1) 
          : arg;
      });
    return trait_.apply(null, args);
  }

  return trait_();
};

var nested_at = function() {
  if (token.name === '@trait') { 
    return trait();
  }

  var token_ = token
    , body = [];

  depth++;

  while (next().type !== 'end') { 
    body.push(tok());
  }

  depth--;

  body = body.join('');

  return token_.name 
    + ' ' 
    + token_.params 
    + ' {' 
    + body 
    + indent() 
    + '}\n';
};

var at = function() {
  var name = token.name 
    , val = token.params 
    , trait_;

  switch (name) {
    case '@var':
      val = val.split(/\s+/);
      variables[val[0]] = replace(val[1]);
      return '';
    case '@mixin':
      trait_ = trait.mixin(token);
      return replace(trait_);
    case '@import':
      val = imports(val, options); 
      break;
  }

  return name + ' ' + val;
};

var comment = function() {
  var text = token.text
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return '\n' 
    + indent() 
    + '/**' 
    + indent() 
    + ' * ' 
    + text 
    + indent() 
    + ' */\n';
};

var tok = function() {
  switch (token.type) {
    case 'comment':
      return comment();
    case 'rule':
      return indent() 
        + rule();
    case 'property':
      return indent() 
        + replace(property());
    case 'nested_at':
      return indent() 
        + nested_at();
    case 'at':
      return indent() 
        + at();
    default:
      throw new
        Error('Unexpected token: ' 
              + JSON.stringify(token));
  }
};

var parse = function(src, opt) {
  options = opt || {};
  tokens = src.reverse();
  variables = {};
  traits = {};
  depth = 0;

  var out = [];
  while (next()) {
    out.push(tok());
  }

  out = out.join('');

  // clean up
  out = out
    .replace(/^[ \t]+\n/gm, '')
    .replace(/}\n\n}/g, '}\n}')
    .trim();

  if (options.minify) {
    out = minify(out);
  }

  options = null;
  token = null;
  tokens = null;
  variables = null;
  traits = null;
  depth = null;

  return out;
};

/**
 * Optional Minification
 */

var minify = function(css) {
  css = css
    // remove comments
    .replace(/\/\*[^\0]*?\*\//g, '')
    // trim space before characters
    .replace(/\s+({|})/g, '$1')
    // trim space after characters
    .replace(/(;|,|:|{|}|^)\s+/g, '$1')
    // trim combinators
    .replace(/\s+(>|\+|~)\s+/g, '$1')
    // remove escaped newlines and spaces
    .replace(/\\\r?\n\s+/g, '')
    // remove trailing semicolons in rules
    .replace(/;(})/g, '$1');

  return css;
};

/**
 * Base64 Images
 */

var img = {
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

var base64 = function(val) {
  return val.replace(
    /url\(([^)]+)\)/gi, 
    function(str, path) {
      var path = path.replace(/['"]/g, '')
        , ext = extname(path)
        , data;

      if (~path.indexOf('//') 
          || !img[ext]) return str;

      try {
        path = join(options.dir, path);
        data = fs.readFileSync(path, 'base64');
      } catch(e) {
        return str;
      }

      return 'url("data:' 
        + img[ext] 
        + ';base64,' 
        + data 
        + '")';
    }
  );
};

/**
 * Imported Stylesheets
 */

var imports = function(path) {
  if (path.indexOf('url') === 0) return path;

  var path = path.replace(/['"]/g, '') 
    , css = fs.readFileSync(path, 'utf8');

  path = join(options.dir, path);

  css = parse(lex(css), {
    __proto__: options,
    dir: dirname(path)
  });

  return css;
};

/**
 * Expose
 */

module.exports = parse;
