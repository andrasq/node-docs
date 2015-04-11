Elastic Pipes
=============
**Simple Fix for Cross-Service Dependencies**<br>
*2015-04-10 Andras Radics*

Trying to untangle a service from blocking dependencies on internal
micro-services that are not available when trying to hand off data?  Here's a
simple design approach to avoid the issue.


## The Problem

The app that started this investigation published messages to RabbitMQ via
TCP/IP and AMQP.  This worked ok, but periodically the app would start
crashing, not responding to requests and losing the messages that were needed
to maintain consistency.


## Analysis

Investigating, it turned out RabbitMQ would periodically become non-responsive,
which caused AMQP to not be able to hand off messages and error out.  Due to
this hidden coupling, a batch resource two services removed was breaking the
high-visibility public-facing real-time app.

The situation, in its essence:

- unavailable resource blocks arriving requests
- queues build and back up through the connection
- connections fill up, resources are consumed, new connections error out
- app crashes or must lose data to protect itself

This type of coupling can exist between an app and its supporting services,
between the app and any external services, or between the internal services
themselves, each one a latent source of delays or errors.


## The Solution

The key insight is the word "coupling."  Apps should decouple access to
services that are not required for the results.

One way to decouple is to is to make accesses asynchronous, and retry on
errors.  Another is to make the access optional (ignore errors, though
ignoring errors is not always possible).

A good general solution should be

- available (never block the sender)
- durable (once sent, will not be lost)
- load tolerant (not grind to a halt when the system is busy)
- simple (easy format to work with)
- very fast
- very low overhead
- scalable (distributed, no centralization)

Conceptually, it would be nice if one could just insert a high-bandwidth, high
capacity channel between every producer and every consumer, one that grows to
fit as much data as needed, shrinks to not consume resources when idle, is
durable, has little overhead, at no cost when not used.

And the solution should also be space- and time-efficient, since each link in
a network of services might need to be decoupled from its neighbor.

## Design

Not a pipe dream!  Use a journal file:  append newline terminated strings, and
periodically process the journal, replacing it with a new empty file.

As observed at the time [1],

> The solution is to interpose a low-latency elastic store between every
> production and consumption point at every stage of the transmission pipeline.
> This eliminates blocking, and also exposes the messages to batching, boosting
> throughput.
>
> The original idea gelled when we [...] started seeing blanks in the graphs:  a
> direct end-to-end data delivery system does not tolerate delays and does not
> scale.  Instead, data needs to be aggregated and delivered in batches.  Statsd
> and Ganglia use this same principle.

Files are Great

- unlimited capacity (disk space is one of the most plentiful resources on a
  system)
- very high bandwidth (buffered and cached by the operating system, small
  bursts are near-memory speed)
- grows and shrinks as needed, system reclaims resources
- most optimized use cases are append and in-order read
- essentially no cost in the expected case (just one small file)
- aggregating data allows for more efficient bulk transport and bulk processing

Newline Terminated Text is Great

- very simple, very fast
- universal
- wealth of tools to manipulate

Benefits

- app is never blocked waiting for a remote resource
- if the remote service crashes, it delays the data but does not impact the app
- if the app outpaces the remote service, it delays the data but does not slow the app
- if there are transmission errors, retry and de-dup on a unique id
- the journal file can be shipped to a central location for bulk ingestion
- simple stats easily available from the command line (data type, data volume, size of backlog)

Run-Time Usage

- app serializes and appends to journal file the data it would have sent
  directly, tagged with a unique id.  Appends use LOCK_EX to allow multiple
  writers.
- separate thread reads the journal file and sends data to internal service
  - rename journal to cease appends (app creates new journal file to append to)
  - upload old journal file contents
  - remove old journal file
  - repeat
  - (if a previous old journal file already exists, upload it first, then repeat)


## Implementation

A more generalized form of this approach (newline delimited text as high speed
data transport) was first coded in PHP [2].

High-speed nodejs line streaming is available via the qfputs and qfgets
packages [3], as is very high throughput guaranteed unique id generation [4].


## Conclusions

The solution to the RabbitMQ problem above decoupled the app from AMQP (and
thus RabbitMQ) by saving the messages into a file, and inserting from the file.

We never did find out what caused the RabbitMQ hangs.  From anecdotal
evidence, newer RabbitMQ versions running elsewhere were still experiencing
similar problems years later.


## References

[1] Andras Radics, Jan 2012 memorandum (unpublished)<br>
[2] `Quick_Fifo_Reader` and `Quick_Fifo_Writer` in [Quicklib](https://github.com/andrasq/quicklib)<br>
[3] [qfputs](https://npmjs.org/package/qfputs) and [qfgets](https://npmjs.org/package/qfgets)<br>
[4] [mongoid-js](https://npmjs.org/package/mongoid-js)
