# Unit Tests With Github Actions

2023-06-25 - Andras

This is a short overview of how to have github automatically run the unit tests on every push.
We want to run the unit tests every time we push, and run them with several different versions of
node.

The github actions mechanism is fully customizable and can run arbitrary CI/CD actions, including
tagging, building and publishing, but here we focus on just unit tests.

## Crash Course

Github actions are automatically enabled by the presence of a YAML file in the project
.github/workflows directory.  For nodejs it's often `.github/workflows/nodejs.yml`.

    name: build
    env:
      NODE_ENV: test
    on:
      push:
        # branches: [ $default-branch, test ]
    jobs:
      test:
        runs-on: ubuntu-latest
        strategy:
          max-parallel: 10
          matrix:
            nodeVersion: [ 6, 10, 14, 18 ]
        steps:
          - uses: actions/checkout@v3
          - uses: actions/setup-node@v3
            with:
              node-version: ${{ matrix.nodeVersion }}
          - run: npm install
          - run: npm test
          - env:
            passed: yes
      coverage:
        runs-on: ubuntu-latest
        if: ${{ $passed == 'yes' }}
        steps:
          - uses: actions/checkout@v3
          - uses: actions/setup-node@v3
            with:
              node-version: '5.8.0'
          - run: npm install -g nyc
          - run: npm install
          - run: nyc -r lcov -r text npm test
          - uses: coverallsapp/github-action@v1.1.2
            with:
              github-token: ${{ github.token }}

## name:

The name assigned to the workflow specified in this YAML file.  This is an arbitrary string that may
contain spaces; the workflow name shows up in the dashboards and on the badge.  I use `build`
because that's what I want on the badge.

    name: build

## on:

When to run the workflow.  I run tests whenever changes are pushed.  Optionally the workflow (the
tests) can be restricted to run only for certain branches, e.g. `main` or `test`.

The special branch name `$default-branch` refers to the github repo's configured default, which is
usually `main` or `master`.

    on:
      push:
        branches: [ $default-branch, test ]

## jobs:

The workflow can consist of one or more jobs.  We have just a single job, the unit tests, which we
call `test`

    jobs:
      test:

## strategy:

The strategy section can specify the `matrix` of parameters to test with.  We want to test with
multiple versions of Node.js, which we list in a field we call `nodeVersions`.  The field name is
arbitrary, but has to match the `{{ matrix.nodeVersion }}` reference below in the script.

Technical aside: the workflow steps will be run for each tuple in the cross-product of the arrays
in the matrix.  We have a single array `nodeVersion`, but if we added `os: [ linux, mac ]` then the
steps would run for `6,linux`, `6,mac`, `8,linux`, `8,mac`, etc.

Careful with the versions, yaml converts them to numbers whenever possible, so `16.10` becomes the
numeric `16.1` which is an older version.  Either quote ambiguous numbers `'16.10'` or make them
non-numeric `16.10.x` (the `.x` will be replaced with the highest available patch version, which
is how `'16.10'` is also interpreted):

    strategy:
      matrix:
        nodeVersion: [ 6, 8, 12, 16 ]

## runs-on:

Which machine image to use to run the test.  One can choose from among MacOS, Windows, Linux, or
self-hosted runners.  The most common runner might be `ubuntu-latest` (currently `ubuntu-22.04`),
but `ubuntu-20.04` is also available.  Older linux versions are supported in self-hosted runners.
It seems the github x86 runners are not configured for adding i386 libraries, so while libc6:i386 is
preinstalled, libtinfo5:i386 would have to be copied there by hand..

See https://docs.github.com/en/actions/using-jobs/choosing-the-runner-for-a-job

## steps:

The steps are the list of actions that make up the job.  For nodejs the first few steps check out
the sources and configure the nodejs version to test with and install the npm dependencies.

In a YAML file list elements are preceded by a dash `-`.  Some actions have parameters that follow
underneath without a leading dash.

The `setup-node` step takes an argument `node-version`, which can be a constant, or one of the
workflow parameters.  We use the matrix to run the tests on multiple versions of node.

Each action must have either a `run:` or a `uses:` directive, and can optionally include `name:`
and `if:`.  The `if:` makes that step conditional; if the condition does not hold, that step
will not be run and will be grayed out in the test results dashboard.

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          # node-version: 5.8.0
          node-version: ${{ matrix.nodeVersion }}
      - run: npm install
      - run: npm test
      - run: npm run new-node-tests
        name: additional tests that need a newer node
        if: ${{ matrix.nodeVersion >= 12 }}

(Technical aside:  YAML builds objects from groups of colon-words, and arrays from groups of
dash-prefix items.  In the workflow `steps` is an array of objects, each object with a property
`uses` or `run` and possibly other properties eg `{ uses, with }` or `{ run, name, if }`.)

## uses:

`uses:` steps invoke github library functions.

## run:

The `run` step is either a shell command or, if set to `|`, a scriptlet of commands.  An error
status (non-zero exitcode) returned by a command stops the steps and aborts the workflow.  Each
step can be made conditional by adding an `if:` property.

Each step shows up on the dashboard as a separate line entry with its own timing information.
Step output is captured and is displayed if the step results are clicked on.

    run: |
      npm install
      npm test

## Badges

Github generates an SVG badge as a result of the workflow run.  The badge can be accessed at a url
built from the repo, project and workflow-file names.

    baseUrl = https://github.com/{repo}/{project}/actions/workflows/{yaml}
    [![Build Status]({baseUrl}/badge.svg)]({baseUrl}.yml)

* repo - the github account name
* project - the project repository name
* yaml - the workflow YAML file, typically `nodejs.yml`

The name on the badge will be the `name:` field in the top of the YAML file.
