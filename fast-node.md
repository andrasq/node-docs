On Writing Fast Nodejs Code
===========================

2015-01-19 - AR.

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
  varies; if it's important, time it

- do not pass `arguments` to other functions, it disables optimization.
  This includes the often seen `Array.prototype.slice.call(arguments, 0)`.
  (It is safe to do, though; in node-v0.10.29 it does not leak memory)
- do not `try / catch` in tight inner loops, it disables optimization
- do not build closures in tight inner loops, some closures are expensive
  to construct

### Strings

WRITEME: ...

Notes

- testing "foo".charCodeAt(0) is faster than testing "foo"[0]
- strings are at no slower than Buffer, sometimes faster
- ...

### Arrays

Node arrays are blazing fast.  They can be accessed and traversed at a
hundred million elements per second and grown at dozens of millions of
elements per second.

Notes

- array.length can be assigned, it shortens the array but does not free memory
- assigning `array.slice()` frees memory, but runs slower than setting length

- iterate arrays from 0 to length
- push, do not append by index, it's 2x faster
- do not access undefined elements past the end of the array
- do not preallocate large arrays, growing them on demand is 2x faster
- allocate arrays meant to grow with new Array().  push() into a `new Array`
  is 3x faster than into `[]`.
- if speed is important, test a local copy of `.length`, it's 10% faster.
- avoid iterating arrays with for (i in array)
- node arrays are laid out as a contiguous vector of pointers.  This means
  - indexed array lookups are very very fast
  - sparse arrays still allocate space for the holes (value `undefined`)
  - shift/unshift must move all the element to keep the head at index `[0]`
- operating on the tail of the array (push/pop) is faster than on the head
  (shift/unshift)
- small arrays (vector storage size of less than 1MB) are optimized and the
  array operations `unshift, shift, push, pop` are implemented with base/bound
  pointer updates, making shift also fast
- shifting large arrays (over 100k items) is very very _very_ slow.  V8 not
  only does the necessary memory copy, but it then seems to apply a
  generational garbage collection step to every element of the array, even
  though none of them were touched.  Node-v0.11 and iojs do not exhibit this
  behavior.

        a = [];
        for (i=0; i<150000; i++) a[i] = i;
        for (i=0; i<1000; i++) a.shift();
        // 500 shifts / second
        // change the 150k to 100k to run 40,000x faster, 20m shifts/sec:

### Objects

There are two kids of node objects, structs and hashes.  The two are
indistinguishable.  Structs have a static layout, hashes are dynamic.  Node
can convert back and forth between the two:  adding/deleting fields to structs
can downgrade them to a hash, and assigning a hash to a function's prototype
upgrades it to a struct (this is the `toFastProperties()` trick used in the
Bluebird promises package).

Node structs are blazing fast.  Accessing struct properties is via a direct
map, without requiring hashing.  Struct properties (and new object `this`
fields and inherited methods) are very fast to access.

Node hashes are prety fast, but much slower than strucst.  Adding elements to
a hash runs at 20m/s, deleting them at 4m/s.  Note that with node-v0.10 in
some cases deleting properties can enter a pessimal state and run at just
thousands per second.

Notes

- create a struct with `x = {a: 1, b: 2, c: 3};`
- create a hash with `x = {}; x.a = 1; x.b = 2; x.c = 3;`
- setting new properties p on `x = {}; x.p` is slower
- setting pre-declared properties p on `x = {p: null}; x.p` is faster
- objects created with `new` get their instance properties struct-ized,
  both those inherited and those set with `this.property = value`
- it is faster to test properties for truthy/falsy than for value
- it is faster to set a property to a number or string than to `null` or `undefined`
- iterating hash keys with `for (key in hash)` is slow.  At 4-10m keys/s,
  it's slower than inserts (16m/s) or deletes (8m/s).
- operations on small hashes (25k entries or so) seem to be optimized, and
  element inserts/deletes run much faster than on larger hashes.

- beware the node-v0.10.29 delete anomaly:  deleting can be amazingly slow,
  depending on current memory usage and garbage collection state.  Small
  changes to memory usage make a huge difference to runtimes (node-v0.11 and
  iojs do not exhibit this issue, but node-v0.11 and iojs are 25-40% slower
  accessing hashes in general)

        // enable the next line to have node-v0.10.29 run 100x faster:
        // keys = []; for (i=0; i<4000; i++) keys[i] = i;
        x = {};         // or x = [];
        for (i=0; i<100000; i++) x[i] = i;
        for (i=0; i<100000; i++) delete x[i];
        // 21k deletes / second

### Events

Event listeners are just registered callbacks, and emitting events is just a
function call.  They are fast.

... WRITEME

### JSON

