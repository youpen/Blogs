当我第一次看webpack源码的时候，会被其中跳转频繁的源码所迷惑，很多地方不断点甚至找不到头绪，因为plugin是事件系统，。这一切都是因为没有先去了解webpack的依赖库Tapable。
Tapble是webpack在打包过程中，控制打包在什么阶段调用Plugin的库，是一个典型的观察者模式的实现，但实际又比这复杂。
为了能让读者最快了解Tapable的基本用法，我们先用一个最简单的demo代码作为示例，然后通过增加需求来一步步了解用法。
> P.S. 由于Tapable0.28和Tapable1.0之后的实现已经完全不一样，此处均以Tapable2.0为准

**Tapable的核心功能就是控制一系列注册事件之间的执行流控制**，比如我注册了三个事件，我可以希望他们是并发的，或者是同步依次执行，又或者其中一个出错后，后面的事件就不执行了，这些功能都可以通过tapable的hook实现，我们会在后面详细讲解。
#### 基本用法
```
const { SyncHook } = require("tapable");

// 为了便于理解，取名为EventEmitter
const EventEmitter = new SyncHook();

// tap方法用于注册事件， 其中第一个参数仅用作注释，增加可读性，源码中并没有用到这个变量
EventEmitter.tap('Event1', function () {
  console.log('Calling Event1')
});
EventEmitter.tap('Event2', function () {
  console.log('Calling Event2')
});
EventEmitter.call();
```
这就是最基础的SyncHook用法，基本和前端的EventListener一样。
除了SyncHook，Tapable还提供了一系列别的Hook
```
  SyncBailHook,
  SyncWaterfallHook,
  SyncLoopHook,
  AsyncParallelHook,
  AsyncParallelBailHook,
  AsyncSeriesHook,
  AsyncSeriesBailHook,
  AsyncSeriesWaterfallHook
```
这些Hook我们会在后面进行分析。
#### Tapable的“compile”
假设我们有一个需求，如果我们在两个事件中都需要用到公用变量
```
const { SyncHook } = require("tapable");

// 为了便于理解，取名为EventEmitter
const EventEmitter = new SyncHook(['arg1', 'arg2']);

// tap方法用于注册事件， 其中第一个参数仅用作注释，增加可读性，源码中并没有用到这个变量
EventEmitter.tap('Event1', function (param1, param2) {
  console.log('Calling Event1');
  console.log(param1);
  console.log(param2);
});
EventEmitter.tap('Event2', function (param1, param2) {
  console.log('Calling Event2');
  console.log(param1)
  console.log(param2)
});
const arg1 = 'test1';
const arg2 = 'test2';
EventEmitter.call(arg1, arg2);
// 打印结果
// Calling Event1
// test1
// test2
// Calling Event2
// test1
// test2
```
从上面代码可以看出，我们在新建SyncHook实例时传入一个数组，数组的每一项是我们所需公共变量的形参名。然后在call方法中传入相应数量参数。在打印结果中可以看到， 每个事件回调函数都可以获得正确打印变量arg1和arg2。


但是细心的读者会疑惑，`new SyncHook(['arg1', 'arg2'])`中传入的数组似乎没有必要。这其实和Tapable的实现方式有关。我们尝试在在`new SyncHook()`中不传入参数，直接在call传入arg1和arg2。
```
const EventEmitter = new SyncHook();
...
...
EventEmitter.call(arg1, arg2);
// 打印结果
// Calling Event1
// undefined
// undefined
// Calling Event2
// undefined
// undefined
```
事件回调函数并不能获取变量。
其实当调用`call`方法时，Tapable内部通过字符串拼接的方式，“编译”了一个新函数，并且通过缓存的方式保证这个函数只需要编译一遍。

Tapable的xxxHook均继承自基类`Hook`，我们直接点进`call`方法可以发现`this.call = this._call`，而`this._call`在`Hook.js`的底部代码被定义的，也就是`createCompileDelegate`的值，

