
不管前端工具如何发展，如果你能分析并明白库的原理，这毫无疑问是一项永不过时的核心竞争力。

从这篇文章开始，我会逐步研究webpack的代码，而本文将从webpack打包后的代码作为切入点，开始webpack的分析。

本文demo的代码在 https://github.com/youpen/webpackStudy 依赖库的版本均以该demo的版本为准。

#### 单个模块打包分析
---

我们首先从最简单的代码开始，我们在`src`文件夹中新建一个`index.js`文件,如果使用了github中的项目，可以直接使用`step_1/one-module`分支
```
// src/index.js
console.log('test');
```
然后执行`yarn build`打包，得到了下面的代码（删除了多余的注释）
```javascript
(function (modules) { // webpackBootstrap
                      // 新建用于缓存模块的对象
  var installedModules = {};
  // The require function
  function __webpack_require__(moduleId) {
    // 检查模块是否已经被加载过
    // 实际代码中，模块被重复引用很正常，由此可见webpack是用moduleId来防止重复打包
    // 可以想象作为moduleId的要求：全局唯一并且可识别
    if (installedModules[moduleId]) {
      return installedModules[moduleId].exports;
    }
    // 新建module,并加入缓存
    // 此处用了连等（var a = b = 1），从可读性考虑当然不应该这么写，然而本来打包后的代码就没打算给你看:)
    var module = installedModules[moduleId] = {
      i: moduleId, // moduleId
      l: false, // 是否被加载过 // TODO 既然缓存可以判断，为什么还需要i
      exports: {} // 即一个项目导出的变量
    };
    // 开始执行模块中的代码，模块是指我们写的每个js文件
    // modules为自执行参数传入的参数，格式如下
    // {
    //   moduleId: function(module, exports) { /*模块中代码内容*/ }
    // }
    // 但这里我们发现传入了三个参数 // TODO 所以第三个参数有什么用？
    // 由此可见，一个js文件中的this指向的是当前的exports对象
    // console.log(exports === this) //true
    // TODO 尝试this.a = 10, 看看引入变量知否能得到a
    modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
    // 表示模块中代码以及运行过了
    module.l = true;
    return module.exports;
  }
  // 下面在__webpack_require__中添加属性的过程都是初始化过程，

  // expose the modules object (__webpack_modules__)
  // 暴露出modules对象（__webpack_modules__），虽然我们的modules对象中只有一个模块，但是不难想象，modules是所有的模块的集合对象
  // TODO 这一步让我们可以从__webpack_require__中访问所有模块，但是用处是什么？什么地方会用到__webpack_require__
  __webpack_require__.m = modules;
  // 暴露出缓存对象
  __webpack_require__.c = installedModules;
  // define getter function for harmony exports
  // TODO harmony exports是什么意思？d是一个函数，什么时候执行？ 至少目前是完全看不懂的，我们后面回来再看
  __webpack_require__.d = function (exports, name, getter) {
    if (!__webpack_require__.o(exports, name)) {
      Object.defineProperty(exports, name, {
        configurable: false,
        enumerable: true,
        get: getter
      });
    }
  };
  // getDefaultExport function for compatibility with non-harmony modules
  // TODO ？？？？
  __webpack_require__.n = function (module) {
    var getter = module && module.__esModule ?
      function getDefault() {
        return module['default'];
      } :
      function getModuleExports() {
        return module;
      };
    __webpack_require__.d(getter, 'a', getter);
    return getter;
  };
  // Object.prototype.hasOwnProperty.call
  // TODO 一个包裹这hasOwnProperty的方法，为什么要包住？
  __webpack_require__.o = function (object, property) {
    return Object.prototype.hasOwnProperty.call(object, property);
  };
  // __webpack_public_path__
  // TODO ???
  __webpack_require__.p = "";
  // 加载模块并返回exports
  // 此处参数是一个赋值表达式，运算完后再传参
  return __webpack_require__(__webpack_require__.s = "./index.js");
})
(
  {
    "./index.js": (function (module, exports) { console.log('test'); })
  }
);

```
目前可以看到，打包的代码是一个自执行函数，参数为包含所有模块代码的一个对象，格式如下
```
     {
       moduleId1: function(module, exports) { /*模块中代码内容*/ },
       moduleId2: function(module, exports) { /*模块中代码内容*/ },
       moduleId3: function(module, exports) { /*模块中代码内容*/ },
       moduleId4: function(module, exports) { /*模块中代码内容*/ },
       ...
     }
```
然后执行了以下步骤：
1. 定义了缓存对象installedModules
   installedModules[moduleId] 格式如下
    ```json
       {
             i: moduleId, // moduleId
             l: false, // 是否被加载过
             exports: {} // exports包含了一个模块导出的所有变量
       }
    ```
