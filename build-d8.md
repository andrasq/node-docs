How To Build Node and D8
========================

2014-11-21 - AR.

Node has a time-based sampled execution profiler built in.  Running node
--prof script.js will run the script and write run-time profiling traces
logs to ./v8.log.

D8 is a tools that ships with v8 to map the traces to functions and display
them as a sorted histogram (all command-line text-based).

These are the steps to build:

## Clone the node repo into $HOME/src

        mkdir -p $HOME/src
        git clone https://github.com/joyent/node.git $HOME/src/node

## Build node v0.10.29

This is optional; the system may already have nodejs installed.  It is,
however, important to match the version of d8 to the version of v8 used by
nodejs.  Even if not building

To just check the v8 version matching the installed node, look at the top line
of the output from:

        cd $HOME/src/node
        git checkout `node -v`
        grep Version deps/v8/ChangeLog | head

To build node:

        cd $HOME/src/node
        git checkout v0.10.29
        make -j4

## Build d8

D8 must be matched to the version of v8 that is built into node; checking out
the node version will check out the correct v8 dependency too.  D8 is built in
the deps/v8 directory:

        pushd deps/v8
        make -j4 native

There are reports of the build erroring out with gyp and/or directory errors;
the suggested work-around is to clone the v8 repo separately and build there.
Building in node/deps/v8 worked for me, but this would also build v8:

        git clone git@github.com:v8/v8.git $HOME/src/v8
        pushd $HOME/src/v8
        make -j4 native
        popd

I did get an error about missing clock_gettime and clock_getres (debian 7.6).
This might be a bug in the makefile (reportedly some versions were missing the
-lrt flag); I worked around it by statically linking librt (-lrt) into the
platform-posix.o object, and resuming the build

        ld -r -o out.o out/native/obj.target/v8_base/src/platform-posix.o /usr/lib/x86_64-linux-gnu/librt.a
        mv -f out.o out/native/obj.target/v8_base/src/platform-posix.o

        make -j4 native

When done, pop the deps/v8 directory off the directory stack to return to the
top-level node repo

        popd

## Intall the results

The three programs we were interested in are

        out/Release/node
        deps/v8/out/native/d8
        deps/v8/tools/linux-tick-processor

To be able to run them (conveniently), they need to be on the shell $PATH.
Node can be copied to an existing path directory; since I always have
$HOME/bin on my path, I did

        cp -p out/Release/node $HOME/bin/node-v0.10.29
        ln -sf node-v0.10.29 $HOME/bin/node

Linux-tick-processor depends on several of the js files that live alongside it
in the tools directory, and symlinks confuse it.  I wrapped it in a small script

        cat > $HOME/bin/linux-tick-processor << EOF
        #!/bin/sh
        /home/andras/src/node/deps/v8/tools/linux-tick-processor "$@"
        EOF
        chmod a+rx $HOME/bin/linux-tick-processor

Linux-tick-processor expects to find d8 on the path, so also needed

        cp -p deps/v8/out/native/d8 $HOME/bin/d8-v0.10.29
        ln -sf d8-v0.10.29 $HOME/bin/d8


## Run

To run, run the nodejs script with --prof to generate a v8.log file (each new
run overwrites the previous file), then feed the log to linux-tick-processor
to display human-readable stats.

        node --prof script.js
        linux-tick-processor v8.log | less