Counter-intuitively, JSON.stringify and JSON.parse are surprisingly slow.
Stringifying objects for logging (500 byte strings) runs at about 130k/s, much
slower than logging itself and as much as 20% of the total app call time.

The slowness seems to roughly correspond to the relatively slow `for
(propertyName in object)` property iteration rate.

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

Notes

- write C++ plugins with narrow interfaces to access system functions
  (time, resource usage)
- do not believe that moving the code into C++ will make it faster.  It
  won't -- node is very fast, and crossing the C++/nodejs boundary is
  slow.


The Builtins
------------

Many nodejs built-ins are suboptimal, and can be improved upon.

### setImmediate

The node-v0.10.29 setImmediate call suffers from many of the performance
bottlenecks outlined under Objects, above, and loses more than half its
potential speed because of it.  Node-v0.11 reimplements the functionality,
but v0.11.13 is slower overall on setImmediate than v0.10.29.

Accessing event loop from inside node is kind of slow.  v0.10.29 can launch
2.5 million events / second; v0.11.13 can launch 1 million.  Since each
setTimeout, each continuation, each i/o action queues an event, that can cap
throughput at 1 million continuations / second.  In practice, the default node
setTimeout and setImmediate functions limit this even more.

All i/o events and default node setTimeout callbacks go through the event
loop.  The default setTimeout creates a new event for each timeout time, which
limits the rate at which timeouts can be created and run.

Notes

- See [qtimers](https://www.npmjs.org/package/qtimers) for a 10x faster
  drop-in replacement.
- node-v0.12 and iojs-1.0.1 are slow like v0.11, both much slower than v0.10,
  seemingly because of internal v8 changes.

### Http.Agent

Connection reuse in http.Agent (an internal part of http.request) is kind of
broken, and consequently slow.  Fixed in iojs-1.0.1 and node-v0.12.

Notes

- connections are only reused if a second call to the same url is already
  waiting.  Consecutive calls, even back-to-back, each open a new connection.
  - thus lots of sockets enter a 60-second TIME_WAIT state during which they can
    not be used, leaking a scarce system resource
  - thus the per-connection http.request call rate per is 1/3 of what it could
    be (2k/sec instead of 6.5k/s)
  - thus increasing the maxSockets limit can result in lower call throughput
    (because maxSockets limits currently open connections.  By allowing more
    connections, there will be fewer queued, and only queued connections get
    to reuse an open connection.)
- each socket opened is placed on a multi-level list, without it being used or
  needed in the future.  This is unnecessary overhead.
- the maxSockets option is a per-url limit, not a connection pool limit.
  There is no upper bound on the total connection pool size.  With the default
  limit of 5, with 10 different urls accessed, means 50 sockets can be held
  open concurrently.
- See [agentkeepalive](http://www.npmjs.org/package/agentkeepalive) for a
  drop-in replacement agent that correctly implements connection reuse.

### File I/O

Notes

- node file and stream `read` and `write` pass through to the underlying
operating system.  Writing many small items runs much faster if combined in
node into bigger chunks and written with fewer calls.
- use line-oriented batching file readers / writers like
[qfgets](https://npmjs.org/package/qfgets) and
[qfputs](https://npmjs.org/package/qfputs).

The Achilles Heels
------------------

As currently implemented, some parts of nodejs are inherent bottlenecks to
high performance.

- iterating over hash keys (traversing objects) is comparatively slow (10m
  keys/s), and this affects any code that has to process hash contents, eg
  Object.keys() and JSON.stringify()

- obtaining hash keys is slow even if not iterated; breaking out of the loop
  on the first key is not much faster than looping through all of them.  The
  cost is in getting the keys list, not in iterating

- input/output of node objects is slow, because JSON.stringify() is slow (4m
  fields/sec), ultimately because iterating objects is slow

- the event loop is slow, about 1m events queued per second with
  `process.binding('timer_wrap').Timer` and 0.7m - 2.4m timer events run per
  second.  This for node-v0.10.29; node v0.11.13 and iojs are even slower.

- building node objects in C++ is slower than in node javascript, so there is
  little hope for more efficient implementations using compiled C++ packages.

- passing objects to helper processes requires serialization, which is slow
  because JSON.stringify is slow

You can't win.  You can't break even.  You can't even quit the game.

Admittedly, these limits are theoretical for most applications, most of which
are running at 3 or 4 orders of magnitude slower.

However, apps designed for speed can quickly start running into these limits.
A real-life example:  a service fielding 4000 calls per second and logging a
50-field JSON object with each call was found to be spending 20% of its
runtime, 0.2 sec of every second, in JSON.stringify.  We can speed up the
service, but at 10,000 calls per second it will be spending half its time JSON
encoding.  That's an inherent bottleneck.
