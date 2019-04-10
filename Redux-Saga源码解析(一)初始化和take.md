`Redux-Saga`是目前为止，管理`Redux`的`SideEffect`最受欢迎的一个库，其中基于`Generator`的内部实现更是让人好奇，下面我会从入口开始，一步步剖析这其中神奇的地方。为了节省篇幅，下面代码中的源码部分做了大量精简，只保留主流程的代码。

## 一. 初始化流程和take方法
#### 修改官方Demo
我们首先从官网fork一份`Redux-Saga`代码，然后在其中的`examples/counter`这个demo中开始我们的源码之旅。按照文档中的介绍运行起来。
demo中用了`takeEvery`这个API，为了简单期见，我们将`takeEvery`改为使用`take`。
```js
// counter/src/sagas/index.js

export default function* rootSaga() {
  while (true) {
    yield take('INCREMENT_ASYNC')
    yield incrementAsync()
  }
}
```

#### 初始化第一步:createSagaMiddleware
然后我们回到`counter/src/main.js`
其中与saga有关的代码只有这些部分
```
import createSagaMiddleware from 'redux-saga'

import Counter from './components/Counter'
import reducer from './reducers'
import rootSaga from './sagas'

const sagaMiddleware = createSagaMiddleware()
const store = createStore(reducer, applyMiddleware(sagaMiddleware))
sagaMiddleware.run(rootSaga)
```
其中`createSagaMiddleware`位于根目录的`packages/core/src/internal/middleware.js`，
>这里需要提及一下，`Redux-Saga`和`React`一样采用了monorepo的组织结构，也就是多仓库的结构。

