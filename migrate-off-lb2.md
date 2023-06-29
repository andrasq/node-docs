# Migration Off LoopBack 2

2023-06-28 - Andras.

We had a major internal refactor to migrate our microservice off LoopBack2 (tech debt), which required a
new framework, new bootstrap code, new database interface and a new logging subsystem.  I'll talk some
about how this played out, and a bit about the logging component (the simplest technical change).

## Formal Goals

- explicit: not use LoopBack2, use Nest.js instead (old, unsupported)

- implied: should work as before, all existing unit tests should pass

- how to: exercise left to the reader

## Design: Formal

- workflow was agile-ish (Kanban and Jira); "Ish" because agile.

- brainstorming
  (understand the problem: expectations, requirements, problem definition, approaches)

- ticket refinement (pointing, testing notes, acceptance criteria)

- written design doc only rarely, by team lead

- "pure agile": completely open-ended, needed to discover what removing the framework meant.
  Rapid itration but with limited feedback.

- formal goal: "migrate off loopback" with no elaboration (only the framework was specified)

## Design: Informal

- design often left to the developer
  <br>
  empowering (for sr devs)
  <br>
  scary / dangerous (jr devs likely to be intimidated or fumble the approach)

- started doing close code reviews: simplifications, alternate approaches, cleanups
  <br>
  resulted in PRs earlier in the dev cycle and a tighter feedback loop
  <br>
  produced both better code and better developers :-)

## Dev Goals

- being fairly risk-averse (path of minimal disruption), so my internal guidline was to
  not modify existing code, and full test coverage for new code (ie, avoid risk of errors:
  not add a refactor on top of a major library change)
  <br>
  aside: coding to the bare packages makes it harder to refactor.  A simple abstraction layer helps.
  <br>
  aside: Nest.js as intended (via decorators) would have required a more extensive rewrite
  <br>
  aside: some functionaliy required reaching beneath Nest.js and using the underlying express framework

- "minimize upheaval", no code changes; drop-in replace packages not rewrite service
  (succeeded with bootstrap, ORM, logging, and mostly with nestjs)

- data models (persitence layer api) I chose to emulate, to help other squads migrate after us
  <br>
  aside: LB2 ORM supports SQL, HTTP and in-memory data with a unified MongoDB-like api
  <br>
  aside: have done SQL, REST and MongoDB, even wrote a mysql access library, so this wasn't hard
  <br>
  aside: having to add PostgreSQL json support to the SQL syntax did throw me a bit)
  <br>
  aside: dropped the active record semantics, made data passive

## Much work omitted...

- discoverable bootstrap functions (traceable from index.js)
- visible app setup: call logging, error handling, error responses
  (install the base class default handlers)
- data layer: ORM replacement, PostgreSQL adapter, SQL query builder, REST caller, memory store
- api call json-schema definitions
- api call explorer with `swagger-ui-express` built from the json-schema
- automatic api call existence checks driven by the json-schema

## Example: Logger

- objective: Bunyan-like JSON logger, but faster

- built on a package I was familiar with (I published in 2014)

- very fast, very configurable, and I knew how to use it
  <br>
  aside: others have achieved good results with `pino`

- turned out to be very simple, essentially just:
  <br>
  (modulo faster serialization, invariant substring reuse, and declaring the Logger interface)

----------------
    Error.toJSON = Error.toJSON ||
        (err) => Object.assign({message: '', stack: ''}, err);

    const log = qlogger(process.env.LOG_LEVEL, process.stdout);

    log.setSerializer((info: any, msg: any) =>
        msg !== undefined ? {msg, info} : {msg: info, info: undefined});

    log.addFilter((msg: any, level: number) => {
        // bunyan compat needs all of {name, hostname, pid, level, v, msg, time}
        const bunyanLevels = [60, 60, 60, 50, 40, 40, 30, 20, 10];
        const logLine = {
            name: service, hostname, pid: process.pid, component: name,
            level: bunyanLevels[level], v: 0,
            info: msg.info, msg: msg.msg, time: new Date().toJSON(),
        };
        return safeJsonEncode(logLine);
    });

    return log as Logger;

## Obstacles

- app very tightly integrated with some of the framework features (too much bundled functionality)

- some framework behavior not discoverable, required some trial-and-error probes

- ask: make it fully Bunyan cli compatible (QA used the `bunyan` cli utility to pretty-print the logs)

- ask: support PostgreSQL json fields to the query SQL

- microservice piggybacked onto the ORM before save / after delete observers
  <br>
  aside: would have been cleaner and simpler to add the calls to the single place where records were saved / deleted.
  The danger of coding to the package instead of using the package to simplify the code.

- Nest.js uses language syntax (@decorators) to carry out actions, which makes it hard to do them programmatically
  (eg returning computed status codes, or mounting api routes from a specfile)

- Nest.js has no notion of a post-response middleware step (wanted for timings and logging)
  <br>
  aside: the nodejs http response emits an event when sent, ended up burrowing under Nest.js and
  hooking to the event from inside `express` where it was accessible.

## Testing

- logger tests spot-checked that loglevel and the output stream were hooked up correctly

- logger tests could rely on the full unit tests of the package

- performance tests existed at the application level (some perf optimizations in the line filter)

- normally for new code I aim for good funcational tests and 100% coverage (the two are not the same)

- unit test infrastructure was `mocha` with `assert` and/or `chai` (like `jest`, but faster).
  CI/CD tooling ran the unit tests on every push, and tagged and built a deployable package.

- QA ran end-to-end test scenarios (on their way to be automated)

- continuous monitoring via logs and prometheus stats

- internal alerting with slack hooks

## Results

- seamless changeover from old framework

- retained calls of the old system; new Api layer wraps framework: fields REST calls, invokes app methods

- retained quirks of the old system to leverage existing knowledge

- logging was faster but not observable at the service level

- data access was faster but again not observable at the service level
  <br>
  potential for more speed because now better batching
  <br>
  aside: much bigger speedups came from rewriting some SQL queries in a related microservice
