#### AST Types
此模块提供了高效、模块化、兼容Esprima的AST继承类型的实现。

##### Installation
From NPM:
```javascript
    npm install ast-types
```
From GitHub:
```
    cd path/to/node_modules
    git clone git://github.com/benjamn/ast-types.git
    cd ast-types
    npm install .
```

Basic Usage
```javascript
var assert = require("assert");
var n = require("ast-types").namedTypes;
var b = require("ast-types").builders;

var fooId = b.identifier("foo");
var ifFoo = b.ifStatement(fooId, b.blockStatement([
    b.expressionStatement(b.callExpression(fooId, []))
]));

assert.ok(n.IfStatement.check(ifFoo));
assert.ok(n.Statement.check(ifFoo));
assert.ok(n.Node.check(ifFoo));

assert.ok(n.BlockStatement.check(ifFoo.consequent));
assert.strictEqual(
    ifFoo.consequent.body[0].expression.arguments.length,
    0);

assert.strictEqual(ifFoo.test, fooId);
assert.ok(n.Expression.check(ifFoo.test));
assert.ok(n.Identifier.check(ifFoo.test));
assert.ok(!n.Statement.check(ifFoo.test));
```

##### 遍历AST

本库深入了AST类型系统，并提供了卓越的节点遍历机制。
如果你想彻底控制整个遍历过程，你需要枚举AST中所有已知的字段并且获得他们的值，你会需要`getFieldNames`和`getFieldValue`这两个方法
```javascript
// const types = require('ast-types');
import recast from 'recast';
const types = recast.types;
const partialFunExpr = { type: 'FunctionExpression' };

// 即使partialFunExpr没有包含所有FunctionExpression所需要的字段
// 但是getFieldNames可以识别出该类型的其他字段
console.log(types.getFieldNames(partialFunExpr));
// [ 'type',
//   'id',
//   'params',
//   'body',
//   'generator',
//   'expression',
//   'defaults',
//   'rest',
//   'async',
//   'returnType',
//   'typeParameters' ]

// 对于有默认值的的字段， getFieldValue方法会返回该字段的默认值
console.log(types.getFieldValue(partialFunExpr, 'generator'))
// false
```
此外，还提供了两个基于`getFieldNames`和`getFieldValue`的辅助函数，`eachField`和`someField`。
```javascript
// 遍历一个object中定义的所有字段（包括尚未被定义的字段），这些字段的名称和值会被传入callback的参数之中，
// 如果这个object未被Def(译者注：见def文件)定义，callback则不会执行

exports.eachField = function(object, callback, context) {
  getFieldNames(object).forEach(function(name) {
    callback.call(this, name, getFieldValue(object, name))
  }, context)
}

// 类似于eachField，区别在于，callback中返回一个真值，遍历便会停止
// （类似Array.prototype.some，最终的返回结果是true或者false取决于callback是否会为其中任意一个元素返回true）
// 原文如下
// Similar to eachField, except that iteration stops as soon as the
// callback returns a truthy value. Like Array.prototype.some, the final
// result is either true or false to indicates whether the callback
// returned true for any element or not.
// 难翻译的地方在于indicate这个词有'表明'和‘作为xx的标记(代表着)’这两种因果顺序不同的意思
// colins: indicate: If one thing indicates something else, it is a sign of that thing
exports.someField = function(object, callback, context) {
  return getFieldNames(object).some(function(object, callback, context) {
    return callback.call(this, name, getFieldValue(object, name))
  }, context);
};
```
下面是如何拷贝一个AST node的例子：
```javascript
var copy = {};
require('ast-types').eachField(node, function(name, value) {
  // 注意在node定义中的字段，即使没有定义的字段也会被访问，合适的默认值会被赋值
  copy[name] = value;
})
```

