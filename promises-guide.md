# Promises -- A Quick Reference Guide

A promise can be thought of as an `(error, value)` callback wrapped in a closure.
The closure can notify when the value becomes available, or can share the already
returned value, kind of like an event emitter with a memory.

Promises can be chained to percolate values or propagate state (typically for
resolve and reject, respectively).

## States

A promise exists in one of two states:  _pending_ or _settled_, each having two
sub-states:  pending _unresolved_ or _resolved_, and settled _fulfilled_ or
_rejected_.  The state transitions are _create_, _resolve_, _fulfill_ and _reject_.

States:

- `pending` A newly created promise is `pending`. A pending promise has no value
   associated with it yet, and is unresolved (no source is known for the value); its
   fate is undetermined.  This is a transitional state until the promise is resolved
   or settled.

- `resolved` Pending with no value yet, but committed to receiving the value from
   another (the resolving) promise / thenable.  If the resolving promise fulfills,
   this promise will fulfill with the same value.  If the resolving promise rejects,
   this promise will reject with the same reason.  This is a transitional state until
   the resolving promise settles.  The resolving promise may itself resolve with
   another promise, re-entering the `resolved` state waiting on a new resolving
   promise.

- `settled` The promise has taken on a final state and value that will never change.
   The settled state can be either `fulfilled` with a value or `rejected` with a
   reason; the two are mutually exclusive.  The state and value / reason can be
   queried with the `then()` method.  This is a permanent state; once settled
   no other state changes should occur.

- `fulfilled` - settled with a fulfillment value

- `rejected` - settled with a rejection reason

Transitions:

- `create` A new promise is created in the `pending` state

- `fulfill` Settle the promise with a fulfillment value into the terminal state "fulfilled"

- `reject` Settle the promise with a rejection reason into the terminal state "rejected"

- `resolve` On resolve, the promise `p1` commits to taking on the state and value
   (or eventual state and value) of another promise or thenable `p2`.  Once resolved,
   subsequent attempts to resolve or settle `p1` will be ignored, execpt if by the
   resolving promise `p2` itself. If the resolving promise `p2` resolves with a
   promise `p3`, `p3` becomes the resolving promise whose value will settle `p1`.
   This way it is possible to resolve with a promise multiple times before settling.

             create
               |
               V
          [ PENDING ] --------> resolve <----+
               |                   |         |
               V                   V         |
        fulfill / reject <--- [ RESOLVED ] --+
               |
               V
          [ SETTLED FULFILLED ]
          [ SETTLED REJECTED ]


## Methods

### new Promise( executor(resolve, reject) )

Creates a new promise resolved or settled to the return value of the first one of
the `resolve` or `reject` functions to return.  If `resolve` returns a value (not a
promise or a thenable) the new promise will immediately fulfill with the value; if
`reject` returns a reason, the new promise will immediately reject with the reason.
Undefined counts as a reason.  If `resolve` returns a promise or a thenable, the new
promise will resolve and will take on the value of the returned promise when it
becomes available.  `new Promise` can return either a `pending`, a `resolved` or a
`settled` (`fulfilled` or `rejected`) promise, depending on what the executor
initializes it with.  If the executor throws an error before calling either `resolve`
or `reject`, the new promise rejects with the thrown error as the reason.  If the
executor throws after calling `resolve` or `reject`, or calls them more than once,
the error and/or the second and following calls are ignored.

### P.resolve( value )

Creates a new promise initialized to value, equivalent to `new
Promise(function(resolve, reject) { resolve(value); })`.  The returned promise may
be pending but `resolved` (value was a pending promise), `settled fulfilled` (value
was a constant or a fulfilled promise), or `settled rejected` (value was a rejected
promise).

### P.reject( reason )

Creates a new promise already rejected with reason, equivalent to `new
Promise(function(resolve, reject) { reject(reason); })`.  The returned promise is
`settled` (`rejected`).  Note that `reject()` always rejects:  if rejected with a
fulfilled promise, the promise object will be the rejection reason.

### promise.then( resolveHandler, rejectHandler )

Creates a new promise that will fulfill with the value returned by the handler
function.  The handler is called when the thenable promise settles, until then the
new promise remains `pending`.  The handler is called as a function (`this` unset),
from the system (not application) call stack.

If the thenable promise fulfills with a value, `resolveHandler(value)` is called;
if the thenable rejects with a reson, `rejectHandler(reason)` is called.  In both
cases, the new promise will fulfill / resolve with the value (even `undefined`)
returned by the handler function.  If the appropriate handler was not specified (or
was not a function), the new promise takes on the state and value/reason of the
thenable promise.

Caution: the new promise returned from `then` is _always_ _fulfilled_, even when the
thenable promise rejects; the only time it is rejected is if the handler throws.  If
the called handler throws, the thrown value will be the rejection reason.  So for
example, `Promise.reject("no").then(null, (e) => { return "yes" })` returns a promise
fulfilled with "yes", and `Promise.resolve("yes").then((v) => { throw "no" })` return
a promise rejected with "no".

### promise.catch( rejectHandler )

Same as `promise.then(null, rejectHandler)`: `then` with only the rejectHandler
specified.


## Thenables

A "thenable" is any object with a method `then` whose behavior is compatible with the
promise system's.  The promise can settle with the value of a thenable by by calling
the theanable's `then` method; `then` must call one of the handlers to fulfill with a
value, reject with a reason, or resolve with another promise or thenable.
