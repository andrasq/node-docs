# The Art of Careful Code
2017-08-01 - Andras.

_(work in progress)_

What follows are suggestions on how to write reliable, efficient code.  This is a
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

## Avoid Fancy Features.  Stay with the core.
- performance
- wider skills base
- most coders will not know every nuance of the language
- the heart of the language is more likely to be efficient and glitch free

eg: [1,2,3].forEach() vs async([1,2,3]).forEach()
eg: [1,2,3].map() vs async([1,2,3]).map()

## Avoid Freeloaders.  Make libraries pay their way.
* each dependency is complexity that the next maintainer will have to master
- do not use complex libraries for simple functions
- vet and qualify the libraries before relying on them
- wrapper functionality to narrow the exposed api

eg: `request` half the throughput of `http.request` or of a light-weight wrapper like `khttp`

## Avoid Confusion.  Aim for clarity.
* write code for the future.  You won't remember it in two years, won't recognize what
  it does, why, or how it works.  Save those 15 minutes detours, avoid over-clever
  approaches.  Do yourself a favor, make the code self-envident.
- take care when naming functions and variables
- choose the right function size, neither too large to comprehend nor too small to lose the forest
- try to make code obvious both in intent and function
- use comments to explain code that is not obvious.  Most functions will not need comments,
  but some functions will have 3x as many comment lines as code.  This is normal.

## Avoid Disruption.  Respect the code.
* Don't rip apart the existing code, make your changes fit alongside.
- stay in keeping with the existing style
- do not jump after each new fad
- do not introduce unnecessary diffs

## Mind The Gap.  Decouple functionality.
- isolate functionality into modules (classes)
- make the coupling between modules explicit (dependency injection)
- avoid monoliths
- construct building blocks

## avoid extra work (code for today, design for tomorrow)
- do not implement optional features until needed
- 

## make code testable
* want to run all the code without actually performing any actions
- wrap classes around functions
- access helper functions as method calls
- isolate side-effects into access functions

## Avoid surprises.  Write tests.
- all functionality
- all options
- error handling
- expose classes, methods, and function to the unit tests
- expose internal helper functions too
  - add them as class methods, or add a .getTestInspector() method to return them
- expose helper classes
- write small, focused functions that are easier to thoroughly test
- pass in ("inject") dependencies to classes and functions, and test with mocks
- 80% unit tests (modules), 20% integration tests (coupling)

## test function libraries too
- do not assume that third-party libraries will not change.  Test the required invariants.
