#### JavaScript Inheritance Patterns

最近不停的在看各种库的源码，绝大多数都会用到prototype，
然而学习这个是很多年前的事，现在翻译David Shariff的一篇经典文章来温故知新。
原文http://davidshariff.com/blog/javascript-inheritance-patterns/#first-article


在这篇文章中，我将会介绍三种实现继承的翻译，你会看到类似Java的类继承。
在Java中，所有对象均是Class的实例，Class又可以继承自别的对象，而JavaScript有着天生的原型设计，一个对象可以继承自另一个对象。

##### Pseudoclassical pattern
P.S. 标题不知道怎么翻译，反正就是模仿class