上面这些不是全部，我们提供了更方便和强大的`types.visit`抽象来遍历整个语法树。
下面是一个小例子，用于查找所有没有被使用的`arguments.callee`
```javascript

var assert = require('assert');
var types = require('ast-types');
var n = types.namedTypes;

types.visit(ast, {
  // 当某个node的type为‘MemberExpression’,下面这个方法会被调用
  visitMemberExpression: function(path) {
    // visitor方法接受一个参数 - 一个NodePath对象
    var node = path.node;
    if (n.Identifier.check(node.object) &&
        node.object.name === 'arguments' &&
        n.Identifier.check(node.property)
       ) {
        assert.notStrictEqual(node.property.name, 'callee');
    }
    this.traverse(path);
  }
});
```

下面展示了将`...rest`参数转换为浏览器兼容的ES5代码的例子
```javascript
var b = types.builders;



```


##### NodePath
`NodePath`是一个包裹着AST node的对象， 通过它可以访问父节点和祖先节点（即从根节点到当前节点的chain），还提供了一些scope的信息。
一般来说，path.node引用了被包裹的node，path.parent.node指向父node, path.parent.parent.node以此类推
注意path.node可能不是path.parent.node的直接属性(即： path.node !== path.parent.node.xxx)，例如，path.node是父node数组中的一个元素，
```javascript
path.node === path.parent.node.elements[3]
```

path.parentPath提供了颗粒化的方法访问从AST根节点开始的整个路径
（译者注： 我用实际代码运行时，文档中的element数组实际上是指body数组，下面用body代替原文中的element）
```javascript

// 事实上，path.parentPath 是 path 的 grandparent
// 译者注： path.parentPath实际是上是body数组
path.parentPath.parentPath === path.parent

// path.parentPath 对象包裹着body数组(注意到我们使用 .value， 因为body数组不是一个Node)
// 译者注： path包裹着node节点，里面有个body数组，path.parentPath.value就是这个数组
path.parentPath.value === path.parent.node.elements

// path.node对象是这个数组的第四个元素 // TODO 待研究
path.parentPath.value[3] === path.node


// path.name是在body数组中的索引 // TODO 待研究
path.name === 3

// 同样的，path.parentPath.name是path.parent.node的名字 // TODO 好像有问题
path.parentPath.name === 'body'

// 因为path.parentPath不是一个node节点，本身没有.node属性，所以path.parentPath.node指向最近的父node
path.parentPath.node === path.parent.node

path.parent.node[path.parentPath.name][path.name] === path.node

```
这些`NodePath`对象是在遍历过程中创建的，并没有修改AST node，相同的node在AST出现不止一次也不会有影响，因为该node每次出现时，会被不同的NodePath对象所访问

子NodePath对象会被懒加载，通过调用父NodePath对象的`.get`方法
```javascript
// 如果一个NodePath对象之前未被创建过，它会被创建然后被缓存
path.get('body').get(3).value === path.value.elements[3] 

// 此外，你也可以传递多个属性名而不是重复的链式调用
path.get('body', 0).value === path.value.body[0]
```

`NodePath`对象提供了一系列实用的方法

```javascript
// 替换node
var fifth = path.get('body', 4);
fifth.replace(newNode)

// 现在做一些重新排列列表的事情，这种替换依然是安全的
fiftth.replace(newerNode)

// 用两个新node替换旧node
path.get("elements", 2).replace(
    b.identifier("foo"),
    b.thisExpression()
);

// 移除一个node，如果这会留下多余的AST node,则移除其父node
// e.g. var t = 1, y = 2, 移除`t`和`y`会导致`var undefined`
path.prune(); // 返回最近的parent NodePath

// 移除一个node
path.get('body', 3).replace()

// 头部添加三个新node
path.get("elements").unshift(a, b, c);

// 移除并返回第一个node
path.get("elements").shift();

// 尾部添加两个node
path.get("elements").push(d, e);

// 移除并返回最后一个node
path.get("elements").pop();

// Insert a new node before/after the seventh node in a list of nodes:
// 将一个新node插入第七个node 之前/之后
var seventh = path.get("elements", 6);
seventh.insertBefore(newNode);
seventh.insertAfter(newNode);

// 将一个新元素插入index为5的位置
path.get("elements").insertAt(5, newNode);
```
