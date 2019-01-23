on eslint rules
===============
2019-01-14 - AR.

The eslint ruleset for our small team defines 264 rules over 889 lines.  That's a lot for a
first stab.  The majority are inert "dark matter" and were not encountered.  Some have an
obvious role and can be worked around, others are run into all the time and just get in the
way.

The problem rules some mandate a dress code, some ban unapproved thoughts.  Instead of
trusting the developer, they impose pre-selected cookie-cutter answers even to as yet
unasked questions, even when the answer is an artifact of the limitations of the linting
tool.

Ironic how corporate culture can change without changing.  50 years ago the office dress
code was mandatory, but engineering was unconstrained.  Today one can wear whatever, but the
thinking must conform.

Below are the rules that I've disabled: some turned off altogether, others one-off
suppressed.  All rejected clean, good code that should have been allowed.

### `strict`
[broken]
`'use strict'` is not duplicated by linting.  It's immediate (fails during
  unit tests, even before linting), it happens at runtime (even for dynamically generated
  code), and catches some errors that lint doesn't (eg `global.NaN = 3`).  Banning `'use
  strict'` disables a useful protection.

### `space-in-parens`
[cosmetic]
normalizes spacing of function call arguments, but also affects
  function declarations.  I find function definitions more legible and more distinct with better
  spacing, eg `myFunction( arg1 ) { ... }` vs `myFunction(arg)`.  This also makes it easier to
  search for the function definition with file utils or in a text editor.

### `array-bracket-spacing`
[cosmetic]
inconsistent, doesn't match how `{}` objects are laid out.
  One mandates spaces `{ firstIdentifier: 1, secondIdentifier: 2 }` the other bans them,
  `[firstIdentifier, secondIdentifier]`.  This is over-specified: there isn't an obvious
  benefit to mandating either style, which presents better depends on the actual contents of
  the array.

### `max-len`
[broken]
too short.  Max 120 characters per line is rather on the short side, especially if using
descriptive names.

### `indent`
[broken]
2-space indentation is a poor choice.  It works for blocks of text (yaml, python) but makes
  C-style syntax harder to read.  Indentation serves the same function as blank lines, to
  highlight code structure.  For it to work, the highlight must give the blocks clear, distinct
  shape:  beginning, middle, and end.  C-style langauges scatter punctuation into the text, and
  punctuation acts like mumbling, blurring the edges of the structural elements and smearing the
  meaning.  To counterweigh the indistinct blobs of text, additional visual reinforcement is
  needed; two spaces are not enough.

### `no-multi-spaces`
[cosmetic]
this rule disallows not only rubbish whitespace in lines, but also
  aligned trailing comments and aligned assigmnents.  This is not a commonly encountered
  problem, and the benefits of aligned blocks outweigh the risks of having to correct someone's
  poor layout.  E.g.:

        // banned:
        first      = 1;               // one value
        second     = 'two';           // another value
        third      = 'three';         // yet another value
        thirteenth = 13;              // long-named value

### `no-use-before-define`
[broken]
only useful for `var` variables: it prevents a variable from
  being used before it's defined.  But the `no-var` rule bans `var` variables altogether, and
  `let` and `const` already behave this way.  However, it also bans functions from being used
  before being defined, which is unexpected, since javascript functions are relied on to be
  valid everywhere within the scope.  This breaks the very common "top-down" code layout pattern
  where the important code is placed at the top of the file and the helper functions below at
  the bottom.

### `object-shorthand`
[broken]
The new ES6 concise object syntax offers new shortcuts to
  defining objects.  The shortcuts rely on omitting the property name in some cases.  This
  can be a time-saver when typing, but these shortcuts result in code that is more
  obscure, harder to read, harder to follow and harder to grep.  They are not a uniformly
  better way, they are faster-to-type way of writing the same code.  Banning traditional
  object layout is misguided. The new syntax is not always possible to use, and mandating
  it can result in weird-looking code, eg:

        const b = 2;
        const x = {
            a: 1,                     // cannot be abbreviated, must be in standard notation
            b,                        // mandatory abbreviation
            bTwo: b,                  // rename, cannot be abbreviated
            third() { return 3 },     // mandatory abbreviation, an unusual-looking function definition
            fourth: () => 4,          // cannot be abbreviated, standard notation
        }

  Also note the new ES6 visual ambiguity:

        x = { b };                    // object assignment, { b: b }
        { b };                        // code block, evaluates to 2

### `semi`
[cosmetic]
in many cases a javascript semicolon is visual clutter, and the code is
  helped by omitting it.  Some examples are before a same-line closing curly-brace, and
  after the '})' of a multi-line call with an in-line callback function.

### `prefer-template`
[broken]
string concatenation is often clearer than concatenating with
  template literals, even in the case of multiple arguments.  The punctuation and layout
  required for templates obscures the code, making it harder to see at a glance what is
  going on.  Templates should be available to simplify code, but should not be preferred.
  E.g.:

        path = `${head}/${tail}`;     // punctuation clutter
        path = `${path}/`;

  vs

        path = head + '/' + tail;     // obvious
        path += '/';

