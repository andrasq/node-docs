Easy Solution for Hard to Fix Nodejs GC Delays
==============================================

One of the easiest fixes to intractable nodejs garbage collection delays is the Gordian
solution -- don't unravel the problem, cut right through it.  For nodejs services, this
means seamlessly restarting the service.

Luckily nodejs makes this easy with the the built-in `cluster` module.  With
clusters, it's possible to create worker processes all running the same script as
the master, and to share open file descriptors.  In fact, all calls to
`net.listen()` automatically share the socket!

The outline of the gc solution then, in a nutshell, is
* create a cluster of 1 worker to run the service
* periodically shut down the worker, and
* create another worker process to replace it

Because the parent shares the sockets the service listens on, the sockets are kept
open even if a worker shuts down.  Incoming connections are queued by the network
until the next worker can accept them.


Clusters
--------

Example
-------

As a small example, consider an echo service that replies with its input:

        var net = require('net');

        var server = net.createServer().listen({ port: 1337, host: 'localhost' });
        server.on('connection', function(socket) {
            socket.on('data', function(chunk) {
                socket.write(chunk);
            });
            socket.on('error', function(err) {
                throw err;
            });
        });

The same echo service, in a cluster:

        var cluster = require('cluster');
        var net = require('net');

        if (cluster.isMaster) {
            var child = cluster.fork();
        }
        else {
            var server = net.createServer().listen(1337);
            server.on('connection', function(socket) {
                socket.on('data', function(chunk) {
                    socket.write(chunk);
                });
                socket.on('error', function(err) {
                    throw err;
                });
            });
        }

The cluster is two processes, the master and one worker.  Both the master and the
worker start running the same script, but `cluster.isMaster` will be `true` only in the
parent process.  Any number of worker processes can be forked, each is 

### The Master

The master (or parent) process creates the workers with `child_process.fork()`, then
blocks waiting for all worker processes to exit, and exits.  Node distinguishes parent
from worker by the presence of special environment variable `NODE_UNIQUE_ID` that it
sets in the process environments of the workers it forks.

See also https://nodejs.org/api/cluster.html

### The Workers

The worker (or child) processes start running the same script that the master did,
but `cluster.isMaster` will be `false` for them.  Any network connections they
listen on is automatically shared with the parent and the other workers.  This is
automatic, it's built into node.

### Messages

The cluster master can send ipc (inter-process communication) messages to the
worker, and the worker can send to the parent.  Some messages are sent by nodejs
automatically as part of the worker startup and shutdown sequence.

Both the parent and child emit `message` events when the other sent it something.

The parent process sends to the child with

        var child = cluster.fork();
        child.send(...)

        // child listens with process.on('message')

The child process sends to the parent with

        process.send(...)

        // parent listens with cluster.on('message') or child.on('message')

### Startup

Once all workers have disconnected, the parent exits unless other events are still
pending.

During the worker startup, the cluster object emits messages to track the startup
sequence:

- `forked` - sent when the child process is successfully created by the operating system
- `online` - sent when the child process started running node
- `listening` - sent when the child process started listening on a socket

### Shutdown

Similarly, a worker shutdown also emits messages in the parent:

- `disconnect` - sent when child exited or has closed its ipc socket and can no longer be talked to
- `exit` - sent when child process exited and is no longer running

If the child calls `process.disconnect()`, it will detach from all listened-on sockets
then disconnect from the parent ipc socket.  Only listened-on sockets (ie server
sockets) are closed, client connections to databases or other services remain open.
Once all workers have disconnected and no events are pending, the parent exits.

If the parent calls `child.disconnect()` it will send each child an internal ipc
message causing the child to call disconnect on itself.

Note that `disconnect()` exits the child even though calls can be in progress, so an
explicit setTimeout delay loop may be required to allow them to finish.  Also note that
if the parent exits the child will exit immediately, even if it has pending timeouts or
events.


Worker Replacement
------------------

Given how clusters work, replacing a worker that has exceeded its allowed memory usage
is as simple as forking a new child process.  Each child initializes as if it were the
only server process running, and once listening on the server socket will connect to
its share of the incoming requests.

To make the switchover completely transparent, overlap the old and new worker processes
and `disconnect` from the old once the replacement is `listening`.  To never exceed the
configured cluster size, `disconnect` from the old process first, and only then fork
the replacement.  Even if the disconnected-from process was the sole worker, no calls
are dropped:  the master keeps the server socket bound to the listened-on port, and the
new worker will get the incoming calls as soon as it starts listening for connections.

Use `process.memoryUsage()` to check how much memory is being used by the process.


Signals
-------

Clusters do not provide signal handling, each process fields its own.  Except for
signals sent by the command interpreter (the shell) to process groups, signals that
arrive at the master process affect only the master process.  For simple services this
is adequate, since fatal signals sent to the master cause it to exit, which forces the
workers to also exit.

To provide more seamless threads-like control of clustered services, however, with
suspend / resume, SIGHUP restart and SIGUSR2 signaling, it can be helpful to relay
signals from the master to the workers.  This also allows each worker to save eg
buffered data or cached state before exiting.

To relay signals:

        // array of forked child processes, in the parent
        var children = [];

        // send the named signal to all child processes
        function relaySignal( signal ) {
            for (var i = 0; i < children.length; i++) {
                children[i].kill(signal);
            }
        }

        // relay signals of interest
        process.on('SIGTERM', function() { relaySignal('SIGTERM')  });
        process.on('SIGINT', function() { relaySignal('SIGINT')  });
        process.on('SIGHUP', function() { relaySignal('SIGHUP')  });
        process.on('SIGUSR2', function() { relaySignal('SIGUSR2')  });

Note that SIGKILL and SIGSTOP cannot be caught, hence cannot be relayed.  KILL abrutply
terminates the master, causing all workers to immediately exit, which is the expected
behavior.  SIGSTOP suspends only the master, but as a workaround SIGTSTP can be caught
and relayed, also suspends the signaled process that isn't listening for it.  SIGCONT
resumes a process suspended by SIGSTOP or SIGTSTP.

        process.on('SIGTSTP', function() { relaySignal('SIGTSTP') });
        process.on('SIGCONT', function() { relaySignal('SIGCONT') });

Because the master has ignored these fatal signals (caught and relayed, but otherwise
ignored), the master will exit only when the worker processes have exited, which is the
desired behavior.


Command Line Trickery
---------------------

When developing cluster-based services at the command line, it is helpful to keep in
mind that the command interpreter (the shell) makes each command it runs a process
group leader, and signals the process group.  Thus a cluster started from the command
line can be killed with ^C or suspended with ^Z without needing signals relayed.

Backgrounded jobs are also signaled as a group if identified by background job number
(%1 %2 etc) or background job name (%node %emacs etc).  Signals sent to a pid (system
process id) or sent with `/bin/kill` instead of the shell built-in `kill` are sent to
just one process, not the process group.

To explicitly signal a process group, send the signal to the negative of the pid of the
process group leader.  So if the master (and process group leader) has pid 1234 and the
workers have pids 1235 and 1236, `kill -1234` will send a SIGTERM to the whole process
group, all three processes.  (And if the master is relaying SIGTERM, then yes the
workers will receive two SIGTERM signals, which may not be what was intended.)
