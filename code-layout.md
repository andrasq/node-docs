# The Art of Code Layout

Notes on appearance and layout, by Andras Radics

_Oringinally appeared as [Coding Whitespace And Indentation](https://docs.google.com/document/d/1DcpiSSqlSjOJTYfWMWr5oE_xl-csc6GDS5Wp99b_czE/edit#heading=h.8ne0x98mwcfa)_


Not only should code work correctly, it should present well.  Just like text, programs
have words, sentences, paragraphs and chapters.  A consistent use of appropriate of
whitespace clarifies the structure and intent of the code, improving readability and,
more importantly, skimmability.


SAPI is written essentially in the K&R coding style (after Kernighan and Ritchie,
authors of The C Programming Language).  PHP heavily borrows syntax from C, and the
K&R style is one of the most widely adopted styles to deal with C's miscellaneous
punctuation.


- [Words](#words)
- [Lines](#lines)
- [Sentences](#sentences)
- [Paragraphs](#paragraphs)
- [Chapters](#chapters)


## Words


JustlikeitwouldbehardtoreadEnglishiftherewerenospacesbetweenwords, it's hard to read
code with poor whitespace usage.  Whitespace should separate operators from arguments,
keywords from punctuation, with only a few exceptions (before and after the '(' in
function call parameter lists and before commas, for example).  In general, it's
better to use too much than too little whitespace.


Whitespace should be uniform, to create a pleasantly homogeneous texture to the code.


Use whitespace around keywords, to separate operators from arguments, to separate
elements in comma-lists in lists and call parameters.


Good:

    if ($x >= 10 && $x < 20)
    $list = array(1, 2, 3);
    foreach ($list as $index => $value)
    function foo( $x ) {


Poor:

    if($x>=10&& $x<20)
    $list= array( 1,2,  3) ;
    foreach($list as $index=>$value)
    function foo($x){


## Lines


Keep lines neat.  Do not place pointless RETURN chars at the end of lines, they can show
up as `^M`.  Do not leave whitespace (indentation) on blank lines.  Do not leave
trailing whitespace on any line.


Good whitespace hygiene avoids pointless diffs when reviewing changes in the code repository.


Do not end the file with `?>`, that's asking for trouble.  PHP will automatically exit
script mode when it reaches the end of the file, ?> is not necessary.  However, having
`?>` followed by a hidden newline will emit the whitespace, possibly breaking the
results.


## Sentences


Avoid run-ons and very long sentences.  Keep statements a reasonable length to not
wrap to the next line.  Although wrapping can be controlled by resizing the window, a
limit of 100 or so characters per line is good.  Use helper methods to prevent too
many levels of indentation, this often helps clarify the code too.


Wrap nicely to multiple lines.  If a statement contains more terms than fit on the
line, wrap them to be pretty.  See the examples below for recommended ways to wrap
long arrays, method call chains and test conditions.


Place the `{` statement block start delimiter at the end of the line, unless it follows
a multi-line conditional in which case it looks better on the next line.  Align the `}`
with the beginning of the matching `{` line, and indent the contained block.  (But no
need to double-indent case statements; leaving the case labels hang-indented is just
as legible and saves one indentation level.)


Examples:


Arrays can be populated compactly without building ridiculously long lines:

    $data = array(
        'one', 'two', 'three', 'four', 'five',
        'six', 'seven', 'eight', 'nine', 'ten',
        'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
        'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
    );

Note the comma after the last element in the array.  PHP allows this usage, and it's
good practice to use the comma as an element terminator not separator, for the same
reasons that languages use ';' as a statement terminator not separator:  it avoids
syntax errors if elements are added or rearranged.


Sometimes array elements are long, then lay them out one per line:

    $adminCalls = array(
        'GET::/admin/version' => 'Netpx_Api_Controller_Admin::versionAction',
        'GET::/admin/ping' => 'Netpx_Api_Controller_Admin::pingAction',
        'GET::/admin/echo' => 'Netpx_Api_Controller_Admin::echoAction',
        'GET::/admin/exception' => 'Netpx_Api_Controller_Admin::exceptionAction',
        'GET::/admin/phperror' => 'Netpx_Api_Controller_Admin::phperrorAction',
    );


Case:

    switch ($test->value()) {
    case 'a':
        $test->processA();
        break;
    case 'b':
        $test->processB();
        break;
    case 'c':
        $test->processC();
        break;
    }


Method call chains can build to long lengths; if more than 2-3 levels deep lay them out vertically to help make the flow clear:

    $formattedResult = $object
        ->setParameterOne(1)
        ->setParameterTwo(2)
        ->setArrayParameter('name', array(
            'k1' => 'v1',
            'k2' => 'v2',
            'k3' => 'v3',
        ))
        ->callMethodWithManyParameters(
            'one', 'two', 'three', 'four', 'five',
            'six', 'seven', 'eight', 'nine', 'ten'
        )
        ->operateAndReturnPartialResultObject()
        ->processPartialResultAndReturnFinalResultObject()
        ->formatResult();


Same for conditional expressions, short conditionals go on one line, but if there are a lot of terms, format vertically:

    if ($object->shortTest()) {
        // ...
    }
    if ($object->longTestThatFillsUpTheLineByItself() ||
        $object->anotherLongTestThatWouldNotFitAlongside() ||
        $object->yetMoreTestsThatMustBeMade())
    {
        // ...
    }

Note the placement of the left brace in the long conditionals example; aligning it
under the if keyword helps isolate and highlight the the then-block code.  Normally
the { would go at the end of the line with the if, but here that would abut the block
with the condition terms, obscuring both.


## Paragraphs


Group code by subject.  Insert blank lines when changing subjects.


Indent to reflect code structure.  Indent code blocks by 4 spaces.  Indent conditional
terms to line up with the first term.


Do not use tabs.  Do not use 4-space tabs.  Do not use a mixture of spaces and tabs.
Do not use 2 space indentation, it's hard to scan.  Do not use half-step indentation
for curly braces when starting or ending code blocks.  The open brace normally goes on
the end of the line preceding the block; the close brace on a line by itself aligned
with the first non-whitespace character of the line that started the block.


## Chapters


Keep functions short, but not too short; 1/2 page is good, 1 page is ok.


Make your classes small and focused, doing just one thing.


Make the method names, when read in the order they're used, tell the story of the
code.  With well-chosen method names and good code structure, there is often no need
for comments.
For example, this is SAPI:

    // ...
    $app = new Sapi_App_SapiApp("sapi", $VERSION);
    try {
        global $appConfig;
        $app
            ->setStartTime($start_tm)
            ->markRusage()
            ->configureSapiApp($start_tm, $appConfig)
            ->markTime('App')
            ->setConfig('isLocal', $app->isLocalAccess($GLOBALS) )
            ->createRequestFromGlobals($GLOBALS)
            ->setDebugModeFromRequest($app->getRequest())
            ->createResponseForRequest($app->getRequest())
            ->markTime('Req/Resp')
            ->authenticateUserRequest($app->getRequest())
            ->markTime('oauth')
            ->runCall($app->getRequest(), $app->getResponse(), $app)
            ->emitResponse($app->getResponse())
            ;
    }
    catch (Exception $e) {
        handle_exception('exception', $e->getMessage(), $e->getCode(), $e->getFile(), $e->getLine(), $e);
    }
