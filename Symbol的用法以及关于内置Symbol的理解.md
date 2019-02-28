虽然很早之前就把英文版的「深入理解ES6」啃了一遍，但是当我从React最基础的createElement开始看的时候，发现其中有Symbol的使用时，脑子里始终是勾不起Symbol的整个知识体系，果然学过的东西一定要记下来才行。
> P.S. 关于Symbol在React中的用途建议看这篇文章https://overreacted.io/why-do-react-elements-have-typeof-property

以下部分代码使用了「深入理解ES6」中Symbol一章的实例代码。

---
#### 概述
Symbol表示独一无二的值，任何Symbol值都不相同。

---
### 1. Symbol的生成
Symbol生成有两种方式，一种是`Symbol()`，一种是`Symbol.key()`，区别会在后详细解释。
#### 1.1 Symbol()
基本使用方式
```
let s = Symbol(); // 生成一个Symbol
typeof s
// "symbol”

typeof Symbol
// "function" 虽然Symbol是个函数，但不是一个构造函数
```
这里要注意生成Symbol不能加new，因为Symbol是一个原始变量值，不是一个构造函数，更加不能添加属性。Symbol本质上是类似于字符串的一种原始变量。
```
var s1 = Symbol('foo');
var s2 = Symbol('bar');

s1 // Symbol(foo)
s2 // Symbol(bar)

s1.toString() // "Symbol(foo)"
s2.toString() // "Symbol(bar)”
```
生成Symbol时可以传入字符串，打印时也会显示出来，方便调试时能在控制台识别。
```
var s1 = Symbol();
var s2 = Symbol();

s1 === s2 // false， 每次使用Symbol()生成的Symbol值都是不一样的

// 有参数的情况
var s1 = Symbol("foo");
var s2 = Symbol("foo");

s1 === s2 // false”
```
#### 1.2 Symbol.key()
> 使用`Symbol.key()`，我们后面都使用名词`登记`

每次我们调用`Symbol()`，我们总是生成新的`Symbol`，那么如何获取我们定义过的Symbol呢？我们当然可以用变量保存起来，然后导出到每个需要的地方使用。
但是Symbol本身也提供了一个属于`Symbol`的全局作用域。
```
var s1 = Symbol.key('test');
var s2 = Symbol.key('test');

s1 === s2 // true
```
当调用`Symbol.key('test')`，Symbol就会在所以登记过的`Symbol`中查找用`test`字符串定义过的Symbol，然后返回该Symbol。
注意，如果该字符串没有在Symbol登记过，则会返回新Symbol。
```
// 在React源码中使用Symbol.key()的代码片段
export const REACT_ELEMENT_TYPE = hasSymbol
  ? Symbol.for('react.element')
  : 0xeac7;
export const REACT_PORTAL_TYPE = hasSymbol
  ? Symbol.for('react.portal')
  : 0xeaca;
export const REACT_FRAGMENT_TYPE = hasSymbol
  ? Symbol.for('react.fragment')
  : 0xeacb;
```
反过来，我们也可以通过Symbol变量查找登记过的key。
`Symbol.keyFor`返回已登记过的`Symbol`的`key`，它接受一个`Symbol`变量。
```
var s1 = Symbol.for("foo");
Symbol.keyFor(s1) // "foo"

var s2 = Symbol("foo"); // 使用非登记模式生成的Symbol
Symbol.keyFor(s2) // undefined”
```
另外要注意的是，`Symbol.for`为`Symbol`值登记的字符串，是全局环境的，可以在不同的iframe或service worker中取到同一个值。这也是React可以放心使用Symbol的一个原因。

### 2.内置的Symbol值（以Symbol.hasInstance为例）
所谓的内置Symbol值，就是不需要定义，已经预先定义好的Symbol。
这些内置Symbo值都挂在Symbol名下，以Symbo.xxxx的形式获取。
- Symbol.hasInstance
一般情况下，我们并没有办法改写`instanceof`的行为，但是当我们有了内置的`Symbol.hasInstance`，我们就可以改写`instanceof`的行为
```
class MyClass {
  [Symbol.hasInstance]() {
    // anyway, 返回true吧
    return true
  }
}
'String' instanceof MyClass // true

```
为什么可以改写？我们可以理解为instanceof的内部操作增加了如下行为
```
// 假设这是instanceof的内部代码
...
当发现目标XXX内部有`[Symbol.hasInstance]`方法，执行用户自定义方法
if (XXX[Symbol.hasInstance]) { // XXX为instanceof后面的变量
  return Foo[Symbol.hasInstance]
} else {
  // 执行普通的instanceof代码
}
```
Symbol的唯一性，也是可以安全改写`instanceof`的的保证。
#### 一些没有记录的知识
1. 关于Symbol作为属性名，以及遍历时的情况
2. 关于其他内置的Symbol值的具体使用方式

这里没有记录这两部分，可以直接看「深入理解ES6」中Symbol一章。
### 总结
Symbol目前使用的频率比较少，而关于Symbol的全局作用域似乎有点走向过去没有模块，容易导致变量被覆盖的老路。React的实例代码中似乎也特意用了命名空间例如`react.element`。

参考文章：https://stackoverflow.com/questions/48347156/symbols-well-known-symbols-to-change-built-in-behavior
