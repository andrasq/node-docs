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

Ignoring errors is not always possible.  A best general solution would be

- available (never block the sender)
- durable (once sent, will not be lost)
- load tolerant (not grind to a halt when the system is busy)
- simple (easy format to work with)
- very fast
- very low overhead
- scalable (distributed, no centralization)

Conceptually, it would be nice if could just insert a high-bandwidth, high
capacity channel between every producer and every consumer, one that grows to
fit as much data as needed, shrinks to not consume resources when idle, is
durable, has little overhead, at no cost when not used.

And the solution should also be space- and time-efficient, since each link in
a network of services might need to be decoupled from its neighbor.

## Design

Not a pipe dream!  Use a journal file:  append newline terminated strings, and
periodically process the journal, replacing it with a new empty file.

Files are Great

- unlimited capacity (disk space is one of the most plentiful resources on a
  system)
- very high bandwidth (buffered and cached by the operating system, small
  bursts are near-memory speed)
- grows and shrinks as needed, system reclaims resources
- most optimized use cases are append and in-order read
- essentially no cost in the expected case (when lightly used, one small file)

Newline Terminated Text is Great

- very simple, very fast
- universal
- wealth of tools to manipulate

Usage Convention

- app serializes and appends to journal file the data it would have sent
  directly, tagged with a unique id.  Appends use LOCK_EX to allow multiple
  writers.
- separate thread reads the journal file and sends data to internal service
  - rename journal to cease appends (app creates new journal file to append to)
  - upload old journal file contents
  - remove old journal file
  - repeat
  - (if a previous old journal file already exists, upload it first, then repeat)

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
