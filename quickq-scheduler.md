Fair-Share Multi-Tenant Scheduling With Quickq
==============================================
2017-05-17 - Andras.

Quickq is a lean, fast in-memory JavaScript job runner.  Its built-in fair-share
scheduler is a practical and convenient option for adding smarts to job management.


Quickq Overview
---------------

Quickq is very similar to [`async.queue`](https://npmjs.com/package/async).  A job queue
is constructed with a runner and options, jobs are pushed onto the queue, and are
started in arrival order.

    var ncalls = 0;
    function noopJobRunner( jobPayload, callback ) {
        ncalls += 1;
        callback();
    }

    var Quickq = require('quickq');
    var queue = new Quickq(noopJobRunner, 10);
    queue.push({a:1});
    queue.push({a:2});

Note that the `callback()` would need to be wrapped in `setImmediate` for use with
`async.queue` and `fastq`: without it they can overflow the call stack, and
`process.nextTick` would not yield the cpu to the event loop.  The `async.ensureAsync`
function designed for this purpose is slower than `setImmediate`, thus is of no help.
Quickq takes care to efficiently call the callback without overflowing the stack or
slowing the processing loop.


Scheduling
----------

Adding scheduling to quickq is done with a constructor option.

    var queueOptions = {
        concurrency: 10,
        scheduler: 'fair',
        schedulerOptions: {
            maxTypeShare: 0.80,
            maxScanLength: 1000,
        },
    };
    var queue = new Quickq(noopJobRunner, queueOptions);
    queue.pushType('jobtypeA', {a:1});
    queue.pushType('jobtypeB', {a:2});

If the queue is created with a scheduler, the job type must be specified for each job
queued with `pushType` or `unshiftType`; it is an error to `push` or `unshift`.

Scheduling is done by job type.  Jobs are run in arrival order, except when there are
too many jobs all of a type already running, jobs of that type will be skipped when
selecting the next job to run.  "Too many" is controlled by `maxTypeShare` (default 80%)
of the available job slots specified with `concurrency`, or more than the type's share
of the count of jobs waiting to run.


Custom Scheduling
-----------------

It is possible to provide a scheduler object to the queue, which will then be used to
schedule.  The scheduler must implement methods

- `waiting( type )` - a new job was queued
- `start( type )` - a job started
- `done( type )` - a job completed
- `schedule( qlistOfTypes )` - given the `qlist` of waiting jobtypes (in arrival order),
  select one of them to run, and returns its index `0 .. size()-1`. Note that the list
  of waiting types may be redundant, if jobs are always appended then the same
  information is available from the waiting / start / done calls.

Integration
-----------

Applying queue-based scheduling to a middleware stack is very straight-forward, a
middleware step can be created to queue its callback.  The middleware will execute when
the queue job runs.  When the middleware stack finishes, it notifies the queue that
the job is done.

    var scheduleRequest = function(job, cb) {
        var req = job[0];
        var next = job[2];
        req._jobDoneCb = cb;
        next();
    }
    var schedulerQueue = new Quickq(schedulerRequest, {scheduler: 'fair'});

    app.add(function(req, res, next) {
        // pause this request until this call has been scheduled to run
        // Scheduling is by the request path.
        schedulerQueue.pushType(req.path(), [req, res, next]);
    })
    app.after(function(req, res, next) {
        req._jobDoneCb();
        next();
    })

Scheduling resource allocation can be done by matching jobs to resources.  Like
scheduling middleware, the trick is to separate the job from its callback:  the job
calls the resource user callback, and the job callback is invoked from the
`freeResource`.

    // allocate and use resource, arrange to notify scheduler when done
    function obtainAndUseResource( job, cb ) {
        var resource = acquireScheduledResource();
        resource.schedulerCb = cb;
        job.useResourceCb(null, resource);
    }
    // the queue of resource user calls
    var resourceQueue = new Quickq(obtainAndUseResource, { scheduler: 'fair' });

    // schedule and allocate resource, call cb once obtained resource
    function allocateResource( cb ) {
        var job = { useResourceCb: cb };
        useResource.push(job);
    }

    // user is done with resource, free it and notify the scheduler
    function freeResource( resource ) {
        releaseScheduledResource(resource);
        resource.schedulerCb();
    }

Performance
-----------

Performance is much better than `fastq`, and much much better than `async.queue`.
On the identical code, invoking the callback via `setImmediate`:

    qtimeit=0.18.2 node=7.8.0 v8=5.5.372.43 platform=linux kernel=3.16.0-4-amd64 up_threshold=11
    arch=ia32 mhz=4419 cpuCount=8 cpu="Intel(R) Core(TM) i7-6700K CPU @ 4.00GHz"
    name                     speed         (stats)                                                      rate
    async.queue            869,878 ops/sec (4 runs of 20 calls in 0.920 out of 1.741 sec, +/- 0.00%)    1000
    fastq                1,828,283 ops/sec (6 runs of 20 calls in 0.656 out of 1.315 sec, +/- 0.00%)    2102
    quickq setImmediate  4,146,898 ops/sec (7 runs of 40 calls in 0.675 out of 1.357 sec, +/- 0.00%)    4767
    quickq_scheduled     2,402,672 ops/sec (7 runs of 20 calls in 0.583 out of 1.333 sec, +/- 0.00%)    2727

But `quickq` will not overflow the call stack; omitting the setImmediate and invoking
the callback directly nets another 4x speedup:

    quickq callback     18,526,543 ops/sec (7 runs of 200 calls in 0.756 out of 1.429 sec, +/- 0.00%)  21424
    quickq_scheduled     7,747,495 ops/sec (4 runs of 200 calls in 1.033 out of 1.619 sec, +/- 0.00%)   8870

As can be seen from the benchmark results, the scheduling overhead cuts quickq
performance by half, from 18 million job dispatches per second to 7.7 million.
However, this is still much faster than the non-scheduled `async.queue` or `fastq`.


References
----------

- [async](https://npmjs.com/package/async)
- [fastq](https://npmjs.com/package/fastq)
- [quickq](https://npmjs.com/package/quickq)
- [qlist](https://npmjs.com/package/qlist)
