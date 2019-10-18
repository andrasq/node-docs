Building a Highly Scalable Distributed Message Queue and Job Runner
===================================================================
2019-10-17 - Started - Andras.


_WORK IN PROGRESS_

## INTRODUCTION

This paper outlines the design of a distributed job runner that is durable, efficient, and
can scale without limit.

Background.

Writing a job queue is not that hard, I've written several -- two in PHP, and once in
Nodejs.  They're fun!  The first one I wrote is still running 10 years later, and forms the
backbone of the production framework.  (The second was a simplified batching version also in
PHP, the third in Nodejs on top of `beanstalkd` for a hackathon.)

Lately I've been toying with the idea of writing a high performance Nodejs job queue similar
to AWS Lambda, where the handler functions are not built into the job runners but are stored
in source form alongside the job payloads.  The motivation was seeing Lambda pricing, which
bills a minimum of 0.1 cpu seconds for every call, and contrasting that to the microservice I
was maintaining, whose tpyical call latencies were around .005 seconds.

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

### GOALS

The queue has reliability goals, performance goals, and functionality goals.

Most of the reliability goals below were a result of having been burned by RabbitMQ and
AMQP.  The lessons learned were written up in a paper on "elastic pipes".  The ideal job
queue should be:

- available (never block the sender)
- durable (once accepted, message will not be lost even if service crashes)
- load tolerant (api will not grind to a halt when the system is busy)
- "at least once" guaranteed execution
- "run eventually" when no handlers defined yet (no listeners yet)
- "queue and forget" fault tolerant (message will be retried as necessary until it completes, no need to babysit)

The performance goals are fairly intuitive, ideally we'd like the job queue to a low
enough overhead to be usable to replace microservice calls (or even function calls).

- real-time (scheduling/routing/execution overhead under 1 ms)
- low overhead (very fast insert, schedule and process rates)
- scalable (fully distributed, no centralization)
- no single points of failure
- backlog tolerant (large number of queued jobs should not affect run rate)

The functionality goals derive from the use cases we'd like to support.

- simple (easy conceptual format to work with)
- unlimited number of job types
- multi-tenant use (ie, namespace the jobtypes)
- postdated execution, can be set for later delivery
- automatic retry on error (with an eventual timeout)
- job priorities, to run the urgent jobs first
- per-jobtype suspend/resume of message delivery (tweak priority)
- analytics (for health monitoring and insight into its operation)
- for convenience, very large data payloads (more than beanstalkd 64kb, more than mongodb 16mb)

## OVERVIEW

### Flow

Insert.

Inserting takes a job type and data item, and arranges for a job to be run to process the
data.  It persists the information before returning to the caller, but the job runs
asynchronously.  The caller is not notified of completion.

Note that it is not necessary to persist the job in the database, they can be appended
to a local file and inserted later.  The job must survive a service crash, however.

Schedule.

The selection of jobs to run is tricky because jobs should make progress even under high
loads, without being starved for cpu or smothered by the other jobs.  Scheduling should be
fair both job-vs-job and tenant-vs-tenant in multi-tenant queues.  My solution was to select
tenants and jobtypes at random, which converges to a nice even-handed scheduling policy; see
"Fair Job Queue Scheduling" at https://github.com/andrasq/node-docs/blob/master/fair-queue-scheduler.md

In brief, a fair scheduler could select a random tenant (tenant-tenant fairness), then a
random waiting jobtype of that tenant and run the oldest waiting job of that jobtype of that
tenant.  Or it could randomly select a jobtype from the fully qualified waiting jobtypes
(job-job fairness) and run the oldest waiting of that type for that tenant.

Run.

The jobs runners select jobs to run and invoke the defined handlers for them.  If no handler
has been defined yet, the runner can return the job back to the store.

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
The job can be left in the job store with a permanent lock asserted by the special tenant
"archive".

Purge.

Periodically the old archived results have to be deleted to keep the data size manageable.

### Parts

- user api: insert(tenant, jobtype, data, [timeout])
- jobs engine
- scheduler
- data store

### Basics

### Locking

### Advanced Features

- mock lock the job for delayed start
- retries
- client-specific job runners

### Job Store

- a lot more writes than reads (insert, lock, read, archive, remove)
- initial version could persist directly to database (without localhost journal)

### Engine

#### Scheduler

#### Runner

### Runner(s)

## DETAILS

### Reliability and Performance

- checkpoint to local journal file (available, durable)
- insert arrived jobs in batches (performance)

### Housekeeping

- break locks (this also schedules start-delayed and retried jobs)
- prune completed jobs archives (eg by timestamp)

### Analytics

Useful information for tuning the queue:

- ok completion rate (success or failure)
- errored out rate (could not process)
- running jobs count
- retry rate
- lock expirations (locks broken)
- lock durations

## MORE INFO

- fair-queue-scheduler.md
- elastic-pipes.md
- unique-ids.md
- PHP `Quick_Queue` in quicklib.git
- kqueue
