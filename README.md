# csslike

__csslike__ is a CSS preprocessor designed to follow the latest www-style 
proposals from Tab Atkins for CSS variables, mixins, and nested rules (a lot of 
which appears to be based on LESS and SASS' curly brace syntax, but with some 
differences).

It's a work in progress. I wanted to make sure the lexer was extremely robust 
for forward compatibility, in case there are anymore additions. So, the lexer 
is pretty verbose, it wasn't built for speed, but it will tokenize anything,
nothing is hardcoded.

It also includes some small features like auto-base64'ing images, pretty 
printing, minifying, as well as imported stylesheets, but for the most part, I 
want to keep it in line with potential standards.

## License

Copyright (c) 2011, Christopher Jeffrey. (MIT Licensed)  
See LICENSE for more info.