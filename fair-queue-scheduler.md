Fair Job Queue Scheduling
=========================

This was originally written in response to a
[stackoverflow.com question](http://stackoverflow.com/questions/28388281/job-scheduling-algorithm-for-cluster/28389114#28389114)
asking about job queue scheduling


When I implemented a very similar job runner (for a production system),
I ended having each server up choose jobtypes at random. This was my
reasoning --

- a glut of jobs from one user should not impact the chance of other users
having their jobs run (user-user fairness)

- a glut of one jobtype should not impact the chance of other jobtypes
being run (user-job and job-job fairness)

- if there is only one jobtype from one user waiting to run, all servers
should be running those jobs (no wasted capacity)

- the system should run the jobs "fairly", i.e. proportionate to the
number of waiting users and jobtypes and not the total waiting jobs
(a large volume of one jobtype should not cause scheduling to favor it)
(jobtype fairness)

- the number of servers can vary, and is not known beforehand

- the waiting jobs, jobtypes and users metadata is known to the scheduler,
but not the job data (ie, the usernames, jobnames and counts, but not
the payloads)

I also wanted each server to be standalone, to schedule its own work
autonomously without having to know about the other servers

The solution I settled on was to track the waiting jobs by their
{user,jobtype} attribute tuple, and have each scheduling step randomly
select 5 tuples and from each tuple up to 10 jobs to run next. The
selected jobs were shortlisted to be run by the next available
runner. Whenever capacity freed up to run more jobs (either because
jobs finished or because of secondary restrictions they could not run),
ran another scheduling step to fetch more work.

Jobs were locked atomically as part of being fetched; the locks prevented
them from being fetched again or participating in further scheduling
decisions. If they failed to run they were unlocked, effectively returning
them to the pool. The locks timed out, so the server running them was
responsible for keeping the locks refreshed (if a server crashed, the
others would time out its locks and would pick up and run the jobs it
started but didn't complete)

For my use case I wanted users A and B with jobs A.1, A.2, A.3 and B.1
to each get 25% of the resources (even though that means user A was
getting 75% to user B's 25%). Choosing randomly between the four tuples
probabilistically converges to that 25%.

If you want users A and B to each have a 50-50 split of resources, and
have A's A.1, A.2 and A.3 get an equal share to B's B.1, you can run
a two-level scheduler, and randomly choose users and from those users
choose jobs. That will distribute the resources among users equally,
and within each user's jobs equally among the jobtypes.

A huge number of jobs of a particular jobtype will take a long time to
all complete, but that's always going to be the case. By picking from
across users then jobtypes the responsiveness of the job processing will
not be adversely impacted.

There are lots of secondary restrictions that can be added (e.g., no
more than 5 calls per second to linkedin), but the above is the heart
of the system.

Andras
1469 1 11
