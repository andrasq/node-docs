Benchmarking With Qtimeit
=========================


Qtimeit is a very easy to use utility for accurately benchmarking nodejs code and
language features.  It measures just the test code, not the test loop or the call to
the test function itself.

## Overview

### qtimeit()

Qtimeit takes an iteration count and a function, runs the function count times, and
prints timing stats about the runs.

    var qtimeit = require('qtimeit');
    var x;
    qtimeit(10000000; function(){
        x = new Array(); for (var i=0; i<3; i++) x.push(i);
    })

prints

    "function (){
        x = new Array(); for (var i=0; i<3; i++) x.push(i);
    }": 10000000 loops in 0.1259 of 0.20 sec: 79414906.81 / sec, 0.000013 ms each

The results are fairly repeatable (though the nodejs variability is as much as 5-6%
from run to run; here one outlier changes 2% to 9.5%):

    10000000 loops in 0.1264 of 0.20 sec: 79086399.40 / sec, 0.000013 ms each
    10000000 loops in 0.1277 of 0.20 sec: 78309083.20 / sec, 0.000013 ms each
    10000000 loops in 0.1255 of 0.20 sec: 79696541.60 / sec, 0.000013 ms each
    10000000 loops in 0.1374 of 0.21 sec: 72785781.86 / sec, 0.000014 ms each
    10000000 loops in 0.1255 of 0.20 sec: 79706300.18 / sec, 0.000013 ms each
    10000000 loops in 0.1252 of 0.20 sec: 79874822.56 / sec, 0.000013 ms each
    10000000 loops in 0.1258 of 0.20 sec: 79465720.53 / sec, 0.000013 ms each

The timer is sensitive enough to measure small variations in the code:

    "function(){
        x = new Array(); for (var i=1; i<=3; i++) x.push(i);
    }": 10000000 loops in 0.1280 of 0.20 sec: 78097783.17 / sec, 0.000013 ms each

    "function (){
        x = new Array(); for (var i=0; i<4; i++) x.push(i);
    }": 10000000 loops in 0.1438 of 0.21 sec: 69520599.62 / sec, 0.000014 ms each

    "function (){
        x = new Array(1, 2, 3);
    }": 10000000 loops in 0.1945 of 0.26 sec: 51423909.66 / sec, 0.000019 ms each

    "function (){
        x = [1, 2, 3];
    }": 10000000 loops in 0.0578 of 0.13 sec: 172954896.95 / sec, 0.000006 ms each

Looks like there may be a slight difference between `<` and `<=` as the loop test, a much
larger difference looping over an extra array element, a large speed penalty to passing the
array elements to the constructor, and a huge 3x speed advantage to creating static
arrays.  (For clarity, here I omitted the separate test source listing, since the test
results include the function body.)

The test can be looped by time instead of loop count, just specify a non-integer
loop count and it will run for that many seconds:

    qtimeit(1.5, function(){
        x = new Array(); for (var i=0; i<3; i++) x.push(i);
    })

    "function (){
        x = new Array(); for (var i=0; i<3; i++) x.push(i);
    }": 69500928 loops in 0.9766 of 1.50 sec: 71168631.45 / sec, 0.000014 ms each

(Note that the rate reported is 11% off the rate obtained by loop count; see the section
Todo below.)

### qtimeit(cb)

Qtimeit can also loop over test functions that take a callback, just call the callback
from each test and pass a callback argument to `qtimeit` itself.  The results should
be the same:

    qtimeit(10000000, function(cb){
        x = new Array(); for (var i=0; i<3; i++) x.push(i);
        cb();
    }, function() {
        console.log("Done.");
    })

prints

    "function (cb){
        x = new Array(); for (var i=0; i<3; i++) x.push(i);
        cb();
    }": 10000000 loops in 0.1298 of 0.39 sec: 77023823.45 / sec, 0.000013 ms each
    Done.

