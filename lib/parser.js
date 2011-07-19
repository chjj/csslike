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
 * A bit messy right now, 
 * some work.
 */

var parse = (function() {
  var opt
    , token
    , tokens
    , vars
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
    while (next().type !== 'end') { // rule_end
      if (token.type === 'rule') {
        token.selector = 
          token.selector.replace('&', selector);
        below.push(tok());
      } else {
        body.push(tok());
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
      + indent() + '}' 
      + below.join('');
  };

  var replace = function(val) {
    return val.replace(/\$[\w-]+/g, function(name) {
      if (!vars[name]) {
        throw new 
          Error('Undeclared variable: ' + name
                + '\nLine: ' + token.line);
      }
      return vars[name];
    });
  };

  var property = function(norep) {
    // a hack to make sure we dont 
    // evaluate global variables
    // prematurely. a trait's local 
    // variables take precedence.
    var val = norep 
      ? token.val 
      : replace(token.val);

    val = base64(val, opt);

    // clean whitespace
    val = val.replace(/(\() +| +(\))|(, ) +/g, '$1$2$3');

    return token.key + ': ' + val + ';';
  };

  var trait = function() {
    var token_ = token
      , body = [];

    depth++;
    while (next().type !== 'end') { // nested_at_end
      if (token.type !== 'property') {
        throw new
          Error('Non-property in trait.' 
                + '\nLine: ' + token.line);
      }
      body.push(indent() + property(true));
    }
    depth--;

    make_trait(token_, traits, body.join(''), replace);

    return '';
  };

  var nested_at = function() {
    if (token.name === '@trait') { 
      return trait();
    }

    var token_ = token
      , body = [];

    depth++;
    while (next().type !== 'end') { // nested_at_end
      body.push(tok());
    }
    depth--;

    body = body.join('');

    return token_.name + ' ' 
      + token_.params 
      + ' {' 
      + body 
      + indent() + '}\n';
  };

  var at = function() {
    var name = token.name 
      , val = token.params 
      , trait;

    switch (name) {
      case '@var':
        val = val.split(/\s+/);
        vars[val[0]] = replace(val[1]);
        return '';
      case '@mixin':
        trait = mixin(token, traits);
        return replace(trait);
      case '@import':
        val = imports(val, opt); 
        break;
    }

    return name + ' ' + val;
  };

  var comment = function() {
    var text = token.text
      .replace(/\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return '\n' + indent() + '/**' 
      + indent() + ' * ' + text 
      + indent() + ' */\n';
  };

  var tok = function() {
    switch (token.type) {
      case 'comment':
        return comment();
      case 'rule':
        return indent() + rule();
      case 'property':
        return indent() + property();
      case 'nested_at':
        return indent() + nested_at();
      case 'at':
        return indent() + at();
      default:
        throw new
          Error('Unexpected token: ' 
                + JSON.stringify(token));
    }
  };

  return function(src, options) {
    opt = options || {};
    tokens = src.reverse();
    vars = {};
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
      .replace(/}\n\n}/g, '}\n}');

    if (opt.minify) {
      out = minify(out);
    }

    opt = null;
    token = null;
    tokens = null;
    vars = null;
    traits = null;
    depth = null;

    return out;
  };
})();

/**
 * Optional Minification
 */

var minify = function(css) {
  css = css
    // remove comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
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
 * Mixins
 */

var make_trait = function(token, traits, body, replace) {
  var header = token.params
    , $ = header.match(/^([\w-]+)\s*(?:\(([^)]+)\))?/) 
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

var mixin = function(token, traits) {
  var header = token.params
    , $ = header.match(/^([\w-]+)\s*(?:\(([^)]+)\))?/) 
    , name = $[1]
    , args = $[2]
    , trait = traits[name];

  if (!trait) {
    throw new 
      Error('Undeclared mixin: ' + name
            + '\nLine: ' + token.line);
  }

  if (args) {
    args = args.split(/\s*,\s*(?![^(]*\))/);
    args = args.map(function(arg) { 
      return arg[0] === '(' 
        ? arg.slice(1, -1) : arg;
    });
    return trait.apply(null, args);
  }

  return trait();
};

/**
 * Extra Features
 */

var img = {
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

var base64 = function(val, opt) {
  return val.replace(/url\(([^)]+)\)/gi, function(str, path) {
    var ext = extname(path.replace(/['"]/g, ''))
      , data;

    if (~path.indexOf('//') 
        || !img[ext]) return str;

    try {
      data = fs.readFileSync(join(opt.dir, path), 'base64');
    } catch(e) {
      return str;
    }

    return 'url("data:' + img[ext] + ';base64,' + data + '")';
  });
};

var imports = function(path, opt) {
  if (path.indexOf('url') === 0) return path;

  var path = join(opt.dir, path.replace(/['"]/g, ''))
    , css = fs.readFileSync(path, 'utf8')
    , original = opt.dir;

  opt.dir = dirname(path);
  css = parse(lex(css), opt);
  opt.dir = original;

  return css;
};

module.exports = parse;