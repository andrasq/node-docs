On the Performance of NodeJS Timers
===================================

Stats on the performance of the built-in `setTimeout` et. al. family of calls


What Changed
------------

Looking at the sources, the v5 timers have been completely rewritten, with
`setImmediate` especially benefiting.  In `setImmediate` all the glaringly
inefficient code is gone, replaced with either the obvious alternate, or in some
cases by subtle and clever substitutions.  The new code now shares many elements
in common with `qtimers`.

- timer objects are now structs (not hashes)
- timer callbacks optimize argument passing for up to 3 arguments
- no more array.slice on `arguments`
- try/catch is isolated into a separate function (try/catch prevents optimization)

What didn't change

- timer objects are kept on linked lists (not in an array)
- each distinct timeout is implemented with a built-in C++ TimerWrap object (not a heap)
- callbacks are invoked with `callback.call()` (not `callback()`)
- setTimeout and setInterval still bind to the `arguments` object (prevents optimization)
- if the timeout exceeds TIMEOUT_MAX, it is still set to 1 (not clipped to the max)
- the immediate list is run in its entirety, but not including any new immediates created
- the immediate queue is replaced with a hash whenever immediates are run


The Stats
---------

Measured processing rates (millions of calls / second).  "Qt" is the throughput of
the same operation using `qtimers` instead.

The latest node (tested v5.10.1) is in many cases faster than node-v0.10.42 (but
not all), and the advantage of `qtimers` over native has been greatly reduced.

Between v0.10.42 and v5.10.1, \*\* marks the better of the two.  Note that this is
not always the best.

### Basics

Closures and function calls underlying it all

        function f() { };
        N = null;
                                v0.8.28         v0.10.42        v4.4.0          v5.8.0          v5.10.1

        f(1,2,3)                134             133             370             320             330   **
        f.call(N,1,2,3)         40              40              63              61              62    **
        f.apply(N,[1,2,3])      15              15 **           12              11              11
            (invoke*)           15              23              30              30              30

Node-v5 function calls are much quicker, but `func.apply` is a lot slower.

\* `lib/qinvoke.js` from the `qrpc` package

### Primitives

Primitive timeout operations

                                v0.8.28         v0.10.42        v4.4.0          v5.8.0          v5.10.1

        set/clear timeouts      0.069           0.370 **        0.104           0.108           0.172
        set/clear tmout, 1 arg  0.193           0.202 **        0.105           0.105           0.173
            qt*:                                0.828                                           0.970

        set/clear/run immediate X               0.960           1.39            1.42            1.41  **
            qt:                                 5.16            3.37            3.33            3.35

        setImmediate recursion  1.36            0.692 **        0.476           0.470           0.523
        setImmed recur, 1 arg   1.38            0.269           0.312           0.321           0.331 **
        setImmed recur, 3 args  1.36            0.265           0.316           0.323           0.336 **
            qt.10:                              3.97                                            2.21
            qt.1:                               1.15

        set/run 10k setTimeout  8.06            11.5  **        8.39            7.82            8.89
            qt:                                 27.0                                            33.1
        set/run 10k, 1 arg      0.305           0.397           0.718           0.737           0.801 **
            qt:                                 0.725                                           1.04
        set/run 10k, 3 args     0.290           0.388           0.734           0.733           0.776 **
            qt:                                 0.682                                           0.859

        set/run 10k setImmed+   11              0.980           2.7             2.7             3.0   **
            qt.0:                               6.22                                            3.75
        10k setImmed, 1 arg     10.8            0.31            1.25            1.37            1.39  **
            qt.0:                               3.40                                            2.60
        10k setImmed, 3 args    10.6            0.31            1.27            1.37            1.45  **
            qt.0:                               3.53                                            2.66

\* `qtimers` (v1.4.2 and v1.4.5).  qt.1 sets `setImmediate.maxTickDepth = 1` for
node-v0.10 semantics, qt.0 to `= 0` for node-v5 semantics and qt.10 to `= 10` to
run up to 10 new tasks queued by the immediate tasks themselves.

\+ node before v12 ran only one immediate task per event loop cycle, which hurt its throughput.
Later versions run all queued immediate tasks.  Qtimers is configurable.

As is visible especially from the `setImmediate` results, although the node-5
rewrite improved bulk setImmediate processing, task latency (self-recursion speed)
is slower.  The same sources (qtimers implementation) runs much faster under the
old node-v0.10.  Perhaps a faster library but on a slower engine, or an engine
no longer well matched to short bursts.

### Cpu

Cpu consumption of concurrent `setTimeout` task handling.  Each task re-queues
itself with a delay of 1 ms, and unref()s the created timer so the program can exit
after 10 seconds.


                                                v0.10.42        v4.4.0          v5.8.0          v5.10.1

        10-sec 1ms setTimeout loop              11.6%           9.1%            8.4%            8.3%  **
            qt:                                 10.3%           7.8%            7.6%            7.9%
        10-sec 10x 1ms setTimeout loops         22.9%           20.1%           20.2%           18.1% **
            qt:                                 10.1%           8.4%            8.7%            8.6%
        10-sec 100x 1ms setTimeout loops        >45s @100%      >20s @100%      >20s @100%      47.3% **
                                                (50%, knee @90)                 (50%, knee @95)
            qt:                                 18.4%           16.5%           16.3%           16.0%
        10-sec 200x 1ms setTimeout loops        -               -               -               >35 @100%
            qt:                                 19.2%           16.3%           15.6%           16.6%
            qt 1000x:                           62.2%           54.4%           49.2%           50.0%

`setTimeout` processing is more efficient, but many concurrent `setTimeout`s all
active at the same time are still quite cpu intensive.  In fact, too many active
timeouts will still crush node.


Test Scaffolding
----------------

        var aflow = require('aflow');
        var timeit = require('arlib/timeit');

        function runit( repeats, nruns, nItemsPerRun, name, f, callback ) {
            console.log(name);
            var j = 0;
            var t1, t2, min, max, sum = 0;
            aflow.repeatWhile(
                function() {
                    return j++ < repeats;
                },
                function(next) {
                    t1 = timeit.fptime();
                    timeit(nruns, f, function(err) {
                        var elapsed = timeit.fptime() - t1;
                        sum += elapsed;
                        if (min === undefined || elapsed < min) min = elapsed;
                        if (max === undefined || elapsed > max) max = elapsed;
                        next(err);
                    });
                },
                function(err) {
                    // function call rate, adjusted for the 2 calibration runs made by timeit()
                    var rateMin = nruns * nItemsPerRun / max             * ((nruns + 2) / nruns);
                    var rateMax = nruns * nItemsPerRun / min             * ((nruns + 2) / nruns);
                    var rateAvg = nruns * nItemsPerRun / (sum / repeats) * ((nruns + 2) / nruns);
                    console.log(qprintf.sprintf("item rate min-max-avg %6.4f %6.4f %6.4f", rateMin, rateMax, rateAvg));
                    if (err) throw err;
                    if (callback) callback();
                }
            );
        }
