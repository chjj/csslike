var css = require('../')
  , lex = css.lexer
  , parse = css.parser
  , fs = require('fs');

var str = fs.readFileSync(__dirname + '/test.css', 'utf8');

console.log(lex(str));
//lex(str);
console.log('\n\n\n\n\
--------------------------------------------------------------------------------\
\n\n\n\n');
console.log(parse(lex(str)));
//parse(lex(str));