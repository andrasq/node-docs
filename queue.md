Design of a Highly Scalable Distributed Message Queue and Job Runner
====================================================================
2019-10-17 - Started - Andras.


_WORK IN PROGRESS_

## INTRODUCTION

This paper outlines the design of a distributed job runner that is durable, efficient, and
can scale without limit.

Background.

Job queues provide a way to run a function asynchronously, at a later time, outside
of the current execution context.  The function parameters are stored with the
jobtype, and the job queue arranges to run the function.

Writing a job queue is not that hard, and it's fun!  I've written several -- two in PHP, and
on in Nodejs.  The very first one is still running 10 years later, and forms the backbone of
the company production framework.  (The second was a simplified batching version also in
PHP, the third in Nodejs on top of `beanstalkd` for a hackathon.)

Lately I've been toying with the idea of writing a high performance Nodejs job queue similar
in principle to AWS Lambda, with the handler functions not built into the job runners but
stored in source form alongside the job payloads.  The motivation was seeing Lambda pricing,
which bills a minimum of 0.1 cpu seconds for every call, and contrasting that to the
microservice I was maintaining, whose typical call durations were .005 seconds.

Job Queues.

Job queues arrange for a function to be applied to data.  Some are built in (Nodejs
setTimeout), some can be downloaded (async.queue, RabbitMQ), some are available as a service
(AWS Lambda).

They resemble pub/sub message queues: the message is the data item, the receiver is the
function (invokes the function) that processes the data, the channel is the function name.
Each message is delivered to just one listener (no broadcast) and is optionally retried if
the handler errors out.

Results are delivered via side effects: can be scheduled computations (more messages),
emails sent, database records inserted, etc.

Queueing, scheduling, delayed execution etc are just minor refinements on the principle.

Benefits.

Job queues buffer the jobs, unlike pub/sub message passing that expects to be able to hand
off to a listener immediately.  Because they buffer, queues can easily delay the job start
and retry on error.  Also, because they buffer, they can be used to tolerate bursty
traffic patterns.

For example, a website that processes signups can queue the signup job with the provided
parameters and immediately render the thankyou page.  The signup process can then run
off-line, and when it finishes it can send out the confirmation email.

### GOALS

We expect our job queue (and any queue in fact) to be practical and usable.
So then, as the broad initial goals, we want
- simplicity (interface, configuration, maintenance)
- reliability (stable, available, no downtime)
- performance (fast queueing, fast scheduling, fast execution, non-blocking, scalable)
- versatility (wide variety of use cases)
- to have fun! (isn't that the point of writing open source code at night?)

Simple.

There is no reason for a queue not to be simple; there's not that much to it.

- simple interface (jobtype string, newline terminated data string)
- call versioning can be embedded into the function name (identifier) string
- simple config (self-configuring, minimal admin overhead, no pre-declared runners)

Reliable.

For the queue to be trusted, it needs to be reliable: always available and functioning.
Most of the reliability goals below were a result of having been burned by RabbitMQ and
AMQP.  The lessons learned were written up in a paper on "elastic pipes".  The ideal job
queue should be:

- available (guaranteed accept: can always queue messages, even when queue is stopped,
  never block the sender)
- durable (guaranteed delivery: once accepted, messages will be delivered even if service
  crashes)
- load tolerant (api will not grind to a halt when the system is busy, internal rate limiting)
- fault tolerant (message will be retried as necessary until it completes, no need to babysit.
  This allows for crashes in the job handler functions)
- "at least once" (guaranteed execution to completion)
- "run eventually" (not lost even when no handlers (no listeners) defined yet)
- "queue and forget"

Performant.

For the queue to be useful, its overhead must be negligible.  The lower the overhead, the
wider variety of jobs it can run without penalty.  Ideally we'd like the job queue to be
fast enough to be able to replace microservice calls (or even function calls).

- real-time (scheduling/routing/execution overhead under 1 ms)
- low overhead (very fast insert, schedule and process rates)
- scalable (fully distributed, no centralization)
- no single points of failure
- backlog tolerant (large number of queued jobs should not affect run rate)
- non-blocking (if one part of the queue is stalled, it should not affect callers)

In addition, the queue must be able to scale to handle growing workloads.
- fully asynchronous (no results returned from job)
- unbounded number of clients, jobtypes
- distributable, no centralized anything

Versatile.

The queue must offer enough features to support a broad range of use cases.  The more
features, the more possible use cases; however, the more features, the more complexity.
This list captures the core (multi-tenant, unbounded, scalable), and adds a few that
are fairly easy to layer on top.

- simple (easy conceptual format to work with)
- unlimited number of job types
- multi-tenant use (ie, namespace the jobtypes)
- postdated execution, can be set for later delivery
- automatic retry on error (with an eventual timeout)
- job priorities, to run the urgent jobs first
- per-jobtype suspend/resume of message delivery (tweak priority)
- expose analytics (for health monitoring and insight into its operation)
- for convenience, support very large data payloads
  (more than beanstalkd 64kb, more than mongodb 16mb)

## OVERVIEW

### Flow

Insert.

Inserting takes a job type and data item, and arranges for a job to be run to process the
data.  It persists the information before returning to the caller, but the job runs
asynchronously.  The caller is not notified of completion.

Note that it is not necessary to persist the job in the database, they can be appended
to a local file and inserted later.  The job must survive a service crash, however.

Schedule.

Scheduling selects a jobtype to run next.  Job selection must be fair to other clients and
to other jobs of the same client.  A huge glut of jobs all of one type will obviously take a
long time to process, but must not starve other types or other clients.

Scheduling should be
fair both job-vs-job and client-vs-client in multi-tenant queues.  My solution was to select
clients and jobtypes at random, which converges to a nice even-handed scheduling policy; see
"Fair Job Queue Scheduling" at https://github.com/andrasq/node-docs/blob/master/fair-queue-scheduler.md

In brief, a fair scheduler could select a random client (client-client fairness), then a
random waiting jobtype of that client and run the oldest waiting job of that jobtype of that
client.  Or it could randomly select a jobtype from the fully qualified waiting jobtypes
(job-job fairness) and run the oldest waiting of that type for that client.

Run.

The jobs runners use the scheduler to pick jobs and invoke the defined handlers on the job
data.  If no handler has been defined yet, the runner can return the job back to the store.

To run a job a tenant-specific context must be created (or located), the handler function
loaded, the data deserialized and passed to the function, errors caught, and completion
status recorded.  The context may be reused for same-tenant and same-jobtype runs, but needs
to be "sanitized" between runs of different jobtypes.

For simplicity, jobs do not return results to the job runner and do not chain results to
other jobs.  In a first version of the queue, data passing must be arranged for externally.

It's simpler if the job runners schedule their own work, ie incorporate the job selection
logic, and pull jobs from the store instead having a separate scheduler push jobs to them.
This share-nothing parallelism has several benefits:  runner status does not have to be
exposed to the schedulers, schedulers do not have to track when runners need more work,
adding more runners automatically adds schedulers too, easy to deploy different scheduling
algorithms, easy to implement custom (client-specific) job runners.

Retry.

Jobs can succeed, can fail, or can error out, ie throw.  If they error out, they can not be
considered to have run (the handler may not even head read the data yet) and to meet the
at-least-once service guarantee should be retried.  If the handler is buggy, the retry will
eventually succeed once it's fixed.  (In cases where it matters the coder must ensure that
the job is idempotent.)

