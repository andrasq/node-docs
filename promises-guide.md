# Promises -- A Quick Reference Guide

A promise can be thought of as an `(error, value)` callback wrapped in a closure.
The closure can notify when the value becomes available, or can share the already
returned value, kind of like an event emitter with a memory.


## States

A promise exists in one of two states:  _pending_ or _settled_, each having two
sub-states:  pending _unresolved_ or _resolved_, and settled _fulfilled_ or
_rejected_.  The state transitions are _create_, _resolve_, _fulfill_ and _reject_.

States:

- `pending` A newy created promise is `pending`. A pending promise has no value
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
   queried with then `then()` method.  This is a permanent state; once settled
   no other state changes should occur.

- `fulfilled` - settled with a fulfillment value

- `rejected` - settled with a rejection reason

Transitions:

- `create` A new promise is created in the `pending` state

- `fulfill` Settle the promise with a fulfillment value into the terminal state "fulfilled"

- `reject` Settle the promise with a rejection reason into the terminal state "rejected"

- `resolve` When resolved, the promise commits to taking on the state and value
   (or eventual state and value) of another promise or thenable.  Once resolved,
   subsequent attempts resolve or settle it will be ignored, with the exception of
   the resolving promise itself.  It is possible to resolve with a promise multiple
   times before settling.

             create
               |
               V
          [ PENDING ] --------> resolve <----+
               |                   |         |
               V                   V         |
        fulfill / reject <--- [ RESOLVED ] --+
               |
               V
          [ FULFILLED ]
          [ REJECTED ]


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
or `reject`, the new promise rejects with the thrown error as the reason.

### P.resolve( value )

Creates a new promise initialized to value, equivalent to `new
Promise(function(resolve, reject) { resolve(value); })`.  The returned promise may
be `pending`, `resolved` or `settled` (`fulfilled`).

### P.reject( reason )

Creates a new promise already rejected with reason, equivalent to `new
Promise(function(resolve, reject) { reject(reason); })`.  The returned promise is
`settled` (`rejected`).

### promise.then( resolveHandler, rejectHandler )

Creates a new promise that will fulfill with the value returned by the handler
function.  The handler is called once the thenable promise settles, until then the new
promise remains `pending`.  The handler is called as a function, from the system call
stack.  If the thenable promise fulfilled with value, `resolveHandler(value)` is
called; if the thenable rejected with a reson, `rejectHandler(reason)` is called.  In
both cases, the new promise will fulfill or resolve with the return value of the
handler function (including undefined).  Note that the new promise is always
_fulfilled_, even when the thenable promise rejects; the only time the new promise
rejects is if the handler throws.  If the handler throws (`resolveHandler` or
`rejectHandler`, whichever was called), the new promise rejects with the thrown value
used as the reason.


## Thenables

A "thenable" is any object with a method `then` whose behavior is compatible with the
promise system's.  The promise can settle with the value of a thenable by by calling
the theanable's `then` method; `then` must call one of the handlers to fulfill with a
value, reject with a reason, or resolve with another promise or thenable.
