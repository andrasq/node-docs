# The Art of Careful Code
2017-08-01 - Andras.

_(work in progress)_

What follow are suggestions on how to write reliable, maintainable code.  This is a
different approach to coding style than what you might be used to.  Instead of
evangelism, fashion-think or turf-marking, the focus is not on what, but why:  advice
on what makes code poor, and how to avoid it.

The below insights from decades of software engineering are not brand new "best
practices" cooked up for for the occasion.  Maybe contrarian, but if you view a 3 year
old application not as obsolete but as having finally had time to discover and fix its
more obvious bugs, this guide may be of interest.


## Avoid Complexity.  Keep it simple.
- mental burden
- performance
- easier to understand
- simpler to get right
- faster to write
- faster to re-learn when worked on
- easier to optimize
- when you read your code a year from now, you'll feel 20 IQ points dumber,
  and it won't make sense like it does now.  Write the code for that you.
- iterate (not recurse, not use iterator, not sling arrays)
- use variables, not argument vectors
- do not pull in complex libraries to implement simple functions.  Once in,
  their more obscure features will also start creeping into the code, with every
  maintainer responsible for knowing and understanding them all.
- optimize only when useful, since optimization itself introduces complexity

eg: for loop vs forEach() vs recursion


## Avoid Fancy Features.  Stay with the basics.
- performance
- wider skills base
- more obvious
- more widely compatible, less likely to change
- most coders will not know every nuance of the language
- the heart of the language is more likely to be efficient and glitch free

eg: `[1,2,3].forEach()` vs `async.forEach([1,2,3])` -- argument order not the same

eg: `[1,2,3].map()` vs `async.map([1,2,3])` -- argument order not the same

eg: `[].reverse()` vs `for (var i=0, j=a.length-1; i<j; i++, j--) { t = a[i]; a[i] = a[j]; a[j] = t }` -- 100x faster to reverse array of objects with for loop


## Avoid Freeloaders.  Make libraries pay their way.
* each dependency is complexity that the next maintainer will have to master
- do not use complex libraries for simple functions
- vet and qualify libraries before relying on them
- wrapper functionality to narrow the exposed api

eg: `request` half the throughput of `http.request` or [`khttp`](https://github.com/andrasq/node-k-http) (a light-weight wrapper)


## Avoid Confusion.  Aim for clarity.
* write code for the future.  You won't remember it in two years, won't recognize what
  it does, why, or how it works.  Save those 15 minute detours, avoid over-clever
  approaches.  Do yourself a favor, make the code self-evident.
* write code for the lowest common denominator.  Would it make sense to someone new to
  the language?  New to the libraries used? New to programming?
- take time to choose good names for functions and variables.
  Here's a commonly used naming system that works well:
  - UPPER_CASE_CONSTANT - for class or file constants
  - camelCaseName - variables, functions, methods
  - CapitalizedClass - classes, typedefs
- right-size functions: neither too large to comprehend nor too small to lose the forest
- make code obvious in both function and intent
- choose names so as to make reading the lines tell the story
- find good seams to create subsystems that minimize information shuttling
- use comments to explain code that is not obvious.  Most functions will not need comments,
  but some functions will have 3x as many comment lines as code.  This is normal.
- avoid style over substance


## Avoid Clutter.  Make every line count.
- avoid unnecessary variables and functions, they add to the mental burden
- smaller is simpler
- special cases add delays and complexity
- solve the problem at hand, tomorrow's feature is today's baggage
- easier to rewrite later than to future-proof now


## Avoid Disruption.  Respect existing code.
* Don't rip into the code, make your changes fit alongside.
- stay in keeping with the current style
- do not jump after every latest fad, code is not a fashion show
- do not introduce unnecessary changes
- minimize diffs


## Avoid Entanglements.  Decouple functionality.
- isolate functionality into modules (classes)
- make the coupling between modules explicit (dependency injection)
- avoid monoliths
- construct building blocks


## Avoid Make-Work.  Code for today.
- do not put in unneeded features
- easier to redesign tomorrow than to future-proof now
- leave the code as clean and as complete as possible; assume it won't be revisited


## Avoid Surprises.  Write tests.
- test all advertised functionality
- test all options
- test error handling
- test the expected uses cases
- think about and test likely unexpected use cases
- write small, focused functions that are easier to thoroughly test
- pass in ("inject") dependencies to classes and functions, and test with mocks
- 90% unit tests (modules), 10% integration tests (coupling), end-to-end tests (full stack)
- do not assume that third-party libraries will not change.  Test the required invariants.


## Avoid Pain.  Make code testable.
* want to run all the code without actually performing any actions
- wrap classes around functions
- access helper functions as method calls
- isolate side-effects into access functions
- expose classes, methods, and function to the unit tests
- expose internal helper functions too
  - add them as class methods, or add a .getTestInspector() method to return them
- expose helper classes


## References

- W3C: 3.1 Solve real problems.  3.2 Priority:  User > Author > Implementer > Specifier > Theoretical Purity.
- [W3C Design Principles](https://www.w3.org/TR/html-design-principles/#priority-of-constituencies)
- [The Art of Code Layout](https://github.com/andrasq/node-docs/blob/master/code-layout.md)