It is much easier to retry jobs from inside the queue itself than to put that chore onto the
caller.  The easiest is to mark the job that's still in store with an execution date in the
near future.  The execution date tweak can be piggy-backed onto the runner lock expiration
handling.

One other possibility is for the job to hang, neither error out nor return.  Since this can
occur when eg waiting for a slow database, we can treated is as a job timeout error and also
handle it with a retry.

Archive.

Job payloads and completion status can be retained for a time for analytics and inspection.
The job can be left in the job store with a permanent lock asserted by the special client
"done", or marked with a `done_dt` and deleted after a while.

A completely different way to archive results is to emit them to a logging service, and have
the service parse, store and display the information.  For forensics, however, it can be
useful to retain the actual job (eg, to manually re-queue in bulk).

Purge.

Periodically the old archived results have to be deleted to keep the data size manageable.

### Components

- multiple runners connected to a store (not clear that there would be a
  benefit to connecting to multiple stores.  My first PHP version allowed it,
  my second PHP version didn't)
- multiple stores
- load balancer directs inserts to one of the available stores randomly
- stores and/or runners can be added any time alongside a running queue

#### API
- `insert(tenant, jobtype, data, [timeout])`

### Basics

### Locking

### Advanced Features

- mock lock the job for delayed start
- retries
- client-specific job runners

### Job Store

- a lot more writes than reads (insert, lock, read, archive, remove)
- initial version could persist directly to database (without localhost journal)
- sql allows for more sophisticated selection logic to performed inside the database
  (eg `select distinct jobtype from jobs order by rand() limit 10`)
- the mysql query cache captures the many duplicate scheduling lookups
  coming from the many runners connected to each database
- mongodb wiredtiger does a copy-on-write for in-place updates
- mongodb max document size is 16 MB, so would need a secondary data store for
  large data payloads
- status can be encoded in lock_dt: 9000-01-01 (pending) vs 9999-01-01 (done)
- api: insert / get / unget / renew / finish / delete
- `insert(client, jobtype, payload, {start_dt,priority})

### Data Store

- can include in jobs table, or in a separate bulk-items table, or push to S3.
  Easiest to make it a HUGEBLOB and see how that works.

### Engine

- core of the runner
- coordinates job selection, task locking, task frame creation, dispatch, status harvesting,
  archival
- scheduler and job runner a built into the engine
- each instance of the engine fetches tasks from the configured store
- there is no limit on the number of engines that can run simultaneously

#### Scheduler

- selects which client, jobtype to run next
- easiest is to select at random, and achieve fairness asymptotically
- could accept hints for what to run next
- could use heuristics to identify jobs that are more deserving to be run
- could use knowledge of the current runner state to favor running jobs that
  already have a job context on hand to minimize setup overhead
- api: getReadyClients / getReadyJobtypes / selectJobtype

#### Job Runner

### Runner(s)

## DETAILS

### Reliability and Performance

- checkpoint to local journal file (available, durable)
- insert arrived jobs in batches (performance)

- 4-core php server can invoke 10k jobs / sec to a url, and 75k / sec to a subprocess
- 4-core nodejs server can run 150k http calls per second

### Housekeeping

- break locks (this also schedules start-delayed and retried jobs)
- prune completed jobs archives (eg by `done_dt` timestamp)

### Analytics

Useful information for tuning the queue:

- ok completion rate (success or failure)
- errored out rate (could not process)
- running jobs count
- retry rate
- lock expirations (locks broken)
- lock durations

## REFERENCES

- fair-queue-scheduler.md - http://github.com/andrasq/node-docs/blob/master/fair-queue-scheduler.md
- elastic-pipes.md - http://github.com/andrasq/node-docs/blob/master/elastic-pipes.md
- unique_ids.md - http://github.com/andrasq/node-docs/blob/master/unique_ids.md
- PHP `Quick_Queue` in quicklib.git http://github.com/andrasq/quicklib/tree/master/lib/Quick/Queue
- kqueue