### `arrow-parens`
[cometic]
Arrow functions are a shorthand for defining anonymous bound functions.
  They have rather loose definition syntax; it helps to always parenthesize the parameter list to help identify
  them as functions.
  The below are all valid syntax:

        (a, b) => { return a + 1 }
        (a, b) => a + 1
        (a) => a + 1
        a => a + 1
        // error:  => a + 1
        // error:  a,b => a + 1

  Always parenthesizing the parameter list, even if just one, helps visually reinforce the
  distinction between arrow functions and other miscellaneous punctuation (eg comparisons
  `<=` and `>=`).  It also keeps arrow function definitions consistent, since the
  parentheses cannot be omitted if there are two or more function parameters.

### `no-array-constructor`
[broken]
under some circumstances `new Array()` is much faster than
  `[]`.  The specifics seem to vary from node version to node version, but in general
  arrays that will be extended prefer being constructed with `new`.

### `no-param-reassign`
[broken]
this is a well-meaning and seemingly reasonable rule to prevent accidental
  modification to function arguments.  It interferes however with a widespread nodejs idiom,
  optional function arguments.  Optional arguments require fixup, ie remapping them to their
  canonical (parameter) names, the most direct way being to reshuffle the arg contents.  The
  workarounds are verbose and awkward (copy-in from shadow variables), obscure (extract from
  `arguments`), or inefficienet (pass hashes).

  On the face of it the rule is also often pointless; in functions that take optional
  arguments it fails in its purpose.  E.g., given `(_arg) => { arg = _arg; ... }` the
  internal name and all access will be to `arg`, not `_arg`.  Since `arg` is not guarded, an
  unintentional modification to `arg` will break the code the same as without this rule.

  Upon reflection, this rule makes sense if the intent is to manually override it for
  remapping optional args, and _then_ prevent modifications.  On its own, it fails.

### `arrow-body-style`
[broken]
this rule bans "unnecessary" braces around arrow-function bodies.
In combination with `no-confusing-arrow`, however, this results in a Catch-22:
  - "no-confusing-arrow:error" bans `(a) => a < 1`, wants braces around the conditional
  - "arrow-body-style:as-needed" bans `(a) => { a < 1 }` one-liner function body

### `no-mixed-operators`
[broken]
this is a partially thought through directive.  It might have a slightly useful intent, but
  ends up being mostly annoying clutter.  It aims to prevent usage errors by requiring the
  explicit parenthesization of binary operators instead of relying on the language built-in
  precedence rules.  So `1 + 2 * 3` has to be written as `1 + (2 * 3)`.  But it also mandates
  parentheses where not needed eg `1 + 2 - 3`, and misses other potential usage errors, eg
  `1 / 2 / 3` (1/6, but maybe wanted 1.5) This rule is not ready for prime time yet.

### `no-continue`
[broken]
maybe a bit of displaced anti-goto zeal, but banning `continue`
  statements while allowing mid-loop `break` and allowing -- nay, encouraging -- mid-function
  early `return` is plain silly: they're all the same.  Each of them means "I'm done
  here, on to the next", and used as such is perfectly clear and easy to follow.  Each can
  be coded around by using more levels of it-else.  In addition, if the loop body is converted
  to a function, the `continue` can be replaced with `return` which is permitted.  E.g.:

        for (item of dataItems) {
            if (dataNotSuitable(data)) continue;
            processData(data);
            if (notSuitableForMore(data)) continue;
            moreProcessData(data);
        }

### `no-restricted-syntax`
[broken]
`for-in` and `for-of` are convenience iterators built into the
  language for objects and arrays, respectively.  They are clear and safe, and should not be
  on the "warn about" list.  Labeled statements and `with` are unusual enough to merit a
  warning (to be silenced with embedded directives on a case-by-case basis).

### `guard-for-in`
[broken]
warns if a `for-in` loop does not test each property before using it.
  The intent is to catch code that does not distinguish "own" properties from inherited
  properties.  In practice this adds a lot of false alerts, because most for-in loops iterate over
  hashes, i.e. objects with no methods and no inherited properties.  Own properties are easily
  obtained with `Object.keys()`.

  Arguably, filtering `own` properties is still wrong, becuase inherited properties are just
  as valid as own properties.  The useful distinction is methods vs properties, which is hard:
  an inherited function property may be data not a method (eg a default error reporter), and
  an own function property may be a method not data (constructor-defined methods).

More:

### `no-path-concat`
[broken]
only a matter for portability from Windows to Unix, safe on
  Linux.  Windows used to accept Unix forward slashes as path separators, so really, this
  guard is for cross-platform code written by Windows programmers on Windows but intended to
  also run on Unix.

  Also, the rule only checks direct use of `__dirname` and `__filename`, not that the rest
  of the path was constructed in a platform-neutral way.  In addition, nodejs exports
  `path.sep`, the current platform-specific path separator ie `/`, which also has to be
  concatenated.

        anchoredPath = path[0] === '/' ? path : __dirname + '/' + path;

