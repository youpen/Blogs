#### 实现一个webpack-loader
---
阅读复杂工具的源码总是痛苦的，
为了减少这种痛苦，我每次看源码时必须非常熟悉这些工具的用法。
然而配置一份webpack真的能让你熟悉webpack吗？答案是不能，了解loader和plugin并不能帮助你理解webpack本身，
除非你亲自写一个loader/plugin。

当我开始准备写一个plugin时，看到文档有一句，
```
Building plugins is a bit more advanced than building loaders, because you'll need to understand some of the Webpack low-level internals to hook into them.
```
于是转头开始写一个loader，看源码这种事情，总是从简单的地方开始的好。

本文所有的demo代码均在https://github.com/youpen/DemoLoader

#### loader的本质
官方文档对于实现loader有一份文档，建议大家先看看。
https://webpack.js.org/contribute/writing-a-loader/

文档中说loader是一个node模块，并且这个模块导出一个函数。
```
    A loader is a node module that exports a function
```
那么我新建一个demoLoader.js，并且这个js导出一个function，这就是一个loader的骨架了。
```javascript
    // demoLoader.js
    module.exports = function () {}
```

#### 使用loader
在loader中使用path来resolve模板路径即可使用我们的loader
```javascript
    module.exports = {
      //...
      module: {
        rules: [
          {
            test: /\.js$/,
            use: [
              {
                loader: path.resolve('./loader/demoLoader.js')
              }
            ]
          }
        ]
      }
    };
```

具体webpack配置见github代码
其中我们测试的代码内容如下
```javascript
    // 入口文件 src/index.js
    import { M1 } from './M1';
    console.log(M1);

    // M1模块 src/M1.js
    export const M1 = 'I am M1';
```


#### loader的参数和递归
作为一个loader，当然是要接受代码字符串，然后返回一个新字符串。我们这样修改一下
`
```javascript
    // demoLoader.js
    module.exports = function (params) {
      console.log('arguments===>', arguments);
      return params;
    }
```
`yarn build`得到log

```
arguments===> { '0': 'import { M1 } from \'./M1\';\nconsole.log(M1);\n' }
arguments===> { '0': 'export const M1 = \'I am M1\';\n' }
```
从这里我们可以看出，loader会被每个模块递归的调用，每次接受一个参数，第一个为入门js文件的字符串内容。
但是如果我们直接返回一个普通字符串，例如
```javascript
    // demoLoader.js
    module.exports = function (params) {
      console.log('arguments===>', arguments);
      return 'test';
    }
```
会发现递归停止，可见webpack会每次解析loader返回的字符串，如果当中含有别的依赖，则递归调用loader，
即loader的执行也遵循模块依赖顺序。
