Redux源码还是很简单的，核心还是在于Redux对于状态管理的设计哲学。
这里记录一下看Redux源码的一些笔记，着重于中间件的实现方式。

#### subscribe
在模块createStore中，subscribe方法中两次调用了`ensureCanMutateNextListeners`，从函数名来看我们知道这是保证我们可以修改nextListener而不出bug，但是为什么呢？
`ensureCanMutateNextListeners`的实现如下，就是判断currentListener和nextListeners长度一致的时候，修改了nextListener的引用。
```
  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice()
    }
  }
```
我们看一下作者的注释
```
   * 1. The subscriptions are snapshotted just before every `dispatch()` call.
   * If you subscribe or unsubscribe while the listeners are being invoked, this
   * will not have any effect on the `dispatch()` that is currently in progress.
   * However, the next `dispatch()` call, whether nested or not, will use a more
   * recent snapshot of the subscription list.
   *  subscriptions是每个dispatch函数之前的一个快照，也就是如果你在listener中调用subscribe或者unsubscribe，
   *  正在工作中的dispatch不会有有影响（也就是subscribe无效）
   *  然后在下一个dispatch中，不管是不是嵌套的dispatch，会使用最新的快照，也就是listener中subscribe之后的结果（有新的注册函数
   *  其实简单，listener是在dispatch中被调用的，调用的是nextListener数组中的注册函数
   *  而在subscribe或者unsubscribe中，修改nextListener的时候，都会调用ensureCanMutateNextListeners改变nextListener的引用
   *  此时再修改nextListener，dispatch中遍历的nextListener也不会改变
```
所以这个问题针对的就是在subscribe的listener函数中，调用了subscribe和unsubscribe的情况。
这种情况的流程是这样的
```
    // 当调用listener的的时候
    const listeners = (currentListeners = nextListeners)
    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i]
      listener()
    }

    // 同时listener中又执行了subscribe/unsubscribe
     function subscribe(listener) {
        // ...其余代码
        ensureCanMutateNextListeners()
        nextListeners.push(listener)
        // ...其余代码
  }
```
也就是在循环执行listeners的时候，listener添加或减少的元素，这可能会实际引发各种问题，可以运行一下下面的代码
```
   *  var listeners = ['1','1','1','1','1','1','1',]
      for (var i = 0; i < listeners.length; i++) {
          listeners.pop()
          console.log(listeners.length)
      }
```
遍历listener的过程同时又操作listener，这是应该避免的，在java中还会出现线程安全问题。
所以这也是每次修改nextListener的时候需要调用ensureCanMutateNextListeners的原因。

其实在注册订阅中经常可能会有这种需求，在redux-saga中，take本质上也是注册函数，saga也是这么处理的，这是在channel中的一个函数
```
 const ensureCanMutateNextTakers = () => {
    if (nextTakers !== currentTakers) {
      return
    }
    nextTakers = currentTakers.slice()
  }
```

#### applyMiddleware
`applyMiddleware`用了大量的currying，所以有时候看起来比较绕。
函数代码很少，直接展示出来
```
export default function applyMiddleware(...middlewares) {
  return createStore => (...args) => {
    const store = createStore(...args);
    let dispatch = () => {
      throw new Error(
        'Dispatching while constructing your middleware is not allowed. ' +
          'Other middleware would not be applied to this dispatch.'
      )
    }

    const middlewareAPI = {
      getState: store.getState,
      dispatch: (...args) => dispatch(...args)
    }
    // 从这里就可以推测，middleWare也是一个currying的函数，接受middleWareApi然后返回新函数
    // 这个函数接受dispatch作为参数,并且返回dispatch
    const chain = middlewares.map(middleware => middleware(middlewareAPI))
    // 也就是可以让dispatch在最终调用之前做一系列操作
    // compose(...chain) 等价于 (...args) => m1(m2(m3(...args)))
    // 1. 每个middleware是一个接受middlewareAPI的函数
    // 2. 执行完每个middleware之后（在map的时候），返回了接受next的一个函数，将这些函数存在chain之中
    // 3. 在调用compose(...chain)(store.dispatch)的这一步，将chain中的函数都执行了，每个函数返回类似dispatch的形式
    // 类似action => {}， 所以最右边的第一个middleware接受的next是store.dispatch,后面的接受的是middleware包装过的action => {}
    // 每个middleware真的需要用dispatch其实还是使用middlewareAPI里的dispatch
    dispatch = compose(...chain)(store.dispatch);
    // 这里是thunk的一个例子
    //   ({ dispatch, getState }) => next => action => {
    //     if (typeof action === 'function') {
    //       return action(dispatch, getState, extraArgument);
    //     }
    //
    //     return next(action);
    //   };

    return {
      ...store,
      dispatch
    }
  }
}
```
总结起来除了函数式编程的写法比较不习惯之外，其他和webpack等中间件本质是一样的。