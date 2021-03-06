Running Cpu-Instensive Jobs on Nodejs
=====================================

Blocking the event loop.  It's frowned upon.  It's anti-social.  Yet sometimes
it's necessary.  Here are some ways of dealing with blocking computations.


Clusters
--------

The easiest is to run multiple copies of the server code, even on the
same system.  Node makes this simple.

Node does not preempt a running computation, but the operating system does, in
units of threads or processes.  System processes do not block each other, they
are temporarily paused to allow each to have a turn.  The number of processes
is limited only by memory, and idle processes are essentially free.

Node does not support multi-threading, but a node service can be have multiple
processes, each process serving requests sent to the same host:port address.
A team of such processes is referred to as a cluster.

A cluster is created with `require('cluster')` and `if (cluster.isMaster)
{ cluster.fork() }`.  Each fork() creates a server process running the same script
as the master, but with cluster.isMaster set to false.  If all the forked
processes listen to the same network port, the incoming connections will be
distributed among them.  Command-line parameters or arguments can be passed to
the servers via environment, eg

        // pass command-line switches at the top of the script
        if (cluster.isMaster) process.env.ARGS = JSON.serialize(process.argv);
        else if (process.env.ARGS) process.argv = JSON.parse(process.env.ARGS);

        // ... configure based on the command-line switches

        if (cluster.isMaster) {
            cluster.fork();
        }

By running a cluster, the probability of all being blocked is decreased,
helping the _average_ response time stay fast.  (Any individual request can
still block behind another, but it will be less likely to do so.)  The larger
the cluster, the lower the chance of a request blocking.  The operating system
balances the available cpus among all running server processes, so a blocked
request in one process will not prevent other processes from completing requests.
There is no preset limit on the number of processes; the practical size of the
cluster is bounded only by memory.

Clustered services need to be sure to use multi-use safe packages, eg logging.
Some loggers assume they're the only one writing and managing the logfile, and
two instances would overwrite one another.  (See [qlogger](https://www.npmjs.org/package/qlogger)
for a fast multiuser-safe logger.)


Child Processes
---------------

If several identical server processes is not suitable, node also
provides hooks to delegate work to helper processes.

If the blocking computation can be isolated, it can be serialized and
sent to a [child_process](https://www.nodejs.org/lib/child_process.html)
to process it.  There are node packages to simplify the implementation,
eg [worker-farm](https://www.npmjs.org/package/worker-farm').

Note that serializing node objects can itself be cpu-intensive; that's a
harder one to solve.


Refactor
--------

### JSON.stringify

One contributor to blocking behavior is the JSON.stringify built-in.  JSON
string handling is relatively slow in node.  It can be re-implemented in
javascript and made non-blocking, however, at a fairly moderate overhead.
See [json-simple](https://www.npmjs.org/package/json-simple) for the basic
structure.

### JSON.parse

There are streaming JSON parser modules for nodejs, both written in JavaScript
as well as C++.  See for example [i-json](https://npmjs.org/package/i-json)
(C++) and [jsonparse](https://npmjs.org/package/jsonparse) (js). (Note that
jsonparse can enter an infinite loop when parsing strings containing non-utf8
characters.)