2. 定义了__webpack_require__函数
3. 在__webpack_require__函数上添加属一系列属性
4. 执行并返回__webpack_require__
  1. 接受参数（目前推测为入口moduleId）
  2. 检查是否在缓存中，有的话直接返回exports,没有则加入缓存中，同时赋值给module变量（即当前正在处理的模块）
  3. 执行最外部自执行函数的参数中的moduleId对应的function,将this指向module.exports,
     同时传入三个参数（module, module.exports, __webpack_require__），然后执行模块代码内容

 // TODO exports为外界访问的入口，从目前来看，入口文件exports的内容可以在global访问
 // 即global中应该有exports对象，并且是入口文件的exports

此处是从打包中代码发现的一些小点
1. 每个js文件（module）都存在两个自有的变量（module和exports,所以和commonjs一样？）
2. 一个js文件中的this === exports, TODO 尝试this.a = 10, 看看引入变量知否能得到a
3. 待确认，如果不是入口模块，应该还有一个__webpack_require__变量？

#### 两个模块打包分析
---
从单个模块打包后的代码，有很多代码我们无从得知用处，毕竟多模块打包是webpack的核心功能，
我们现在尝试添加一个模块M1。
我们在添加一个文件`src/M1.js`,内容为
```javascript
export const M1 = 'I am M1';
```
然后再`src/index.js`中引入M1
```javascript
    import { M1 } from './M1';
    console.log(M1);
```
也可以直接使用`step_2/two-module`分支
然后执行`yarn build`.
得到如下代码（整理了格式，删除了部分不影响阅读的代码）
```javascript
(function (modules) {
  var installedModules = {};

  function __webpack_require__(moduleId) {
    if (installedModules[moduleId]) {
      return installedModules[moduleId].exports;
    }
    var module = installedModules[moduleId] = {
      i: moduleId,
      l: false,
      exports: {}
    };
    modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
    module.l = true;
    return module.exports;
  }
  // 删除了__webpack_require__上属性初始化过程，便于阅读
  return __webpack_require__(__webpack_require__.s = "./index.js");
})
(
  {
    "./M1.js": (
        function (module, __webpack_exports__, __webpack_require__) {
          "use strict";
          const M1 = 'I am M1';
          /* harmony export (immutable) */
          // 此处的__webpack_exports__即每个module的export对象，此处是用‘a’表示 // TODO a这个名字是怎么来的呢？
          // 使用了es6的import export就是harmony ？
          __webpack_exports__["a"] = M1;
        }
      ),
    "./index.js": (
        function (module, __webpack_exports__, __webpack_require__) {
          "use strict";
          // 设置__webpack_exports__.__esModule = true
          Object.defineProperty(__webpack_exports__, "__esModule", {value: true});
          /* harmony import */
          // 此处可以发现是递归的使用__webpack_require__，而__webpack_require__返回的是一个模块的exports对象，
          // 所以引用一个模块是得到了该模块的exports对象
          // __WEBPACK_IMPORTED_MODULE_0__M1__应该有一定命名规则，方便在本模块中使用外部模块
          var __WEBPACK_IMPORTED_MODULE_0__M1__ = __webpack_require__("./M1.js");
          console.log(__WEBPACK_IMPORTED_MODULE_0__M1__["a" /* M1 */]);
        }
      )
  }
);

```

引入了M1后，我们发现最外部自执行函数的内容还是一样的，变化的是该函数的参数，也是我们的阅读重点
我们发现参数中多了第三个参数`__webpack_require__`，从index.js中可以发现，这是根据index.js的依赖模块，递归的解析每个模块文件
内容的变化不多，唯一值得好奇的是`harmony import/export`，应该是与模块化的方式有关，我们使用commonJS修改一下`src/index.js`和`M1.js`.
```javascript
 // src/index.js
 const M1 = require('./M1');
 console.log(M1);
```

```javascript
  // src/M1.js
  const M1 = 'I am M1';
  module.exports.M1 = M1;
```
得到的代码中，变化的依旧是最外部自执行函数中的参数部分
```
   {
     "./M1.js": (
       function(module, exports) {
          const M1 = 'I am M1';
          module.exports.M1 = M1;
       }),
     "./index.js": (
       function(module, exports, __webpack_require__) {
          const M1 = __webpack_require__("./M1.js");
          console.log(M1);
       })
    }
```
可以发现代码变得简单，导出模块代码没有任何变化，直接使用了module和exports对象，和commonJS规范一致。
我们对比一下其中的区别：
    1. 参数名不同，`exports`和`__webpack_exports__`,但本质是一样的
    2. `__webpack_exports__`中添加了__esModule = true的属性
    3. 最本质的区别是调用外部模块的方式变了，commonJS是直接使用原始代码中的exports, 而ES6 module在M1模块的exports(即__webpack_exports__)中添加了新属性`a`，
        然后在`index.js`中使用`__webpack_exports__`中使用`a`。
        其实我们知道，commonJS导出的就是exports对象，我们可以在exports对象上添加属性，然后外部模块拿到exports直接使用上面的所有属性
        而ES Module中，我们可以不用命名的导出指定变量
        ```
            export const a = 1;
            export const b = 2;
        ```
        而在代码加载前，webpack并不知道变量a和变量b的名称，所以需要自己在exports对象中添加属性，供引入模块使用。
        而这个属性名是如何处理的，我们后面再看。
