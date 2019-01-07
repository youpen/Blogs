#### 在chrome devtools中访问闭包变量

有一天用chrome debug的时候，发现一个一直被我主动忽略的一个小问题(其实是懒)。
就是使用chrome访问闭包变量的时候，有时候无法在控制台访问。
突然心血来潮决定研究。
简单点的例子如下
```
    (function() {
        var foo = 1;
        function test() {
            debugger;
        }
        test()
    }());

```
当我们放在chrome的Sinppets中运行的时候，我们发现我们并不能访问变量foo。

￼![image](https://github.com/youpen/Blogs/blob/dev/images/Screen%20Shot%202018-11-29%20at%203.07.17%20PM.png?raw=true)

于是google一下，发现这个问题有人早就提了issue。
大意就是，这个V8的一个优化。V8引擎会根据代码情况，将变量分配给当前的stack或者在堆内存中的context对象中。
大概的情况有这几种：
1. 如果闭包变量没有被使用，变量会分配在变量所在的的stack中
就像上面的例子的代码。当前context无法直接访问。
2. 如果闭包变量被使用，变量就会分配在context当中，可以直接访问。

￼![image](https://github.com/youpen/Blogs/blob/dev/images/Screen%20Shot%202018-11-29%20at%203.05.14%20PM.png?raw=true)


好了，说了这么多也没解决我的问题，有没有方法能在不修改代码的情况下也能看到呢。


1. 切换当前的Call Stack

￼![image](https://github.com/youpen/Blogs/blob/dev/images/Screen%20Shot%202018-11-29%20at%203.05.22%20PM.png?raw=true)

这样就可以访问当前stack的变量

2. 通过scope

上面的代码很简单，而实际开发的时候会比较复杂，我们可能在class里的方法中访问import进来的变量或者函数，这时候切换调用栈可能也没用

￼![image](https://github.com/youpen/Blogs/blob/dev/images/Screen%20Shot%202018-11-29%20at%203.05.30%20PM.png?raw=true)

例如上面这种情况，我想访问访问，甚至是在控制台调用cfg就很尴尬了。
这时候可以通过右边scope寻找变量，一般名字会被修改例如添加_等。

￼![image](https://github.com/youpen/Blogs/blob/dev/images/Screen%20Shot%202018-11-29%20at%203.05.38%20PM.png?raw=true)

发现_config中有cfg（也可以察觉到有esModule属性的可能是import进来的模块），然后右键存为全局变量，就可以在控制台调用cfg方法了。

![image](https://github.com/youpen/Blogs/blob/dev/images/Screen%20Shot%202018-11-29%20at%203.05.45%20PM.png?raw=true)
￼

参考资料：
https://bugs.chromium.org/p/v8/issues/detail?id=3491