### `no-return-assign`
[cosmetic]
this warns about the handy shortcut of the combined form of
  `saved = current; return current;` ie `return saved = current;`.  A blanket discouragement
  is unwarranted; should be allowed, maybe compromise and allow the parenthesized form.
  (same argument for assignment inside conditionals, eg `if` and `while`)

        current = computeCurrent();
        return (last = current);

### `operator-assignment`
[cosmetic]
this mandates the use of `+=` `-=` etc self-updating operators.
  These should be instinctive, but are too minor to mandate, and should be left to each coder.

### `no-plusplus`
[broken]
bans the pre- and postfix increment and decrement operators.  Two
  problems here:  yes arithmetically the same, but conceptually, incrementing is advancing
  to the next element, while adding is an arithmetic operation.  Indexes are incremented,
  counters are added to.  It's nice when code reflects this.  Second, the prefix/postfix
  semantics are sometimes cumbersome to achieve by other means, and would result in more
  convoluted code.  In general, operator usage is too trivial to mandate, and should be up
  to each coder and each circumstance.

        if (list[idx++] === match) ...              // traditional form
        if (list[(idx += 1) - 1] === match) ...     // mandated usage

### `no-cond-assign`
[broken]
while in general alerting on assignment inside conditionals
  should help catch errors, it should be possible to cleanly overrule the default eg by
  wrapping the assignment in parentheses.  Combining the assignment and test can save a
  dupliated line of code, avoiding having to maintain them in two places.  E.g.:

        // intended
        while ((nextGuess = numbers[guessIndex++]) !== 42) wrongGuessCount += 1;

  vs

        // mandated
        nextGuess = numbers[guessIndex++];
        while (nextGuess !== 42) {
            wrongGuessCount += 1;
            nextGuess = numbers[guessIndex++];
        }

### `one-var, one-var-declaration-per-line`
[cosmetic]
overly broad, mandating klunky constructs
  instead of their clean equivalents even when there is no benefit, E.g.:

        let head, tail, current;      // clean intuitive form

  vs

        let head;                     // mandated redundant form
        let tail;
        let current;

  The rules should allow one-liner variable declarations, maybe mandate line breaks for
  variable definitions (one-var-declaration-per-line:[error,initializations]).  Not clear
  whether there is any benefit to the current one-var:[error,never] rule, which mandates a
  separate `var` keyword for each variable declaration.

### `no-nested-ternary`
[broken]
No need.  This mis-named rule bans chained ternary
  expressions, which are no harder to follow than chained if-elseif-elseif-else, but are an
  expression, not a statement.  Javascript implements the expected left-to-right semantics,
  e.g.:

        print(
            n >= 1000 ? '' + n :
            n >= 100  ? '0' + n :
            n >= 10   ? '00' + n :
                        '000' + n
        )
      
### `no-unneeded-ternary`
[broken]
This linting rule is misguided.  It bans the use of a ternary expression to assign a boolean
value, requiring a workaround such as casting to Boolean or double-negation `!!`.  The docs
suggests assigning the tested condition instead, but that changes the semantics when the
conditional evaluates to truthy not boolean.  Conditional assignment is a clearer, more
direct construct whose meaning is immediately obvious.

        let more = list.head() ? true : false;   // banned, assigns true|false
        let more = list.head();                  // wrong, assigns object
        let more = !!list.head();                // mandated, true|false

  Every ternary expression can be converted to one using boolean `||` and `&&`, but not
  always for the better.  And every conditional can be wrapped in a function that returns a
  boolean, but that's just unneeded clutter. Also, this rule is weak at detecting truly
  unneeded ternaries, it only bans assigning booleans.

### `func-call-spacing`
[cosmetic]
bans a space between the function name and the following
  parentheses.  API's that introduce English keywords, eg `mocha`, scan better with an added
  space after the function name, similarly to how they looked in CoffeeScript.  Eg `describe
  ('section'` and `it ('should'` instead of `describe('section'` and `it('should'`.  API's that
  expose methods are well spaced by the `.` property separator.  More broadly, I've not seen
  this ever be an issue (unlike omitting the space after keywords like `if` or `while`).

### `no-spaced-func`
[cosmetic]
old name for the func-call-spacing rule.  No need for both.

### `dot-notation`
[broken]
requires accessing properties by dotted name.  However, it also
  requires accessing the contents of a hash by dotted name, even though logically property
  names index a fixed-layout structure; a hash is indexed by strings.  In some cases it's
  clearer to use the hash syntax even with constant keys.  Having to disable the rule for
  every reference will lead to the rule being globally turned off by files that work with
  such hashes.  E.g.:

        req.headers['Content-Type'] = 'application/json';         // permitted
        req.headers['Authorization'] = 'Basic';                   // banned
