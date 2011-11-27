/**
 * csslike - Lexer
 * Copyright (c) 2011, Christopher Jeffrey. (MIT Licensed)
 */

var assert = require('assert').ok;

/**
 * States:
 *  inside
 *    refers to the "inside" of rules and at rules.
 *    rules and at-rules are becoming more and more
 *    syntactically similar every day - they can now
 *    contain both properties and/or rules.
 *  at_rule
 *    the "header" of an at-rule.
 *  single_string
 *    a single quoted string.
 *  double_string
 *    a double quoted string.
 *  comment
 *    a multiline comment.
 *  value
 *    a rule's or at-rule's property's value.
 */

var lexer = function(css) {
  css = css.replace(/\r\n|\r/g, '\n');

  var i = 0
    , l = css.length
    , ch
    , buff = ''
    , key
    , line = 1
    , offset = 0
    , tokens = []
    , stack = [];

  var state = function() {
    return stack[stack.length-1];
  };

  for (; i < l; i++) {
    ch = css[i];
    offset++;

    switch (ch) {
      case '\\':
        buff += ch;
        buff += css[++i];
        break;
      case '\n':
        offset = 0;
        line++;
        ; // FALL-THROUGH
      case '\t':
        switch (state()) {
          case 'single_string':
          case 'double_string':
          case 'comment':
            buff += ch;
            break;
          default:
            break;
        }
        ; // FALL-THROUGH
      case ' ':
        // need this to get at-rule
        // names, store them in `key`
        if (state() === 'at_rule' && !key) {
          key = buff;
          buff = '';
        }
        buff += ch;
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
              params: buff.trim(),
              line: line
            });
            key = '';
            buff = '';
            stack.pop();
            stack.push('inside');
            break;
          case 'value':
            // we were inside a
            // selector instead
            // of a property like
            // we originally thought
            stack.pop();
            buff = key + ':' + buff;
            key = '';
            ; // FALL-THROUGH
          case 'inside':
          default:
            tokens.push({
              type: 'rule',
              selector: buff.trim(),
              line: line
            });
            buff = '';
            stack.push('inside');
            break;
        }
        break;
      case '}':
        switch (state()) {
          case 'value':
            tokens.push({
              type: 'property',
              key: key.trim(),
              val: buff.trim(),
              line: line
            });
            key = '';
            buff = '';
            stack.pop();
            // in case someone omitted
            // the semicolon at the end
            if (state() === 'inside') {
              ; // FALL-THROUGH
            } else {
              //break; // do we need this?
              assert(('bad state', 0));
            }
          case 'inside':
            tokens.push({
              type: 'end',
              line: line
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
          case 'inside':
            // at this point were
            // either inside a selector
            // or a property, we dont
            // really know. well assume
            // its a property for now,
            // and if we hit a curly
            // brace later, we can
            // change the state token
            // to a rule
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
            // a useless semicolon
            if (!key) break;
            tokens.push({
              type: 'property',
              key: key.trim(),
              val: buff.trim(),
              line: line
            });
            key = '';
            buff = '';
            stack.pop();
            break;
          case 'at_rule':
            tokens.push({
              type: 'at',
              name: key,
              params: buff.trim(),
              line: line
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
        switch (state()) {
          case 'single_string':
          case 'double_string':
          case 'comment':
            buff += ch;
            break;
          default:
            if (css[i+1] === '*') {
              i++;
              stack.push('comment');
            } else {
              buff += ch;
            }
            break;
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
                line: line
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
            assert(buff.trim() === '');
            buff = '';
            buff += ch;
            stack.push('at_rule');
            break;
        }
        break;
      case '"':
        switch (state()) {
          case 'comment':
          case 'single_string':
            break;
          case 'double_string':
            stack.pop();
            break;
          default:
            stack.push('double_string');
            break;
        }
        buff += ch;
        break;
      case '\'':
        switch (state()) {
          case 'comment':
          case 'double_string':
            break;
          case 'single_string':
            stack.pop();
            break;
          default:
            stack.push('single_string');
            break;
        }
        buff += ch;
        break;
      default:
        if (ch < ' ') {
          throw new
            Error('Control character found.'
                  + '\nLine: ' + line
                  + '\nOffset: ' + offset);
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

module.exports = lexer;
