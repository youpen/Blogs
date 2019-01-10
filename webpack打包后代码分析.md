
不管前端工具如何发展，如果你能分析并明白库的原理，这毫无疑问是一项永不过时的核心竞争力。

从这篇文章开始，我会逐步研究webpack的代码，而本文将从webpack打包后的代码作为切入点，开始webpack的分析。

本文demo的代码在 https://github.com/youpen/webpackStudy 依赖库的版本均以该demo的版本为准。

我们首先从最简单的代码开始，我们在`src`文件夹中新建一个`index.js`文件
```
// src/index.js
console.log('test');
```
然后执行`yarn build`打包，得到了下面的代码（删除了多余的注释）
```

(function (modules) { // webpackBootstrap
  // 新建用于缓存模块的对象
  var installedModules = {};
  // The require function
  function __webpack_require__(moduleId) {
    // 检查模块是否已经被加载过
    // 实际代码中，模块被重复引用很正常，由此可见webpack是用moduleId来防止重复打包
    // 可以想象作为moduleId的要求：全局唯一并且可识别
    if (installedModules[moduleId]) {
      // TODO return的exports有什么用呢？
      return installedModules[moduleId].exports;
    }
    // 新建module,并加入缓存
    // 此处用了连等（var a = b = 1），从可读性考虑当然不应该这么写，然而本来打包后的代码就没打算给你看:)
    var module = installedModules[moduleId] = {
      i: moduleId, // moduleId
      l: false, // 是否被加载过 // TODO 既然缓存可以判断，为什么还需要i
      exports: {} // TODO 用处？
    };
    // 开始执行模块中的代码，模块是指我们写的每个js文件
    // modules为自执行参数传入的参数，格式如下
    // {
    //   moduleId: function(module, exports) { /*模块中代码内容*/ }
    // }
    // 但这里我们发现传入了三个参数 // TODO 所以第三个参数有什么用？
    //
    modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
    // 表示模块中代码以及运行过了
    module.l = true;
    // TODO exports的用处到底是什么
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
2. 定义了__webpack_require__函数
3. 在__webpack_require__函数上添加属性 TODO属性解释?
4. 执行并返回__webpack_require__
  TODO __webpack_require__方法中需要解释
  1. 接受参数（目前推测为入口moduleId）
  2. 检查是否在缓存中（缓存中只有三个属性：moduleId，l标记，exports，并且此对象被赋值给module变量）,有的话直接返回exports,没有则加入缓存中
  3. 执行最外部自执行函数的moduleId对应的function,即执行模块代码内容

 // TODO exports为外界访问的入口，从目前来看，入口文件exports的内容可以在global访问
 // 即global中应该有exports对象，并且是入口文件的exports