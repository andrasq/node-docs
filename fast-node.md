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

Notes

- for speed-critical loops, copy out variables used in the loop into the
  local scope.  `list[i]` is faster to access than `self.list[i]`
- define functions outside loops
- closures that bind local scope variables seem to run faster than
  closures that bind global variables
- binding variables with a closure is comparable in speed to (slightly
  faster than) passing function parameters.  Which is actually faster
  varies; if it matters, time it

- do not pass `arguments` to other functions, it disables optimization.
  (It is safe to do, though; in node-v0.10.29 it does not leak memory)
- do not `try / catch` in tight inner loops, it disables optimization
- do not build closures in tight inner loops, some closures are expensive
  to construct

### Arrays

Node arrays are blazing fast.  They can be accessed and traversed at a
hundred million elements per second and grown at dozens of millions of
elements per second.

Notes

- array.length can be assigned, it shortens the array but does not free memory
- assigning `array.slice()` frees memory, but runs slower than setting length

- iterate arrays from 0 to length
- push, do not append by index, it's 2x faster
- do not preallocate large arrays, growing them on demand is 2x faster
- allocate arrays meant to grow with new Array().  push() into a `new Array`
  is 3x faster than into `[]`.
- if speed is important, test a local copy of `.length`, it's 10% faster.

- avoid sparse arrays
- avoid iterating arrays with for (i in array)


### Objects

There are two kids of node objects, structs and hashes.  The two are
indistinguishable.  Structs have a static layout and are faster to access.
Node can convert back and forth between the two:  adding/deleting fields to
structs can downgrade them to a hash, and assigning a hash to a function's
prototype upgrades it to a struct (this is the `toFastProperties()` trick used
in the Bluebird promises package).

Node objects are ok fast, but not blazing fast and not very fast.  Ok
fast.  The can be accessed very fast, but adding properties is only 2ms,
deleting properties is 1.5m/s.  In some cases, deleting properties
enters a pessimal condition and runs at just thousands per second.

Notes

- create a struct with `x = {a: 1, b: 2, c: 3};`
- create a hash with `x = {}; x.a = 1; x.b = 2; x.c = 3;`
- setting new properties p on `x = {}` objects is slower
- setting pre-declared properties p on `x = {p: null}` is faster
- objects created with `new` get their instance properties struct-ized,
  both those inherited and those set with `this.property = value`
- it is faster to test properties for truthy/falsy than for value
- it is faster to set a property to a number or string than to `null` or `undefined`

- beware the node-v0.10.29 delete anomaly:  the below code runs 100x slower if
  the key strings do not exist elsewhere.  Instead of .046 seconds, it's 4.65
  sec of 100% cpu usage.  Could be global string reuse and gc thrashing, but
  not sure.  (node-v0.11 does not have this issue)

        keys = [];
        // comment in the next line to have node-v0.10.29 run 100x faster:
        //for (i=0; i<100000; i++) keys[i] = i + "";
        x = {};
        for (i=0; i<100000; i++) x[i] = i;
        for (i=0; i<100000; i++) delete x[i];


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
