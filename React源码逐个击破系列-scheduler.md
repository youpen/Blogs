Scheduler是React中相对独立的模块，也是React16实现`time slicing`最核心的一个模块，在我阅读React源码的过程来看，`scheduler`就是整个React源码的缩影，例如链表的操作、全局变量、暂时变量的控制等等。如果能先弄懂，对其他部分的代码阅读将会有极大的帮助。
我写这篇文章希望将`scheduler`模块从React源码中抽离出来解读，不需要任何其他部分的知识，将这个模块作为阅读源码的突破口，在此我需要一些预备知识：
我们先看一下整个`scheduler`的方法列表：

![image.png](https://github.com/youpen/Blogs/blob/dev/images/ReactScheduler/SchedulerFunctionList.png?raw=true)


1. scheduler在React中的调用入口是`unstable_scheduleCallback`，我们接下来讲解都会从`unstable_scheduleCallback`这个函数开始。其中传入的参数callback是`performAsyncWork`，我们这边先不管，直接简单的理解为是React要执行的一个任务，因为整个scheduler模块就是控制这个任务的运行时间。
2. 关于expirationTime，expirationTime的意义是**当前时间+任务预计完成时间**，而每个任务都有自己的expirationTime，在scheduler模块中，我们可以理解为每个任务的expirationTime小，优先级越高（因为越快过期）。
很简单的，判断一个任务是否超时，只要expirationTime < currentTime即可。
>在目前React最新的代码中expirationTime中，expirationTime越小反而优先级越高，主要是为了减少sync判断，但是这个逻辑还没有修改到scheduler模块中，关于expirationTime还有很多内容，但是这里并不是我们的重点，这里先不讲。
3. 整个scheduler模块都在维护一个callback的环形链表，链表的头部是`firstCallbackNode`，当我们遇到一个判断`firstCallbackNode === null`，我们应该明白这是这判断这个链表是否为空。在后文中，这个链表的元素我称之为`callbackNode`, 链表称为`callback链表`


##### unstable_scheduleCallback
接下面我们从入口函数`unstable_scheduleCallback`开始看，
`unstable_scheduleCallback`函数的内容概述就是生成`callbackNode`，并插入到callback链表之中
```js
function unstable_scheduleCallback(callback, deprecated_options) {
  // callback是performAsyncWork，也就是我们上文所说的任务
  // getCurrentTime就是获取当前时间
  // currentEventStartTime在react-dom中不会用到，先忽略
  var startTime =
    currentEventStartTime !== -1 ? currentEventStartTime : getCurrentTime();

  var expirationTime;
  if (
    // 这个判断与scheduler核心无关，先忽略
    typeof deprecated_options === 'object' &&
    deprecated_options !== null &&
    typeof deprecated_options.timeout === 'number'
  ) {
    // 从requestWork调用到这里，目前只会走这个分支
    // 目前来看timeout越小，优先级越大
    expirationTime = startTime + deprecated_options.timeout;
  } else {
    // 这一部分内容我在React源码中并没有看到用的地方
    // 应该是还未完成的一部分代码
    // 这里先删除以免影响阅读
  }
  // 这个就是callback环形链表的元素结构
  var newNode = {
    callback, // 需要执行的任务
    priorityLevel: currentPriorityLevel, // 这个值暂时用不到，先不看
    expirationTime, // 过期时间，上文已经介绍过
    next: null, // 链表结构next
    previous: null, // 链表结构previous
  };

  // 接下来部分就是将newNode插入到链表中，并且按expirationTime从大到小的顺序
  // firstCallbackNode 是一个双向循环链表的头部，这个链表在此模块（scheduler）模块维护
  // firstCallbackNode === null 说明链表为空
  if (firstCallbackNode === null) {
    // 给环形链表添加第一个元素
    firstCallbackNode = newNode.next = newNode.previous = newNode;
    ensureHostCallbackIsScheduled();
  } else {
    var next = null;
    var node = firstCallbackNode;
    // 从头部（firstCallbackNode）开始遍历链表，知道
    do {
    // 这个判断用于寻找expirationTime最大的任务并赋值给next
    // 也就是优先级最低的任务
     if (node.expirationTime > expirationTime) {
        next = node; // next这个局部变量就是为了从链表中找出比当前新进入的callback优先级更小的任务
        break;
      }
      node = node.next;
    } while (node !== firstCallbackNode); // 由于是环形链表，这是已经遍历一圈的标记

    // 这里环形链表的排序是这样的
    /*
    *           head
    *    next7         next1
    *  next6              next2
    *    next5         next3
    *           next4
    *
    * 其中head的expirationTime最小，next7最大，其余的next的expirationTime从小到大排序，
    * 当next === null,走分支1，newNode的expirationTime是最大的（链表每个element都小于newNode），所以需要将newNode插入head之前
    * 当next === firstCallbackNode，newNode的expirationTime是最小的，也就是newNode要插入head之前，成为新的head，
    * 所以分支2需要修改链表的head指针
    * */
    if (next === null) {
      // 分支1
      // No callback with a later expiration was found, which means the new
      // callback has the latest expiration in the list.
      next = firstCallbackNode;
    } else if (next === firstCallbackNode) {
      // 分支2
      // 这个分支是指新的callback的expirationTime最小，那么应该放在头部，这里直接改变头部（firstCallbackNode）指向newNode
      // 后面插入操作正常执行，与上面的判断分支类似
      // The new callback has the earliest expiration in the entire list.
      firstCallbackNode = newNode;
      ensureHostCallbackIsScheduled();
    }
    // 环形双向链表插入的常规操作，这里是指在next节点之前插入newNode
    var previous = next.previous;
    previous.next = next.previous = newNode;
    newNode.next = next;
    newNode.previous = previous;
  }

  return newNode;
}
```
至此我们明白了，这个函数的功能就是按照expirationTime从小到大排列callback链表。只要插入和排序一完成，我们就会调用`ensureHostCallbackIsScheduled`。

##### ensureHostCallbackIsScheduled
```js
function ensureHostCallbackIsScheduled() {
  // 当某个callback已经被调用
  if (isExecutingCallback) {
    // Don't schedule work yet; wait until the next time we yield.
    return;
  }
  // Schedule the host callback using the earliest expiration in the list.
  var expirationTime = firstCallbackNode.expirationTime;
  if (!isHostCallbackScheduled) {
    isHostCallbackScheduled = true;
  } else {
    // Cancel the existing host callback.
    cancelHostCallback();
  }
  requestHostCallback(flushWork, expirationTime);
}
```
`ensureHostCallbackIsScheduled`在后面会在各种情况再次调用，这里我们只要知道，`ensureHostCallbackIsScheduled`，并且调用了` requestHostCallback(flushWork, expirationTime)`就可以了。

##### requestHostCallback
```js
  requestHostCallback = function(callback, absoluteTimeout) {
    // scheduledHostCallback就是flushWork
    scheduledHostCallback = callback;
    // timeoutTime就是callback链表的头部的expirationTime
    timeoutTime = absoluteTimeout;
    // rAF是requestAnimationFrame的缩写
    // isFlushingHostCallback这个判断是一个Eagerly操作，如果有新的任务进来，
    // 尽量让其直接执行，防止浏览器在下一帧才执行这个callback
    // 这个判断其实不是很好理解，建议熟悉模块之后再回来看，并不影响scheduler核心逻辑
    // 有兴趣可以阅读https://github.com/facebook/react/pull/13785
    if (isFlushingHostCallback || absoluteTimeout < 0) {
      // absoluteTimeout < 0说明任务超时了，立刻执行，不要等下一帧
      // Don't wait for the next frame. Continue working ASAP, in a new event.
      // port就是port1
      port.postMessage(undefined);
    // isAnimationFrameScheduled是指animationTick函数是否在运行中
    // 第一次调用一定会走进这个分支
    } else if (!isAnimationFrameScheduled) {
      // If rAF didn't already schedule one, we need to schedule a frame.
      // TODO: If this rAF doesn't materialize because the browser throttles, we
      // might want to still have setTimeout trigger rIC as a backup to ensure
      // that we keep performing work.
      isAnimationFrameScheduled = true;
      requestAnimationFrameWithTimeout(animationTick);
    }
  };
```
我们注意到函数名也有`callback`,但是这里是`hostCallback`，整个模块中的`hostCallback`函数都是指`flushWork`，我们后面再讲这个`flushWork`。
注释中有一个疑点就是判断`isAnimationFrameScheduled`，这里是因为整个scheduler模块都是在`animationTick`函数中一帧一帧的调用的，我们在下一个`animationTick`函数中会详细讲解。

```js
var requestAnimationFrameWithTimeout = function(callback) {
  // callback就是animationTick方法
  // schedule rAF and also a setTimeout
  // localRequestAnimationFrame相当于window.requestAnimationFrame
  // 接下来两个调用时超时并发处理
  // 1. 调用requestAnimationFrame
  rAFID = localRequestAnimationFrame(function(timestamp) {
    // cancel the setTimeout
    localClearTimeout(rAFTimeoutID);
    callback(timestamp);
  });
  // 2. 调用setTimeout，时间为ANIMATION_FRAME_TIMEOUT（100),超时则取消rAF，改为直接调用
  rAFTimeoutID = localSetTimeout(function() {
    // cancel the requestAnimationFrame
    localCancelAnimationFrame(rAFID);
    callback(getCurrentTime());
  }, ANIMATION_FRAME_TIMEOUT);
};
```
这个函数我们直接就通过函数名来理解，也就是调用requestAnimationFrame，如果超时了就改为普通调用。
> 在接下来部分内容，我们需要预先了解requestAnimationFrame和eventLoop的知识

##### animationTick
```js
  var animationTick = function(rafTime) {
    // scheduledHostCallback也就是callback
    if (scheduledHostCallback !== null) {
      // 这里是连续递归调用，直到scheduledHostCallback === null
      // scheduledHostCallback会在messageChannel的port1的回调中设为null
      // 因为requestAnimationFrameWithTimeout会加入event loop,所以这里不是普通递归，而是每一帧执行一次
      // 注意当下一帧执行了animationTick时，之前的animationTick已经计算出了nextFrameTime
      requestAnimationFrameWithTimeout(animationTick);
    } else {
      // No pending work. Exit.
      isAnimationFrameScheduled = false;
      return;
    }
    // 保持浏览器能保持每秒30帧，那么每帧就是33毫秒
    // activeFrameTime在模块顶部定义，初始值为33
    // previousFrameTime的初始值也是33
    // nextFrameTime就是此方法到下一帧之前可以执行多少时间
    // 如果第一次执行，nextFrameTime肯定是很大的，因为frameDeadline为0
    // rafTime是当前时间戳
    // 当第一次执行，nextFrameTime的值是一个包含当前时间戳，很大的值
    // 当不是第一次执行frameDeadline在后面已经赋值为rafTime + activeFrameTime
    // 也就是这个公式为new_rafTime - （old_rafTime + old_activeFrameTime） + new_activeFrameTime
    // 也就是(new_rafTime - old_rafTime) + (new_activeFrameTime - old_activeFrameTime)
    // 当一般情况（也就是不走近分支1）的情况，new_activeFrameTime === old_activeFrameTime
    // 所以nextFrameTime === (new_rafTime - old_rafTime)
    // 也就是两个requestAnimationFrameWithTimeout之间的时间差，即一帧所走过的时间
    // 当走过两帧之后，发现nextFrameTime和nextFrameTime的时间都小于activeFrameTime，则判定当前平台的帧数更高（每帧的时间更短）
    // 则走分支1修改activeFrameTime
    var nextFrameTime = rafTime - frameDeadline + activeFrameTime;
    if (
      nextFrameTime < activeFrameTime &&
      previousFrameTime < activeFrameTime
    ) {
      // TODO 分支1
      if (nextFrameTime < 8) {
        // Defensive coding. We don't support higher frame rates than 120hz.
        // If the calculated frame time gets lower than 8, it is probably a bug.
        nextFrameTime = 8;
      }
      // 这里试探性的设置了activeFrame，因为在某些平台下，每秒的帧数可能更大，例如vr游戏这种情况
      // 设置activeFrameTime为previousFrameTime和nextFrameTime中的较大者
      activeFrameTime =
        nextFrameTime < previousFrameTime ? previousFrameTime : nextFrameTime;
    } else {
      previousFrameTime = nextFrameTime;
    }
    frameDeadline = rafTime + activeFrameTime;
    // isMessageEventScheduled的值也是在port1的回调中设置为false
    // isMessageEventScheduled的意义就是每一帧的animationTick是否被执行完
    // animationTick -> port.postMessage(设置isMessageEventScheduled为false) -> animationTick
    // 防止port.postMessage被重复调用（应该是在requestAnimationFrameWithTimeout超时的时候会出现的情况
    // 因为postMessage也是依赖event loop，可能会有竞争关系
    if (!isMessageEventScheduled) {
      isMessageEventScheduled = true;
      // port就是port1
      // postMessage是event loop下一个tick使用，所以就是frameDeadline中，其实留了空闲时间给浏览器执行动画渲染
      // 举个例子： 假设当前浏览器为30帧，则每帧33ms，frameDeadline为currentTime + 33,当调用了port.postMessage,当前tick的js线程就变为空了
      // 这时候就会留给浏览器部分时间做动画渲染，所以实现了requestIdleCallback的功能
      // port.postMessage是留给空出js线程的关键
      port.postMessage(undefined);
    }
  };
```
中间部分`nextFrameTIme`的判断是React检查帧数的计算，我们先忽略，关注整体。
`animationTick`一开始直接`scheduledHostCallback`是否为`null`，否则就继续通过`requestAnimationFrameWithTimeout`调用`animationTick`自身，这是一个逐帧执行的递归。意思就是这个递归在浏览器在渲染下一帧的时候，才会调用再次调用animationTick。
也就是在animationTick的调用`requestAnimationFrameWithTimeout(animationTick)`之后，后面的代码依然有时间可以执行。因为递归会在下一帧由浏览器调用。而在animationTick最后的代码调用了`port.postMessage`，这是一个一个浏览器提供的API`MessageChannel`，主要用于注册的两端port之间相互通讯，有兴趣的读者可以自己查查。`MessageChannel`的通讯每次调用都是异步的，类似于`EventListener`，也就是，当调用`port.postMessage`，也就是告诉浏览器当前EventLoop的任务执行完了，浏览器可以检查一下现在现在有没有别的任务进来（例如动画或者用户操作），然后插入下一个EventLoop中。(当然在EventLoop的任务队列中，animationTick剩余的代码优先级会比动画及用户操作更高，因为排序排在前面。但是其实后面的代码也会有根据帧时间是否足够，执行让出线程的操作）
递归的流程如下图
![AnimationTick](https://github.com/youpen/Blogs/blob/dev/images/ReactScheduler/AnimationTick.png?raw=true)
了解了整个`AnimationTick`的流程，我们接下来看看具体的代码，AnimationTick的参数rafTime是当前的时间戳，activeFrameTime是React假设每一帧的时间，默认值为33，33是浏览器在每秒30帧的情况下，每一帧的时间。frameDeadline默认值为0。
我们先跳过中间判断看一下frameDeadline的计算公式
```js
frameDeadline = rafTime + activeFrameTime;
```
所以frameDeadline是当前帧结束的时间。
nextFrameTime则是下一帧预计剩余时间，我们看nextFrameTime的计算公式，
```js
// 此处的rafTime是下一帧执行时的currentTime
var nextFrameTime = rafTime - frameDeadline + activeFrameTime;
```
即`currentTime - 任务的expirationTime + 每一个帧的时间`，也就是
`每一帧的时间 - 任务预计花费的实际`，所以nextFrameTime是预计的下一帧的剩余时间。
当我们执行两帧过后，previousFrameTime和nextFrameTime都计算出值，我们就有可能走进中间的判断如果前后两帧的时间都比默认设置的activeFrameTime小，也就是当前代码执行平台的帧数可能比30帧更高，所以设置activeFrameTime为测试出的新值。这种情况可能出现在VR这种对帧数要求更高的环境。
接下面我们判断isMessageEventScheduled的布尔值，这是为了防止保证`port.postMessage(undefined);`在每一帧只调用一次。

##### channel.port1.onmessage（idleTick）
在AnimationTick中调用`port.postMessage(undefined);`之后，我们实际上进入了`channel.port1`的回调函数，
```js
  channel.port1.onmessage = function(event) {
    // 设置为false，防止animationTick的竞争关系
    isMessageEventScheduled = false;

    var prevScheduledCallback = scheduledHostCallback;
    var prevTimeoutTime = timeoutTime;
    scheduledHostCallback = null;
    timeoutTime = -1;

    var currentTime = getCurrentTime();

    var didTimeout = false;
    // 说明超过了activeFrameTime的实际（默认值33
    // 说明这一帧没有空闲时间，然后检查任务是否过期，过期的话就设置didTimeout，用于后面强制执行
    if (frameDeadline - currentTime <= 0) {
      // There's no time left in this idle period. Check if the callback has
      // a timeout and whether it's been exceeded.
      // 查看任务是否过期，过期则强行更新
      // timeoutTime就是当时的CurrentTime + timeout
      // timeout是scheduleCallbackWithExpirationTime传进来的
      // 相当于currentTimeStamp + expirationTIme
      if (prevTimeoutTime !== -1 && prevTimeoutTime <= currentTime) {
        // Exceeded the timeout. Invoke the callback even though there's no
        // time left.
        // 这种过期的情况有可能已经掉帧了
        didTimeout = true;
      } else {
        // 没有超时则等待下一帧再执行
        // No timeout.
        // isAnimationFrameScheduled这个变量就是判断是否在逐帧执行animationTick
        // 开始设置animationTick时设置为true，animationTick结束时设置为false
        if (!isAnimationFrameScheduled) {
          // Schedule another animation callback so we retry later.
          isAnimationFrameScheduled = true;
          requestAnimationFrameWithTimeout(animationTick);
        }
        // Exit without invoking the callback.
        // 因为上一个任务没有执行完，设置回原来的值，等animationTick继续处理scheduledHostCallback
        scheduledHostCallback = prevScheduledCallback;
        timeoutTime = prevTimeoutTime;
        return;
      }
    }
```
此处代码用了React中常用的命名方式`prevXXXX`，一般是在某个流程之中，先保留之前的值，在执行完某个操作之后，再还原某个值，提供给别的代码告诉自己正在处理的阶段。例如
```js
    var prevScheduledCallback = scheduledHostCallback;
    scheduledHostCallback = null;
    ...
    ...
    // 还原
    scheduledHostCallback = prevScheduledCallback;
```
整个回调函数其实比较简单，只有几个分支

![image.png](https://github.com/youpen/Blogs/blob/dev/images/ReactScheduler/idleTick.png?raw=true)

##### flushWork
```js
function flushWork(didTimeout) {
  // didTimeout是指任务是否超时
  // Exit right away if we're currently paused

  if (enableSchedulerDebugging && isSchedulerPaused) {
    return;
  }

  isExecutingCallback = true;
  const previousDidTimeout = currentDidTimeout;
  currentDidTimeout = didTimeout;
  try {
    if (didTimeout) {
      // Flush all the expired callbacks without yielding.
      while (
        firstCallbackNode !== null &&
        !(enableSchedulerDebugging && isSchedulerPaused)
      ) {
        // TODO Wrap in feature flag
        // Read the current time. Flush all the callbacks that expire at or
        // earlier than that time. Then read the current time again and repeat.
        // This optimizes for as few performance.now calls as possible.
        var currentTime = getCurrentTime();
        if (firstCallbackNode.expirationTime <= currentTime) {
          // 这个循环的意思是，遍历callbackNode链表，直到第一个没有过期的callback
          // 所以主要意义就是将所有过期的callback立刻执行完
          do {
            // 这个函数有将callbackNode剥离链表并执行的功能， firstCallbackNode在调用之后会修改成为新值
            // 这里遍历直到第一个没有过期的callback
            flushFirstCallback();
          } while (
            firstCallbackNode !== null &&
            firstCallbackNode.expirationTime <= currentTime &&
            !(enableSchedulerDebugging && isSchedulerPaused)
          );
          continue;
        }
        break;
      }
    } else {
      // Keep flushing callbacks until we run out of time in the frame.
      if (firstCallbackNode !== null) {
        do {
          if (enableSchedulerDebugging && isSchedulerPaused) {
            break;
          }
          flushFirstCallback();
          // shouldYieldToHost就是比较frameDeadline和currentTime，就是当前帧还有时间的话，就一直执行
        } while (firstCallbackNode !== null && !shouldYieldToHost());
      }
    }
  } finally {
    isExecutingCallback = false;
    currentDidTimeout = previousDidTimeout;
    if (firstCallbackNode !== null) {
      // There's still work remaining. Request another callback.
      // callback链表还没全部执行完，继续
      // ensureHostCallbackIsScheduled也是会启动下一帧，所以不是连续调用
      // 同时，isHostCallbackScheduled决定了ensureHostCallbackIsScheduled的行为，
      // 在此分支中isHostCallbackScheduled === true, 所以ensureHostCallbackIsScheduled会执行一个cancelHostCallback函数
      // cancelHostCallback设置scheduledHostCallback为null，可以令上一个animationTick停止
      ensureHostCallbackIsScheduled();
    } else {
      // isHostCallbackScheduled这个变量只会在ensureHostCallbackIsScheduled中被设置为true
      // 这个变量的意义可能是代表，是否所有任务都被flush了？，因为只有firstCallbackNode === null的情况下才会设为false
      isHostCallbackScheduled = false;
    }
    // Before exiting, flush all the immediate work that was scheduled.
    flushImmediateWork();
  }
}
```

flushFirstCallback
```js
function flushFirstCallback() {
  var flushedNode = firstCallbackNode;

  // Remove the node from the list before calling the callback. That way the
  // list is in a consistent state even if the callback throws.
  var next = firstCallbackNode.next;
  // 这里是从链表中删除firstCallbackNode的处理
  if (firstCallbackNode === next) {
    // 这种情况，链表只有一个元素，直接清空
    // This is the last callback in the list.
    firstCallbackNode = null;
    next = null;
  } else {
    // 这个操作就是从链表中删除掉firstCallbackNode
    var lastCallbackNode = firstCallbackNode.previous;
    firstCallbackNode = lastCallbackNode.next = next;
    next.previous = lastCallbackNode;
  }

  flushedNode.next = flushedNode.previous = null;

  // Now it's safe to call the callback.
  // 像下面这种，先将currentXXX赋值给previousXXX，然后再讲previousXXX赋值给currentXXX，可能是因为同时还有别的地方需要使用到currentXXX，留意一下
  // 也有可能是要保证代码执行成功之后，才修改currentXXX的值
  var callback = flushedNode.callback;
  var expirationTime = flushedNode.expirationTime;
  var priorityLevel = flushedNode.priorityLevel;
  var previousPriorityLevel = currentPriorityLevel;
  var previousExpirationTime = currentExpirationTime;
  currentPriorityLevel = priorityLevel;
  currentExpirationTime = expirationTime;
  var continuationCallback;
  try {
    continuationCallback = callback();
  } finally {
    currentPriorityLevel = previousPriorityLevel;
    currentExpirationTime = previousExpirationTime;
  }

  // A callback may return a continuation. The continuation should be scheduled
  // with the same priority and expiration as the just-finished callback.
  if (typeof continuationCallback === 'function') {
    var continuationNode: CallbackNode = {
      callback: continuationCallback,
      priorityLevel,
      expirationTime,
      next: null,
      previous: null,
    };

    // Insert the new callback into the list, sorted by its expiration. This is
    // almost the same as the code in `scheduleCallback`, except the callback
    // is inserted into the list *before* callbacks of equal expiration instead
    // of after.
    // 这个链表插入顺序的区别在于，遇到expirationTime相等的element，scheduleCallback会设置在该element后面
    // 而此函数会设置在该element前面
    if (firstCallbackNode === null) {
      // This is the first callback in the list.
      firstCallbackNode = continuationNode.next = continuationNode.previous = continuationNode;
    } else {
      var nextAfterContinuation = null;
      var node = firstCallbackNode;
      do {
        // 和scheduleCallback函数唯一的区别就是这个等号
        if (node.expirationTime >= expirationTime) {
          // This callback expires at or after the continuation. We will insert
          // the continuation *before* this callback.
          nextAfterContinuation = node;
          break;
        }
        node = node.next;
      } while (node !== firstCallbackNode);

      if (nextAfterContinuation === null) {
        // No equal or lower priority callback was found, which means the new
        // callback is the lowest priority callback in the list.
        nextAfterContinuation = firstCallbackNode;
      } else if (nextAfterContinuation === firstCallbackNode) {
        // The new callback is the highest priority callback in the list.
        firstCallbackNode = continuationNode;
        ensureHostCallbackIsScheduled();
      }

      var previous = nextAfterContinuation.previous;
      previous.next = nextAfterContinuation.previous = continuationNode;
      continuationNode.next = nextAfterContinuation;
      continuationNode.previous = previous;
    }
  }
}
```

下面记录了部分核心变量的解释，作帮助阅读使用
##### 核心变量
> 在下面变量的命名中，包含`hostCallback`,host可以理解为主要的。包含`scheduled`可以理解为是否正在处理

---
##### callback环形链表
###### 基础结构
- firstCallbackNode
环形链表的起点
- firstCallbackNode.next
下一个元素
- firstCallbackNode.previous
上一个元素
###### 元素排列顺序
```
    *           head
    *    next7         next1
    *  next6              next2
    *    next5         next3
    *           next4
    *
```
假设我们的链表有8个元素，他们会按照expirationTime从小到大排序，也就是head(firstCallbackNode)的expirationTime最小，next7的expirationTime最大。
 >TODO：补充expirationTime和优先级大小的关系以及贴上issue地址

在scheduler的代码中，我们会经常看到一个判断
```js
firstCallbackNode === null // 如果成立则链表为空
```
这个其实就是在判断链表是否为空，因为任何对链表的删除和增加操作，都会更新firstCallbackNode的值，保证firstCallbackNode不为null，除非整个链表已经没有任何元素了。

###### currentDidTimeout
boolean
用于判断当前callback是否超时。

---
###### isExecutingCallback
boolean
判断整个scheduler是否正在`flush`callback，`flush`可以理解为执行callback。
这个变量在函数flushWork中设置为true，当callback执行完之后设置为false

---
###### isHostCallbackScheduled
boolean
判断是否进入了requestHostCallback，requestHostCallback会开启animationTick，进行每一个帧的任务调度。当调用到flushWork直到链表中的callback处理结束，设为false。
主要用于当一个callback处理后产生continuationCallback时，而这个continuationCallback再次成为firstCallbackNode(也就是expirationTime最小的callback)，需要重新调用ensureHostCallbackIsScheduled时，将当前的相关变量重置

```js
    scheduledHostCallback = null;
    isMessageEventScheduled = false;
    timeoutTime = -1;
```
---
###### scheduledHostCallback

function
就是函数flushWork，这个变量可能会被置null，用于animationTick判断是否中止递归

---
###### isMessageEventScheduled

在animationTick中，判断通过messageChannel传输的回调是否执行了

---
###### timeoutTime
当前正在处理的callback(firstCallbackNode)的expirationTime

---
###### isAnimationFrameScheduled
是否处于animationTick的逐帧递归中

###### isFlushingHostCallback
是否正在执行flushWork（也就是是否正在处理callback）