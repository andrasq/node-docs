On Writing Fast Nodejs Code
===========================

This is a rambling collection of thoughts on writing fast nodejs programs.

The Language
------------

Some nodejs primitives are very fast.  Some not so much.

### Functions

Nodejs functions are blazing fast, both static function bodies and many
in-line closures.

The v8 javascript engine compiles code on the fly.  Additionally,
frequently run functions will get optimized on the fly.

However, some code constructs prevent optimization, so do not use them
in critical inner loops.  In many cases it is faster to call a one-line
function than to disable optimization for the loop.  Two in particular
that disable optimization are `try/catch` and `arguments`.

Do

- for speed-critical loops, copy out variables used in the loop into the
  local scope.  `list[i]` is faster to access than `self.list[i]`
- define functions outside loops
- closures that bind local scope variables seem to run faster than
  closures that bind global variables
- binding variables with a closure is comparable in speed to (slightly
  faster than) passing function parameters.  Which is actually faster
  varies; if it matters, time it

Avoid

- do not pass `arguments` to other functions, it disables optimization.
  (It is safe to do, though; in node-v0.10.29 it does not leak memory)
- do not `try / catch` in tight inner loops, it disables optimization
- do not build closures in tight inner loops, some closures are expensive
  to construct

### Arrays

Node arrays are blazing fast.  They can be accessed and traversed at a
hundred million elements per second and grown at dozens of millions of
elements per second.

Do

- iterate arrays from 0 to length
- allocate arrays meant to grow with new Array().  `x = []; x.push()` is
  3x slower than `x = new Array(); x.push(1);`

Avoid

- sparse arrays
- iterating arrays with for (i in array)


### Objects

There are two kids of node objects, structs and hashes.  The two are
indistinguishable, but structs are much faster to access.

Node objects are ok fast, but not blazing fast and not very fast.  Ok
fast.  The can be accessed very fast, but adding properties is only 2ms,
deleting properties is 1.5m/s.  In some cases, deleting properties
enters a pessimal condition and runs at just thousands per second.

Avoid

- node is very slow at iterating objects with `for (key in object)`.  Accessing

### JSON

Counter-intuitively, JSON.stringify and JSON.parse are surprisingly slow.
Stringifying objects for logging (500 byte strings) runs at about 130k/s, much
slower than logging itself and as much as 20% of the total app call time.

This is unfortunate, as JSON is the natural JavaScript data exchange format,
and having it be a bottleneck is inconvenient.  For simple data logging,
space-delimited text is a much faster output format to generate.

### Native OS Calls

Part of the reason JSON is slow is that creating native data items in
C++ is slow.  Node can make calls into the operating system at a rate of
10m/s.  It can retrieve a single number at 6m/s.  It can retrieve a hash
of 16 numbers at 150k/s:  the hash, each hash key (property name) and
each returned value has to be created as an appropriate v8 object.

In fact, it is 50% faster (220k/s) to return a CSV name=value string and
unpack it in javascript than to build the hash in C++.  And it is 3x
faster (440k/s) to return just an array of values in a well-defined
order and build the struct in javascript than to return names as well.


Do

- write C++ plugins with narrow interfaces to access system functions
  (time, resource usage)

Avoid

- do not believe that moving the code into C++ will make it faster.  It
  won't -- node is very fast, and crossing the C++/nodejs boundary is
  slow.
