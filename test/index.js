var css = require('../')
  , lex = css.lexer
  , parse = css.parser
  , fs = require('fs')
  , util = require('util')
  , assert = require('assert');

var str = fs.readFileSync(__dirname + '/test.css', 'utf8')
  , old = fs.readFileSync(__dirname + '/out_good.log', 'utf8');

var out = 
util.inspect(lex(str))
+ '\n\n\n\n' 
+ '--------' 
+ '--------'
+ '--------'
+ '--------'
+ '--------'
+ '--------'
+ '--------'
+ '--------'
+ '--------'
+ '--------' 
+ '\n\n\n\n'
+ parse(lex(str));

fs.writeFileSync(__dirname + '/out.log', out);

out = out.replace(/\s+/g, '');
old = old.replace(/\s+/g, '');

assert.ok(out === old, 'Failed.');

console.log('Complete');
