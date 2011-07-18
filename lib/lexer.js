/**
 * csslike - Lexer
 * Copyright (c) 2011, Christopher Jeffrey. (MIT Licensed)
 */

var lex = function(css) {
  var i = 0
    , l = css.length
    , ch
    , state
    , val
    , buff = ''
    , key
    , lineno = 1
    , lineoff = 0
    , tokens = []
    , stack = [];

  css = css.replace(/\r\n/g, '\n')
           .replace(/\r/g, '\n');

  tokens.push = function(token) {
    for (var k in token) {
      if (typeof token[k] === 'string') {
        token[k] = token[k].trim();
      }
    }
    return Array.prototype.push.call(tokens, token);
  };

  state = function() {
    return stack[stack.length-1];
  };

  for (; i < l; i++) {
    ch = css[i];
    lineoff++;

    switch (ch) {
      case '\\':
        buff += ch;
        buff += css[++i];
        break;
      case ' ':
        // need this to get at-rule names
        // store them in `key`
        // should maybe use a different variable
        // to avoid confusion
        if (state() === 'at_rule' && !key) { 
          key = buff;
          buff = '';
        }
        //if (buff[buff.length-1] !== ' ') 
        buff += ch;
        break;
      case '\n': // FALL-THROUGH
        lineoff = 0;
        lineno++;
      case '\t':
      case '\v':
      case '\r':
        switch (state()) {
          case 'single_string':
          case 'double_string':
          case 'comment':
            buff += ch;
            break;
          default:
            break;
        }
        break;
      case '{':
        switch (state()) {
          case 'single_string':
          case 'double_string':
          case 'comment':
            buff += ch;
            break;
          case 'at_rule':
            tokens.push({
              type: 'nested_at', 
              name: key, 
              params: buff, 
              line: lineno
            });
            key = ''; 
            buff = '';
            stack.pop();
            stack.push('nested_at_rule');
            break;
          case 'rule':
          default:
            tokens.push({
              type: 'rule', 
              selector: buff, 
              line: lineno
            });
            buff = '';
            stack.push('rule');
            break;
        }
        break;
      case '}':
        switch (state()) {
          case 'value':
            tokens.push({
              type: 'property', 
              key: key, 
              val: buff, 
              line: lineno
            });
            key = '';
            buff = '';
            stack.pop();
            // need this for @viewport-like rules
            if (state() === 'nested_at_rule') {
              ; // FALL-THROUGH
            } else {
              break;
            }
            //break;
          case 'nested_at_rule':
            tokens.push({
              type: 'nested_at_end', 
              line: lineno
            });
            buff = '';
            break;
          case 'rule':
            tokens.push({
              type: 'rule_end', 
              line: lineno
            });
            buff = '';
            break;
        }
        switch (state()) {
          case 'single_string':
          case 'double_string':
          case 'comment':
            buff += ch;
            break;
          default:
            stack.pop();
            break;
        }
        break;
      case ':':
        switch (state()) {
          case 'nested_at_rule': // need this for @viewport-like rules
            var c = i, h;
            // this is a sticky situation...
            // were in the top level of a nested at-rule here,
            // but we dont know whether were in an "at-rule property"
            // or a selector (pseudo-class/element). so we need to 
            // lookahead a few bytes to check for a curly brace.
            // an easier way would be to simply list and classify
            // the different at-rules, but i want to lex this
            // independent of any semantic knowledge.
            while ((h = css[++c]) 
                   && h !== ';' 
                   && h !== '}' 
                   && h !== '{');
            if (h !== '{') {
              ; // FALL-THROUGH
              // maybe dont need this,
              // could just set the key here
              // and add a case for nested_at 
              // under the semicolon case
              // or maybe just do:
              // case 'nested_at': buff.split(':'); etc
              // under the semicolon case and dont bother
              // with the lookahead at all
            } else {
              buff += ch;
              break;
            }
          case 'rule':
            key = buff;
            buff = '';
            stack.push('value');
            break;
          default:
            buff += ch;
            break;
        }
        break;
      case ';':
        switch (state()) {
          case 'value':
            if (!key) break; // a useless semicolon
            tokens.push({
              type: 'property', 
              key: key, 
              val: buff, 
              line: lineno
            });
            key = '';
            buff = '';
            stack.pop();
            break;
          case 'at_rule':
            tokens.push({
              type: 'at',
              name: key, 
              params: buff,
              line: lineno
            });
            key = ''; 
            buff = '';
            stack.pop();
            break;
          default:
            buff += ch;
            break;
        }
        break;
      case '/':
        if (css[i+1] === '*') {
          i++;
          stack.push('comment');
        } else {
          buff += ch;
        }
        break;
      case '*':
        switch (state()) {
          case 'comment':
            if (css[i+1] === '/') {
              i++;
              tokens.push({
                type: 'comment', 
                text: buff, 
                line: lineno
              });
              buff = '';
              stack.pop();
            } else {
              buff += ch;
            }
            break;
          default:
            buff += ch;
            break;
        }
        break;
      case '@':
        switch (state()) {
          case 'single_string':
          case 'double_string':
          case 'comment':
            buff += ch;
            break;
          default:
            buff += ch;
            stack.push('at_rule');
            break;
        }
        break;
      case '"':
      case '\'':
        val = (ch === '"' ? 'double_' : 'single_') + 'string';
        if (state() !== val && state() !== 'comment') {
          stack.push(val);
        } else if (state() === val) {
          stack.pop();
        }
        buff += ch;
        break;
      default:
        if (ch < ' ') {
          throw new 
            Error('Control character found.'
                  + '\nLine: ' + lineno
                  + '\nOffset: ' + lineoff);
        }
        buff += ch;
        break;
    }
  }

  return tokens;
};

/**
 * Expose
 */

module.exports = lex;