Note that the callback didn't have to be wrappered in `setImmediate(cb)` or
`process.nextTick(cb)`; qtimeit will not cause the call stack to overflow.
(This reported rate is 3% off the callback-less result; see Todo below.)


### qtimeit.bench()

Running a benchmark comparing several tests is easy with the `qtimeit.bench` function.
It takes an array of test functions (or an object with test function properties), runs
each one in turn, and reports absolute timings and relative rankings.

    qtimeit.bench.timeGoal = 0.4;
    qtimeit.bench.visualize = true;
    qtimeit.bench({
        'push 3': function(){
            x = new Array(); for (var i=1; i<=3; i++) x.push(i);
        },
        'push 4': function (){
            x = new Array(); for (var i=0; i<4; i++) x.push(i);
        },
        'new (1,2,3)': function (){
            x = new Array(1, 2, 3);
        },
        'static [1,2,3]': function (){
            x = [1, 2, 3];
        },
    });

prints

    qtimeit=0.18.2 node=6.10.2 v8=5.1.281.98 platform=linux kernel=3.16.0-4-amd64 up_threshold=11
    arch=ia32 mhz=4419 cpuCount=8 cpu="Intel(R) Core(TM) i7-6700K CPU @ 4.00GHz"
    name                   speed         (stats)                                                      rate
    push 3            79,289,937 ops/sec (5 runs of 5m calls in 0.315 out of 0.645 sec, +/- 0.09%)    1000 >>>>>
    push 4            70,653,269 ops/sec (4 runs of 5m calls in 0.283 out of 0.441 sec, +/- 0.05%)     891 >>>>
    new (1,2,3)       54,623,890 ops/sec (4 runs of 5m calls in 0.366 out of 0.526 sec, +/- 0.14%)     689 >>>
    static [1,2,3]   179,083,426 ops/sec (4 runs of 10m calls in 0.223 out of 0.531 sec, +/- 0.24%)   2259 >>>>>>>>>>>

The comparison includes the measured execution speed (expressed as a rate, calls to
the test function per second), stats about each run, and the relative rate of each test
compared to the rate of the first test run.

The reported times are roughly the same as when run by count; the differences are
partly due to `bench` internals (a work in progress, see Todo below) and partly
possibly to heap effects since the heap contents are affected by the prior tests.

Bench, too, accepts an optional callback:

    qtimeit.bench.timeGoal = 0.4;
    qtimeit.bench.visualize = true;
    qtimeit.bench({
        'push 3': function(cb){
            x = new Array(); for (var i=1; i<=3; i++) x.push(i);
            cb();
        },
        'push 4': function (cb){
            x = new Array(); for (var i=0; i<4; i++) x.push(i);
            cb();
        },
        'new (1,2,3)': function (cb){
            x = new Array(1, 2, 3);
            cb();
        },
        'static [1,2,3]': function (cb){
            x = [1, 2, 3];
            cb();
        },
    }, function() {
        console.log("Done.");
    });

producing

    qtimeit=0.18.2 node=6.10.2 v8=5.1.281.98 platform=linux kernel=3.16.0-4-amd64 up_threshold=11
    arch=ia32 mhz=4416 cpuCount=8 cpu="Intel(R) Core(TM) i7-6700K CPU @ 4.00GHz"
    name                   speed         (stats)                                                       rate
    push 3            73,011,919 ops/sec (1 runs of 20m calls in 0.274 out of 2.294 sec, +/- 0.00%)    1000 >>>>>
    push 4            63,744,881 ops/sec (1 runs of 20m calls in 0.314 out of 2.202 sec, +/- 0.00%)     873 >>>>
    new (1,2,3)       87,625,287 ops/sec (1 runs of 20m calls in 0.228 out of 2.084 sec, +/- 0.00%)    1200 >>>>>>
    static [1,2,3]   153,191,502 ops/sec (1 runs of 20m calls in 0.131 out of 1.959 sec, +/- 0.00%)    2098 >>>>>>>>>>
    Done.