```js
// packages/core/src/internal/middleware.js
// 为了简洁，删除了很多检查代码
export default function sagaMiddlewareFactory({ context = {}, channel = stdChannel(), sagaMonitor, ...options } = {}) {
  let boundRunSaga

  function sagaMiddleware({ getState, dispatch }) {
    boundRunSaga = runSaga.bind(null, {
      ...options,
      context,
      channel,
      dispatch,
      getState,
      sagaMonitor,
    })

    return next => action => {
      // 这里是dispatch函数
      if (sagaMonitor && sagaMonitor.actionDispatched) {
        sagaMonitor.actionDispatched(action)
      }
      // 从这里就可以看出来，先触发reducer，然后才再处理action，所以side effect慢于reducer
      const result = next(action) // hit reducers
      channel.put(action)
      return result
    }
  }

  sagaMiddleware.run = (...args) => {
    return boundRunSaga(...args)
  }

  sagaMiddleware.setContext = props => {
    assignWithSymbols(context, props)
  }

  // 这里本质上是标准redux middleware格式，即middlewareAPI => next => action => ...
  return sagaMiddleware
}
```
`createSagaMiddleware`是构建`sagaMiddleware`的工厂函数，我们在这个工厂函数里面需要注意3点：
1. 注册`middleware`
真正给`Redux`使用的`middleware`就是内部的`sagaMiddleware`方法，`sagaMiddleware`最后也返回标准的`Redux Middleware`格式的方法，如果对`Redux Middleware`格式不了解可以看一下[这篇文章](https://github.com/youpen/Blogs/blob/dev/Redux%E6%BA%90%E7%A0%81%E8%AE%B0%E5%BD%95.md)。
需要注意的是，`middleware`是先触`发reducer`(就是`next`)，然后才调用`channel.put(action)`，**也就是一个action发出，先触发reducer，然后才触发saga监听**。
这里我们先记住，当触发一个`action`，这里的`channel.put`就是`saga`监`听actio`n的起点。
2. 调用`runSaga`
sagaMiddleware.run实际上就是runSaga方法
3. `channel`参数
  `channel`在这里看似是每次创建新的，但实际上整个saga只会`在sagaMiddlewareFactory`的参数中创建一次，后面会挂载在一个叫`env`的对象上重复使用，可以当做是一个单例理解。

#### 初始化第二步: runSaga
下面简化后的`runSaga`函数
```js
export function runSaga(
  { channel = stdChannel(), dispatch, getState, context = {}, sagaMonitor, effectMiddlewares, onError = logError },
  saga,
  ...args
) {
  // saga就是应用层的rootSaga，是一个generator
  // 返回一个iterator
  // 从这里可以发现，runSaga的时候可以传入更多参数，然后在saga函数中可以获取
  const iterator = saga(...args)

  const effectId = nextSagaId()

  let finalizeRunEffect
  if (effectMiddlewares) {
    const middleware = compose(...effectMiddlewares)
    finalizeRunEffect = runEffect => {
      return (effect, effectId, currCb) => {
        const plainRunEffect = eff => runEffect(eff, effectId, currCb)
        return middleware(plainRunEffect)(effect)
      }
    }
  } else {
    finalizeRunEffect = identity
  }

  const env = {
    channel,
    dispatch: wrapSagaDispatch(dispatch),
    getState,
    sagaMonitor,
    onError,
    finalizeRunEffect,
  }

  return immediately(() => {
    const task = proc(env, iterator, context, effectId, getMetaInfo(saga), /* isRoot */ true, noop)

    if (sagaMonitor) {
      sagaMonitor.effectResolved(effectId, task)
    }

    return task
  })
}
```
`runSaga`主要做了这几件事情
1. 运行传入`runSaga`方法的`rootSaga`函数，保存返回的`iterator`
2. 调用`proc`，并将上面`rootSaga`运行后返回的`iterator`传入`proc`方法中

> 此处要对Generator有一定了解， 建议阅读[https://davidwalsh.name/es6-generators-dive](https://davidwalsh.name/es6-generators-dive)系列，其中[第二篇文章](https://github.com/youpen/Blogs/blob/dev/%E6%B7%B1%E5%85%A5%E7%90%86%E8%A7%A3Generator(%E8%AF%91%E6%96%87).md)
我翻译了一下。
#### proc方法
`proc`是整个`saga`运行的核心方法，笼统一点说，这个方法无非做了一件事，根据情况不停的调用`iterator`的`next`方法。也就是不断执行`saga`函数。

这时候我们回到我们的demo代码的`saga`部分。
```js
import { put, take, delay } from 'redux-saga/effects'

export function* incrementAsync() {
  yield delay(1000)
  yield put({ type: 'INCREMENT' })
}

export default function* rootSaga() {
  while (true) {
    yield take('INCREMENT_ASYNC', incrementAsync)
  }
}
```

当第一次调用next的时候，我们调用了take方法，现在来看一下take方法做了些什么事情。

`take`等`effect`相关的API在位置`packages/core/src/internal/io.js`，但是为了方便`code spliting`，`effect`部分代码在默认使用了`packages/core/dist`中已经被打包的代码。如果想在debug中运行到原来代码，需要将`packages/core/effects.js`中的`package.json`文件修改为未打包文件。具体可以参考git中的历史修改记录。

```js
// take方法
export function take(patternOrChannel = '*', multicastPattern) {
  // 在我们的demo代码中，只会走下面这个分支
  if (is.pattern(patternOrChannel)) {
    return makeEffect(effectTypes.TAKE, { pattern: patternOrChannel })
  }
  if (is.multicast(patternOrChannel) && is.notUndef(multicastPattern) && is.pattern(multicastPattern)) {
    return makeEffect(effectTypes.TAKE, { channel: patternOrChannel, pattern: multicastPattern })
  }
  if (is.channel(patternOrChannel)) {
    return makeEffect(effectTypes.TAKE, { channel: patternOrChannel })
  }
}
```
当第一次执行`take`方法，我们发现`take`方法只是简单的返回了一个由makeEffect制造的plain object
```js
{
  "@@redux-saga/IO": true,
  "combinator": false,
  "type": "TAKE",
  "payload": {
    "pattern": "INCREMENT_ASYNC"
  }
}
```
然后我们回到proc方法，整个流程大概是这样的

![proc方法流程图](https://user-gold-cdn.xitu.io/2019/4/10/16a060fd531c769f?w=412&h=574&f=png&s=26128)
只要`iterator.next().done`不为`true`，`proc`方法就会一直上面的流程。
`digestEffect`和`runEffect`是一些分支处理和回调的封装，在我们目前的主流程可以先忽略，下面我们以`take`为例，看看`take`是怎么监听`action`的

在next方法中执行了一次`iterator.next()`后，然后`makeEffect`得到`take Effect`的`plain object`（我们后面简称`take`的`effect`）。然后在通过`digestEffect`和`runEffect`，运行`runTakeEffect`
```js
// runTakeEffect
function runTakeEffect(env, { channel = env.channel, pattern, maybe }, cb) {
  const takeCb = input => {
    // 后面我们会知道，这里的input就是action
    if (input instanceof Error) {
      cb(input, true)
      return
    }
    if (isEnd(input) && !maybe) {
      cb(TERMINATE)
      return
    }
    cb(input)
  }
  try {
    // 主要功能就是调用channel的take方法
    channel.take(takeCb, is.notUndef(pattern) ? matcher(pattern) : null)
  } catch (err) {
    cb(err, true)
    return
  }
  cb.cancel = takeCb.cancel
}
```

这里的`channel`就是我们新建sagaMiddleWare的channel，是`multicastChannel`的的返回值，位于`packages/core/src/internal/channel.js`
下面我们看看`multicastChannel`的内容
```js
export function multicastChannel() {
  let closed = false
  let currentTakers = []
  let nextTakers = currentTakers

  const ensureCanMutateNextTakers = () => {
    if (nextTakers !== currentTakers) {
      return
    }
    nextTakers = currentTakers.slice()
  }

  const close = () => {
    closed = true
    const takers = (currentTakers = nextTakers)
    nextTakers = []
    takers.forEach(taker => {
      taker(END)
    })
  }

  return {
    [MULTICAST]: true,
    put(input) {
      if (closed) {
        return
      }
      if (isEnd(input)) {
        close()
        return
      }
      const takers = (currentTakers = nextTakers)
      for (let i = 0, len = takers.length; i < len; i++) {
        const taker = takers[i]
        if (taker[MATCH](input)) {
          taker.cancel()
          taker(input)
        }
      }
    },
    take(cb, matcher = matchers.wildcard) {
      if (closed) {
        cb(END)
        return
      }
      cb[MATCH] = matcher
      ensureCanMutateNextTakers()
      nextTakers.push(cb)

      cb.cancel = once(() => {
        ensureCanMutateNextTakers()
        remove(nextTakers, cb)
      })
    },
    close,
  }
}
```
可以看到`multicastChannel`返回的`channel`其实就三个方法，`put`,`take`,`close`，监听的`action`会被保存`在nextTakers`数组中，当这个`take`所监听的`action`被发出了，才会执行一遍`next`

到这里为止，我们已经明白`take`方法的内部实现，`take`方法是用来暂停并等待执行`action`的一个`side effect`，那么接下来我们来看看触发这样一个`action`的流程是怎样的。
## 二. action的触发

在demo的代码中，`INCREMENT_ASYNC`是通过saga监听的异步action。当我们点击按钮increment async时，根据redux的middleware机制，action会在sagaMiddleware中被使用。我们来看一下createSagaMiddleware的代码。
```js
  function sagaMiddleware({ getState, dispatch }) {
    // 省略其余部分代码
    return next => action => {
      // next是dispatch函数或者其他middleware
      // 从这里就可以看出来，先触发reducer，然后才再处理action，所以side effect慢于reducer
      const result = next(action) // hit reducers
      channel.put(action)
      return result
    }
  }
```
可以看到，除了普通的middleware传递action， sagaMiddleware就只是调用了`channel.put(action)`。也就是我们上文所提及的`multicastChannel`的`put`方法。`put`方法会触发`proc`执行下一个`next`，整个流程也就串起来了。

## 总结
当执行`runSaga`之后，通过`Generator`的`停止-再执行`的机制,会有一种在javaScript中另外开了一个线程的错觉，但实际上这也很像。另外`Redux-Saga`在流控制方面提供了更多的API，例如`fork`、`call`、`race`等，这些API对于组织复杂的action操作非常重要。深入源码，除了能在工作中快速定位，也能加深在流操作方面的认识，这些API的源码解析会放在下一篇。

