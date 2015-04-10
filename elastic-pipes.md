Elastic Pipes
=============
**Simple Fix for Cross-Service Dependencies**


Trying to untangle your service from blocking dependencies on internal
micro-services that are not available when trying to hand off data?  Here's a
simple design approach to work around the issue.


## The Problem

The app that started this line of thinking published messages to RabbitMQ via
TCP/IP and AMQP.  This worked ok, but periodically the app would start
crashing, not responding to requests and losing the messages that were needed
to maintain consistency.


## Analysis

Investigating, turned out RabbitMQ would periodically become non-responsive,
which caused AMQP to not be able to connect and to die with an error.  Due to
this hidden coupling, a non-critical resource from two services away was
crashing the public-facing app.

The situation, in the abstract:

- unavailable resource blocks arriving requests
- queues build and back up through the connection
- connections fill up, resources are consumed, new connections error out
- app crashes or must discard data to protect itself


## The Solution

The key insight is the word "coupling."  Apps should decouple access to
services that are not required for the results.  One way to decouple is to
make the access optional (ignore errors).  Another is to make accesses
asynchronous, and retry on errors.

Ignoring errors is not an option in all cases.  A general solution would
ideally be

- available (never block the sender)
- durable (once sent, will not be lost)
- load tolerant (not grind to a halt when the system is busy)
- simple (easy format to work with)
- fast (low overhead)
- scalable (distributed, no centralization)


## Design

Conceptually, it would be nice if could insert a high-bandwidth, high capacity
pipe between the producer and consumer that is durable, can buffer unbounded
amounts of data and has no overhead.  Not a pipe dream -- use a journal file.

Files are Great

- unlimited capacity (disk space is one of the most plentiful resources on a
  system)

- very high bandwidth (buffered and cached by the operating system, small
  bursts are near-memory speed)

- newline terminated text
  - simple, fast, efficient, universal
  - wealth of tools to manipulate

Approach

- app appends to journal file the data it would have sent directly, tagged
  with a unique id.  Appends use LOCK_EX to allow multiple writers.

- separate thread reads journal file and sends data to internal service
  - rename journal to cease appends (app starts appending to new journal)
  - upload old journal file and remove it
  - repeat
  - (if previous journal file exists, re-send it first)

Benefits

- app is never blocked waiting for a remote resource
- if the remote service crashes, it delays the data but does not impact the app
- if the app outpaces the remote service, it delays the data but does not slow the app
- if there are transmission errors, retry and de-dup on the unique id
- the journal file can be shipped to a central location for bulk ingestion

## Conclusions

We never did find out what caused RabbitMQ to hang.  From anecdotal evidence,
other installations were still experiencing the same problem years afterward.

The solution to the RabbitMQ problem above decoupled the app from AMQP (and
thus RabbitMQ) by journaling the messages into a file, and inserting from the
file.


## Credits

The design outlined in this article is based in part on an unpublished 2012
whitepaper and the php [Quick](http://github.com/andrasq/quicklib) library.
