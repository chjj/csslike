# csslike

__csslike__ is a CSS preprocessor designed to follow the latest www-style
[proposals from Tab Atkins][tab] for CSS [variables][vars], [mixins][mixins],
and [nested rules][nest] (a lot of which appears to be based on LESS and SASS'
curly brace syntax, but with some differences).

It's a work in progress. I wanted to make sure the lexer was extremely robust
for forward compatibility, in case there are anymore additions. So, the lexer
is pretty verbose, it wasn't built for speed, but it will tokenize anything,
nothing is hardcoded.

It also includes some small features like auto-base64'ing images, pretty
printing, minifying, as well as imported stylesheets, but for the most part, I
want to keep it in line with potential standards.

[tab]: http://www.xanthir.com/blog/b49w0
[vars]: http://lists.w3.org/Archives/Public/www-style/2011Feb/0311.html
[mixins]: http://lists.w3.org/Archives/Public/www-style/2011Mar/0478.html
[nest]: http://lists.w3.org/Archives/Public/www-style/2011Jun/0022.html

[var-draft]: http://lists.w3.org/Archives/Public/www-style/2011Jun/0329.html

## Syntax

``` css
@var $green #00ff00

@trait bg {
  background: $green;
}

@trait content($t) {
  content: $t;
}

article {
  color: black;
  & > header {
    border: 1px solid;
    & > h1 {
      background: orange;
    }
  }
  @mixin bg;
  @mixin content("hello world");
}
```

output:

``` css
article {
  color: black;
  background: #00ff00;
  content: "hello world";
}
  article > header {
    border: 1px solid;
  }
    article > header > h1 {
      background: orange;
    }
```

## Middleware Usage

``` js
app.use(
  csslike.handle({
    dir: __dirname,
    minify: true,
    cache: true
  })
});
```

or for a specific file:

``` js
app.use('/my_stylesheet',
  csslike.handle({
    file: __dirname + '/static/style.css',
    dir: __dirname,
    minify: true,
    cache: true
  })
});
```

## License

Copyright (c) 2011, Christopher Jeffrey. (MIT Licensed)
See LICENSE for more info.
