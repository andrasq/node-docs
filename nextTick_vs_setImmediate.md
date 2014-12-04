On the Difference Between nextTick() and setImmediate()
=======================================================

2014-11-05 - AR.

`setImmediate()` appends a continuable (function) to the event queue,
which will run when the event loop gets to it.  This is a normal
continuable, it waits its turn and incurs the event loop scheduling
overhead (setImmediate is much slower than nextTick:  700k/s v0.10.29,
400k/s v0.11.13).

`process.nextTick()` arranges for the continuable (function) to be called as soon
as the current continuable finishes, before the event loop scheduler
runs.  nextTick is just a delayed function call, it is not queued and
scheduled.  nextTick functions are blocking (they do not allow others to
run first), and recursive calls to nextTick will exhaust the call stack
and crash.  However, nextTick bypasses the event loop overhead, and is
much faster than setImmediate (7.5m/s v0.10.29; 2.5m/s v0.11.13).


### On the Speed of Node Continuations

- Node v0.11 (v0.11.13) allows recursive nextTick calls without warnings or crashing.

- However, v0.11 runs setImmediate much slower, only 370k calls / sec vs
  v0.s 650k / sec.  This is on physical hardware; s run at half to a
  quarter this speed.

- setImmediate of a function (ie, `setImmediate(func)`) is slower than
  that of an inline function `setImmediate( function(){ func()) } )`.  This
  was surprising.  May be related to scoping (global vs local) or the way the
  closure is built.

- on the same topic, inline functions and objects are very very fast in
  nodejs, and can be used without thought to overhead.

- passing a function argument to setImmediate (ie, setImmediate(func, arg))
  is much much slower than writing an in-line closure to invoke func(arg)
  (10x in v0.10, 650k/s inline, 67k/s w/ arg).  Node v0.11 narrows the gap
  to 4x, but that's not an improvement but rather a drop in the peak (377k/s
  inline, 100k/s w/ arg).  Though v0.11 is less bad than v0.10 at queueing
  arguments, it is still much faster to use in-lines.

- node v0.11 (v0.11.13) is much slower at queueing and invoking continuables
  than v0.10 was (v0.10 was 650k/sec, down to 377k/sec v0.11)


### Conclusions

- plain function calls are very fast (100 m/s, very fast for an interpreted language)

- nextTick function calls are fast (5 m/s)

- the event loop is slow-ish (650 k/s v0.10, 377 k/s v0.11)

- setImmediate of a function and argument is slow (67 k/s v0.10, 260k/s v0.11)

- different versions of node do not all run at the same speed

