原文地址https://davidwalsh.name/es6-generators-dive
本文为generator系列文章的第二篇。

如果你依然不熟悉ES6的generator，建议回去阅读系列文章的第一篇。如果您已经熟悉Generator基础用法，接下来可以开始深入去了解一些细节部分。

###### 译者补充
基础篇可能要注意的地方：
1. 调用iterator.next(),运行到最后一个，done属性依然为true，再调用一次才是false
2. 在generator中使用return，然后调用iterator.next()运行到return可以直接获取return值，并且done属性为false
3. next中传入参数，效果是相当于generator中上一个yield的返回值
4. for..of可以直接遍历iterator，因为他会直接调用内部的iterator运行next

####错误处理
Generator函数中有一个非常棒的设计，就是在generator内部代码是同步的，无论外部是同步还是异步调用的。

既然内部代码是同步的，那我们就可以在generator内部使用```try...catch```去处理错误。
```
function *foo() {
    try {
        var x = yield 3;
        console.log( "x: " + x ); // may never get here!
    }
    catch (err) {
        console.log( "Error: " + err );
    }
}

```
虽然这个函数会在```yield 3```这个语句停下来，并且停多久都可以，但是如果一个错误被传入generator函数，```try...catch```语句还是会捕获到这个错误。尝试用普通的异步方式去处理，例如异步函数。

但是，怎么将一个错误传入这个generator中呢？
```
var it = foo();
var res = it.next(); // { value:3, done:false}

// instead of resuming normally with another `next(..)` call,
// let's throw a wrench (an error) into the gears:
it.throw( "Oops!" ); // Error: Oops!
```
在上面的例子中，你可以看到我们使用了iterator的另外一个方法```throw(..)```，这个方法可以将将错误抛入generator函数，就像这个错误是发生在generator函数在执行yield语句停止的那个位置。此时```try...catch```就会想预期那样的捕获这个错误。

> Note:如果你调用了```throw(..)```方法，但是没有用```try..catch```去捕获，这个错误会像在普通函数里一样被外部捕获，所以
```
function *foo() { }

var it = foo();
try {
    it.throw( "Oops!" );
}
catch (err) {
    console.log( "Error: " + err ); // Error: Oops!
}
```
内部自身错误也是如此
```
function *foo() {
    var x = yield 3;
    var y = x.toUpperCase(); // could be a TypeError error!
    yield y;
}

var it = foo();

it.next(); // { value:3, done:false }

try {
    it.next( 42 ); // `42` won't have `toUpperCase()`
}
catch (err) {
    console.log( err ); // TypeError (from `toUpperCase()` call)
}
```

####委派generator(Delegating Generators)
你也许会想要在generator函数内部调用另外一个generator函数。我并不是指用常规方法实例化一个generator，而是将你的迭代控制权委托给另外一个generator函数，为了这样做，我们使用yield语句的另外一种形式```yield *```
Example
```
function * foo() {
  yield 3;
  yield 4;
}

function *bar() {
  yield 1;
  yield 2;
  yield *foo(); // 'yield *' 将迭代控制权交给foo()
  yield 5;
}

for ( var v of bar()) {
  console.log(v)
}
// 1 2 3 4 5
```
让我们来研究一下这是如何运行的。在```for of ```循环中，```yield 1``` 和 ```yield 2```如我们预期那样直接输出值，但是当遇到```yield *  ```语句时，你会发现我们yield另外一个generator函数，并且```for..of```循环中直接调用foo的迭代器，然后运行完毕后由取回bar的迭代器。

在上面例子中，我们使用了```for of```循环，实际上，即使是手动调用，结果也和上面一样。
```
function *foo() {
    var z = yield 3;
    var w = yield 4;
    console.log( "z: " + z + ", w: " + w );
}

function *bar() {
    var x = yield 1;
    var y = yield 2;
    yield *foo(); // `yield*` delegates iteration control to `foo()`
    var v = yield 5;
    console.log( "x: " + x + ", y: " + y + ", v: " + v );
}

var it = bar();

it.next();      // { value:1, done:false }
it.next( "X" ); // { value:2, done:false }
it.next( "Y" ); // { value:3, done:false }
it.next( "Z" ); // { value:4, done:false }
it.next( "W" ); // { value:5, done:false }
// z: Z, w: W

it.next( "V" ); // { value:undefined, done:true }
// x: X, y: Y, v: V
```
虽然我们展示往下一级的委托，但是foo也可以继续往下委托给别的generator。

另外一个比较诡异的地方就是```yield *```可以从被委托的generator函数获取return的值(普通的yield语句的值为通过next方法传入的)
```
function *foo() {
    yield 2;
    yield 3;
    return "foo"; // return value back to `yield*` expression
}

function *bar() {
    yield 1;
    var v = yield *foo();
    console.log( "v: " + v );
    yield 4;
}

var it = bar();

it.next(); // { value:1, done:false }
it.next(); // { value:2, done:false }
it.next(); // { value:3, done:false }
it.next(); // "v: foo"   { value:4, done:false }
it.next(); // { value:undefined, done:true }
```
就像你所看到的，```yield *foo()```将交出了迭代控制权直到交出去的迭代完成了，迭代完成时，```yield * ```语句的将返回被委托的generator函数的返回值(此例中为foo函数,返回值为foo字符串)

这是```yield```和```yield *```的显著区别：yield语句的返回值是通过next()方法传入的，而```yield *```语句的返回值是被委托generator函数的返回值。


你也可以通过```yield *```语句从里外两个方向处理错误，
```
function *foo() {
    try {
        yield 2;
    }
    catch (err) {
        console.log( "foo caught: " + err );
    }

    yield; // pause

    // now, throw another error
    throw "Oops!";
}

function *bar() {
    yield 1;
    try {
        yield *foo();
    }
    catch (err) {
        console.log( "bar caught: " + err );
    }
}

var it = bar();

it.next(); // { value:1, done:false }
it.next(); // { value:2, done:false }

it.throw( "Uh oh!" ); // will be caught inside `foo()`(译者注：当调用了throw方法，err被catch后，发生err的语句之后的代码都被执行，直到下一个yield停下。)
// foo caught: Uh oh!

it.next(); // { value:undefined, done:true }  --> No error here!
// bar caught: Oops!
```
如上面代码所示，```throw('Uh oh!')```语句在foo函数内部抛出了一个错误并且被foo函数内部的try...catch所捕获。类似的，在foo函数内部的```throw 'Oops!'```所抛出的错误也被外部的try...catch所捕获。如果错误内外都没有被捕捉，则会被再外层函数所捕捉。

####总结
Generator函数在内部代码有着同步执行的特性，这表明你可以使用try...catch来捕捉其中的错误。generator的迭代器的throw方法可以将错误抛入generator上一次所停留的位置，所以也理所当然的可以被try...catch所捕获。

```yield* ```语句你将迭代权交给另一个generator，```yield *```语句的返回值就像个传递器，可以传递信息和错误。

但是，目前还有一个问题没有回答，generator函数式如何帮助我们实现异步的，我们目前所了解的都是同步的调用。关键在于创建一个控制generator暂停和执行的一个机制。我们在下一篇文章会进行讲解。