A few observations here:  The target time was 0.4 seconds, but actual time was over 2
-- the difference is due to the pre-test calibration done to figure out how many calls
to make in each run of the test loop.  And some of the results look identical, others
look very different.

To spot-check the times, doubling the work done by each test function (by creating two
arrays, like last time),

    qtimeit=0.18.2 node=6.10.2 v8=5.1.281.98 platform=linux kernel=3.16.0-4-amd64 up_threshold=11
    arch=ia32 mhz=4417 cpuCount=8 cpu="Intel(R) Core(TM) i7-6700K CPU @ 4.00GHz"
    name                   speed         (stats)                                                      rate
    push 3            37,425,468 ops/sec (2 runs of 4m calls in 0.214 out of 1.570 sec, +/- 0.18%)    1000 >>>>>
    push 4            32,542,020 ops/sec (2 runs of 4m calls in 0.246 out of 1.463 sec, +/- 0.09%)     870 >>>>
    new (1,2,3)       43,896,646 ops/sec (2 runs of 4m calls in 0.182 out of 1.386 sec, +/- 0.12%)    1173 >>>>>>
    static [1,2,3]    88,439,331 ops/sec (1 runs of 20m calls in 0.226 out of 2.093 sec, +/- 0.00%)   2363 >>>>>>>>>>>>
    Done.

The static array creation speed is back to what it was without a callback, but passing
the elements to new Array is still much faster than without a callback.

Also note the platform identification above the test results.  This includes the
software versions and operating system settings likely to affect performance,
including the actual measured cpu speed.


## Errors

- cache effects (code size, code layout, cache associativity, function length and num bytes)
- heap effects (free objects, gc)
- implementation differences, calibration accuracy
- run-to-run variability (gc)
- calibration measures the overhead to subtract from timing runs, but the run-to-run
  variability in the overhead can have a disproportionate effect in the reported results
  for small functions
- optimization: invariant code motion
- optimization: dead code elimination


## Accuracy

How can we know that these numbers correspond to reality?

Without knowing the true time taken for a test, we can still expect that doubling the
work done should double the runtime.  So we'll create two identical arrays, or maybe
three:

    "function (){
        x = new Array(); for (var i=0; i<3; i++) x.push(i);
        y = new Array(); for (var i=0; i<3; i++) y.push(i);
    }": 10000000 loops in 0.2530 of 0.32 sec: 39529995.11 / sec, 0.000025 ms each

    "function (){
        x = new Array(); for (var i=0; i<3; i++) x.push(i);
        y = new Array(); for (var i=0; i<3; i++) y.push(i);
        z = new Array(); for (var i=0; i<3; i++) z.push(i);
    }": 10000000 loops in 0.3836 of 0.45 sec: 26067722.86 / sec, 0.000038 ms each


39.5 million loops / second is 79.0 million arrays built / sec, which is within 0.5%
of the expected 79.4 million / sec from our first test.  26.1 mill/sec for 3 is 78.3
mill arrays/sec, within 1.5%.  For operations taking tens of nanoseconds or more,
qtimeit has accounted well for the loop overhead.

For operations taking only 5 ns, it is within 12%:

    "function (){
        x = [1,2,3];
    }": 10000000 loops in 0.0578 of 0.13 sec: 173084021.45 / sec, 0.000006 ms each

    "function (){
        x = [1,2,3];
        y = [4,5,6];
    }": 10000000 loops in 0.1052 of 0.18 sec: 95014200.45 / sec, 0.000011 ms each

    "function (){
        x = [1,2,3];
        y = [4,5,6];
        z = [7,8,9];
    }": 10000000 loops in 0.1550 of 0.23 sec: 64509668.93 / sec, 0.000016 ms each


## Todo

Areas that could use some TLC:

- current calibration is too slow, should abort the loop instead
- `bench()`, especially bench with callback, does not fully agree with `qtimeit()`
- calibrated runs are less repeatable than counted runs
- calibration errors have a disproportionately large effect on small functions
