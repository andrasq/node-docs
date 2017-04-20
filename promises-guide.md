# Promises -- A Quick Reference Guide

A promise can be thought of as an `(error, value)` callback wrapped in a closure.
The closure can notify when the value becomes available, or can share the already
returned value, kind of like an event emitter with a memory.


## States

A promise exists in one of three states:  _pending_, _resolved_, _settled_, and
transitions between them with _create_, _fulfill_, _reject_, _resolve_ and _settle_.

States:

- `pending` A newy created promise is pending. A pending promise has no value
   associated with it yet, nor a source for the value; its fate is undetermined.

- `resolved` A resolved promise has no value yet, but is committed to receiving the
   value from another, the resolving, promise.  If the resolving promise fulfills,
   this promise will fulfill with the same value.  If the resolving promise rejects,
   this promise will reject with the same reason.

- `settled` The promise has taken on a final state and value that will never change.
   The settled state can be either `fulfilled` with a value or `rejected` with a
   reason; the two are mutually exclusive.  The state and value / reason can be
   queried with then `then()` method.

- `fulfilled` - settled with a fulfillment value

- `rejected` - settled with a rejection reason

Transitions:

- `create` A new promise is created in the `pending` state

- `fulfill` Settle the promise with a fulfillment value in the terminal state "resolved"

- `reject` Settle the promise with a rejection reason in the terminal state "rejected"

- `resolve` When resolved, the promise commits to taking on the state and value
   (or eventual state and value) of another promise or thenable.  Once resolved,
   subsequent attempts resolve or settle it will be ignored, with the exception of
   the resolving promise itself.  It is possible to resolve with a promise multiple
   times before settling.

- `settle` When settled, the promise enters a terminal state, either `fulfilled` with
   a value value or `rejected` with a reason.  Once settled, the promise will not
   change its state, value or reason, and subsequent attempts to resolve, fulfill or
   reject it will be ignored.

        (create)
           |
           |
           V
      [ PENDING ] ----> (resolve) <--+
           |               |          \
           |               |          |
           V               V          /
        (settle) <--- [ RESOLVED ] --+
           |
           |
           V
     [ FULFILLED ]
     [ REJECTED ]


## Methods

### new Promise( executor(resolve, reject) )

Creates a new promise resolved or settled to the value returned by the executor
with the resolve / reject functions.  If `resolve` returns a value (not a promise
or a thenable) or `reject` returns anything, the new promise will immediately
settle, fulfill with value or reject with reason.  If resolve returns a promise or
a thenable, the new promise will resolve and will take on the value of the returned
promise as soon as it settles.  `new Promise` can return either a `pending`, a
`resolved` or a `settled` (`fulfilled` or `rejected`) promise, depending on what
the executor initializes it with.

### P.resolve( value )

Creates a new promise initialized to value, equivalent to `new
Promise(function(resolve, reject) { resolve(value) })`.  The new promise may be
`pending`, `resolved` or `settled` (`fulfilled` or `rejected`).

### P.reject( reason )

Creates a new promise already rejected with reason, equivalent to `new
Promise(function(resolve, reject) { reject(reason) })`.  The new promise is
`settled` (`rejected`).

### promise.then( resolveHandler, rejectHandler )

Creates a new promise that will take on the state returned by the handler function.
The handler is be called when the thenable promise settles, until then the promise
is `pending`.  If the thenable promise has already settled, the handler is called
immediately.  The handler is called as a function, from the system call stack.  If
the thenable promise fulfills with value, `resolveHandler(value)` will be called;
if the thenable rejects with a reson, `rejectHandler(reason)` will be called.  In
both cases, the handler's return value (including undefined) will be used to settle
or resolve the new promise.  Note that the new promise is always fulfilled,
independent of whether the thenable promise rejected or fulfilled; the only time
the new promise rejects is if the handler throws; in that case the new promise will
reject with the thrown value as the reject reason.


## Thenables

A "thenable" is any object with a method `then` whose behavior is compatible with the
promise system's.  The promise can settle with the value of a thenable by by calling
the theanable's `then` method; `then` must call one of the handlers to fulfill with a
value, reject with a reason, or resolve with another promise or thenable.