```
Object.defineProperties(Hook.prototype, {
	_call: {
		value: createCompileDelegate("call", "sync"),
		configurable: true,
		writable: true
	},
	_promise: {
		value: createCompileDelegate("promise", "promise"),
		configurable: true,
		writable: true
	},
	_callAsync: {
		value: createCompileDelegate("callAsync", "async"),
		configurable: true,
		writable: true
	}
});
```
`createCompileDelegate`的定义如下
```
function createCompileDelegate(name, type) {
	return function lazyCompileHook(...args) {
		this[name] = this._createCall(type);
		return this[name](...args);
	};
}
```
可见`this._call`的值为函数`lazyCompileHook`，当我们第一次调用的时候调用的时候实际是`lazyCompileHook(...args)`，并且我们知道闭包变量`name === 'call'`, 所以`this.call`的值被替换为`this._createCall(type)`。
`this._createCall`和`this.compile`的定义如下
```
	_createCall(type) {
		return this.compile({
			taps: this.taps,
			interceptors: this.interceptors,
			args: this._args,
			type: type
		});
	}
	compile(options) {
		throw new Error("Abstract: should be overriden");
	}
```
所以`this.call`最终的返回值由衍生类自行实现，我们看一下`SyncHook`的定义
```
const Hook = require("./Hook");
const HookCodeFactory = require("./HookCodeFactory");

class SyncHookCodeFactory extends HookCodeFactory {
	content({ onError, onResult, onDone, rethrowIfPossible }) {
		return this.callTapsSeries({
			onError: (i, err) => onError(err),
			onDone,
			rethrowIfPossible
		});
	}
}

const factory = new SyncHookCodeFactory();

class SyncHook extends Hook {
	tapAsync() {
		throw new Error("tapAsync is not supported on a SyncHook");
	}

	tapPromise() {
		throw new Error("tapPromise is not supported on a SyncHook");
	}

	compile(options) {
		factory.setup(this, options);
		return factory.create(options);
	}
}
```
可以发现this.call的值最终其实由工厂类`SyncHookCodeFactory`的`create`方法返回
```
	create(options) {
		this.init(options);
		let fn;
		switch (this.options.type) {
			case "sync": // 目前我们只关心Sync
				fn = new Function(
					this.args(),
					'"use strict";\n' +
						this.header() +
						this.content({
							onError: err => `throw ${err};\n`,
							onResult: result => `return ${result};\n`,
							onDone: () => "",
							rethrowIfPossible: true
						})
				);
				console.log(fn.toString()); // 此处打印fn
				break;
			case "async":
				fn = new Function(
					this.args({
						after: "_callback"
					}),
					'"use strict";\n' +
						this.header() +
						this.content({
							onError: err => `_callback(${err});\n`,
							onResult: result => `_callback(null, ${result});\n`,
							onDone: () => "_callback();\n"
						})
				);
				break;
			case "promise":
				let code = "";
				code += '"use strict";\n';
				code += "return new Promise((_resolve, _reject) => {\n";
				code += "var _sync = true;\n";
				code += this.header();
				code += this.content({
					onError: err => {
						let code = "";
						code += "if(_sync)\n";
						code += `_resolve(Promise.resolve().then(() => { throw ${err}; }));\n`;
						code += "else\n";
						code += `_reject(${err});\n`;
						return code;
					},
					onResult: result => `_resolve(${result});\n`,
					onDone: () => "_resolve();\n"
				});
				code += "_sync = false;\n";
				code += "});\n";
				fn = new Function(this.args(), code);
				break;
		}
		this.deinit();
		return fn;
	}
```
这里利用Function的构造函数形式，并且传入字符串拼接生产函数，这在我们平时开发中用得比较少，我们直接打印一下最终返回的fn，也就是this.call的实际值。
```
function anonymous(/*``*/) {
  "use strict";
  var _context;
  // _x为存储注册回调函数的数组
  var _x = this._x;
  var _fn0 = _x[0];
  _fn0();
  var _fn1 = _x[1];
  _fn1();
}
```
到这里为止一目了然，我们可以看到我们的注册回调是怎样在this.call方法中一步步执行的。
至于为什么要用这种曲折的方法实现`this.call`，我们在文末在进行介绍，
接下来我们就通过打印`fn`来看看Tapable的一系列Hook函数的实现。

