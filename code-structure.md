# The Art of Careful Code
2017-08-01 - Andras.

_(work in progress)_

What follow are suggestions on how to write reliable, maintainable code.  This is a
different approach to coding style than what you might be used to.  The focus is not
on what, but why:  it doesn't tell you what to do; it tells you what to avoid.

## Avoid Complexity.  Keep it simple.
- mental burden
- performance
- simpler to understand
- simpler to get right
- faster to write
- faster to re-learn when worked on
- when you read your code a year from now, you'll feel 20 IQ points dumber,
  and it won't make sense like it does now.  Write your code for that you.
- iterate (not recurse, not use iterator, not sling arrays)
- use variables, not argument vectors
- do not rely on third-party libraries to implement three-line loops

eg: for loop vs forEach() vs recursion

## Avoid Fancy Features.  Stay with the basics.
- performance
- wider skills base
- most coders will not know every nuance of the language
- the heart of the language is more likely to be efficient and glitch free

eg: [1,2,3].forEach() vs async([1,2,3]).forEach()
eg: [1,2,3].map() vs async([1,2,3]).map()

## Avoid Freeloaders.  Make libraries pay their way.
* each dependency is complexity that the next maintainer will have to master
- do not use complex libraries for simple functions
- vet and qualify libraries before relying on them
- wrapper functionality to narrow the exposed api

eg: `request` half the throughput of `http.request` or of a light-weight wrapper like `khttp`

## Avoid Confusion.  Aim for clarity.
* write code for the future.  You won't remember it in two years, won't recognize what
  it does, why, or how it works.  Save those 15 minute detours, avoid over-clever
  approaches.  Do yourself a favor, make the code self-envident.
* write code for the lowest common denominator.  Would it make sense to someone new to
  the language?  New to the libraries used? New to programming?
- take time to choose good names for functions and variables
- minimize clutter: avoid unnecessary variables and functions, they just add to the mental burden
- right-size functions: neither too large to comprehend nor too small to lose the forest
- try to make code obvious in both function and intent
- use comments to explain code that is not obvious.  Most functions will not need comments,
  but some functions will have 3x as many comment lines as code.  This is normal.
- avoid style over substance

## Avoid Disruption.  Respect existing code.
* Don't rip into the code, make your changes fit alongside.
- stay in keeping with the current style
- do not jump after every latest fad, code is not a fashion show
- do not introduce unnecessary diffs

## Avoid Entanglements.  Decouple functionality.
- isolate functionality into modules (classes)
- make the coupling between modules explicit (dependency injection)
- avoid monoliths
- construct building blocks

## Avoid Make-Work.  Code for today, design for tomorrow.
- do not put in unneeded features
- 

## Avoid Surprises.  Write tests.
- all functionality
- all options
- error handling
- write small, focused functions that are easier to thoroughly test
- pass in ("inject") dependencies to classes and functions, and test with mocks
- 80% unit tests (modules), 20% integration tests (coupling)
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