#### Tapable的xxxHook方法解析
Tapable有一系列Hook方法，但是这么多的Hook方法都是无非是为了控制注册事件的**执行顺序**以及**异常处理**。
##### Sync
最简单的`SyncHook`前面已经讲过，我们从`SyncBailHook`开始看。
###### SyncBailHook
```
const { SyncBailHook } = require("tapable");

const EventEmitter = new SyncBailHook();

EventEmitter.tap('Event1', function () {
	console.log('Calling Event1')
});
EventEmitter.tap('Event2', function () {
	console.log('Calling Event2')
});
EventEmitter.call();

// 打印fn
function anonymous(/*``*/) {
	"use strict";
	var _context;
	var _x = this._x;
	var _fn0 = _x[0];
	var _result0 = _fn0();
	if (_result0 !== undefined) {
		return _result0;
	} else {
		var _fn1 = _x[1];
		var _result1 = _fn1();
		if (_result1 !== undefined) {
			return _result1;
		} else {
		}
	}
}
```
通过打印fn，我们可以轻易的看出，SyncBailHook提供了中止注册函数执行的机制，只要在某个注册回调中返回一个非undefined的值，运行就会中止。
Tap这个单词除了轻拍的意思，还有水龙头的意思，相信取名为Tapable的意思就是表示这个是一个事件流控制库，而Bail有保释和舀水的意思，很容易明白这是带中止机制的一个Hook。

###### SyncWaterfallHook
```
const { SyncWaterfallHook } = require("tapable");

const EventEmitter = new SyncWaterfallHook(['arg1']);

EventEmitter.tap('Event1', function () {
	console.log('Calling Event1')
	return 'Event1returnValue'
});
EventEmitter.tap('Event2', function () {
	console.log('Calling Event2')
});
EventEmitter.call();

// 打印fn
function anonymous(arg1) {
	"use strict";
	var _context;
	var _x = this._x;
	var _fn0 = _x[0];
	var _result0 = _fn0(arg1);
	if (_result0 !== undefined) {
		arg1 = _result0;
	}
	var _fn1 = _x[1];
	var _result1 = _fn1(arg1);
	if (_result1 !== undefined) {
		arg1 = _result1;
	}
	return arg1;
}
```
可以看出`SyncWaterfallHook `就是将上一个事件注册回调的返回值作为下一个注册函数的参数，这就要求在`new SyncWaterfallHook(['arg1']);`需要且只能传入一个形参。

###### SyncLoopHook
```
const { SyncLoopHook } = require("tapable");

const EventEmitter = new SyncLoopHook(['arg1']);

let counts = 5;
EventEmitter.tap('Event1', function () {
	console.log('Calling Event1');
	counts--;
	console.log(counts);
	if (counts <= 0) {
		return;
	}
	return counts;
});
EventEmitter.tap('Event2', function () {
	console.log('Calling Event2')
});
EventEmitter.call();

// 打印fn
function anonymous(arg1) {
	"use strict";
	var _context;
	var _x = this._x;
	var _loop;
	do {
		_loop = false;
		var _fn0 = _x[0];
		var _result0 = _fn0(arg1);
		if (_result0 !== undefined) {
			_loop = true;
		} else {
			var _fn1 = _x[1];
			var _result1 = _fn1(arg1);
			if (_result1 !== undefined) {
				_loop = true;
			} else {
				if (!_loop) {
				}
			}
		}
	} while (_loop);
}
// 打印结果
// Calling Event1
// 4
// Calling Event1
// 3
// Calling Event1
// 2
// Calling Event1
// 1
// Calling Event1
// 0
// Calling Event2
```
```SyncLoopHook```只有当上一个注册事件函数返回undefined的时候才会执行下一个注册函数，否则就不断重复调用。

##### Async
Async系列的Hook在每个函数提供了next作为回调函数，用于控制异步流程

###### AsyncSeriesHook
Series有顺序的意思，这个Hook用于按顺序执行异步函数。
```
const { AsyncSeriesHook } = require("tapable");

const EventEmitter = new AsyncSeriesHook();

// 我们从将tap改为tapAsync，专门用于异步处理，并且只有tapAsync提供了next的回调函数
EventEmitter.tapAsync('Event1', function (next) {
	console.log('Calling Event1');
	setTimeout(
		() => {
			console.log('AsyncCall in Event1')
			next()
		},
		1000,
	)
});
EventEmitter.tapAsync('Event2', function (next) {
	console.log('Calling Event2');
	next()
});

//此处传入最终完成的回调
EventEmitter.callAsync((err) => {
	if (err) { console.log(err); return; }
	console.log('Async Series Call Done')
});
// 打印fn
function anonymous(_callback) {
	"use strict";
	var _context;
	var _x = this._x;
	var _fn0 = _x[0];
	_fn0(_err0 => {
		if (_err0) {
			_callback(_err0);
		} else {
			var _fn1 = _x[1];
			_fn1(_err1 => {
				if (_err1) {
					_callback(_err1);
				} else {
					_callback();
				}
			});
		}
	});
}

// 打印结果
// Calling Event1
// AsyncCall in Event1
// Calling Event2
// Async Series Call Done


```
从打印结果可以发现，两个事件之前是串行的，并且next中可以传入err参数，当传入err，直接中断异步，并且将err传入我们在call方法传入的完成回调函数中。

###### AsyncParallelHook
```
const { AsyncParallelHook } = require("tapable");

const EventEmitter = new AsyncParallelHook();

// 我们从将tap改为tapAsync，专门用于异步处理，并且只有tapAsync提供了next的回调函数
EventEmitter.tapAsync('Event1', function (next) {
	console.log('Calling Event1');
	setTimeout(
		() => {
			console.log('AsyncCall in Event1')
			next()
		},
		1000,
	)
});
EventEmitter.tapAsync('Event2', function (next) {
	console.log('Calling Event2');
	next()
});

//此处传入最终完成的回调
EventEmitter.callAsync((err) => {
	if (err) { console.log(err); return; }
	console.log('Async Series Call Done')
});

// 打印fn
function anonymous(_callback) {
	"use strict";
	var _context;
	var _x = this._x;
	do {
		var _counter = 2;
		var _done = () => {
			_callback();
		};
		if (_counter <= 0) break;
		var _fn0 = _x[0];
		_fn0(_err0 => {
            // 调用这个函数的时间不能确定，有可能已经执行了接下来的几个注册函数
			if (_err0) {
                // 如果还没执行所有注册函数，终止
				if (_counter > 0) {
					_callback(_err0);
					_counter = 0;
				}
			} else {
                // 同样，由于函数实际调用时间无法确定，需要检查是否已经运行完毕，
				if (--_counter === 0) _done();
			}
		});
        // 执行下一个注册回调之前，检查_counter是否被重置等，如果重置说明某些地方返回err，直接终止。
		if (_counter <= 0) break;
		var _fn1 = _x[1];
		_fn1(_err1 => {
			if (_err1) {
				if (_counter > 0) {
					_callback(_err1);
					_counter = 0;
				}
			} else {
				if (--_counter === 0) _done();
			}
		});
	} while (false);

}

// 打印结果
// Calling Event1
// Calling Event2
// AsyncCall in Event1
// Async Series Call Done
```
从打印结果看出Event2的调用在AsyncCall in Event1之前，说明异步事件是并发的。

剩下的`AsyncParallelBailHook, AsyncSeriesBailHook, AsyncSeriesWaterfallHook`其实大同小异，类比Sync系列即可。