function quickSort(arr, low = 0, high=arr.length - 1) {
  if (low >= high) {
    return;
  }
  let leftPointer = low;
  let rightPointer = high;
  let pivotValue = arr[leftPointer];
  console.log('init====', arr)
  while (leftPointer < rightPointer) {
    while (arr[leftPointer] <= pivotValue && leftPointer < rightPointer) {
      leftPointer++;
    }
    while (arr[rightPointer] >= pivotValue && leftPointer < rightPointer) {
      rightPointer--;
    }
    // 每次都是两边指针都停下来的时候，才会交换值，没有多余值
    // 和quickSort2不一样的是，这里的指针，根据具体谁碰谁，大小并不能确定，所以需要在位置1判断
    swap(leftPointer, rightPointer, arr);
  }
  // 当两个指针交汇的时候，中间值和pivotValue的大小关系不确定（要看谁碰谁
  // 1
  if (arr[leftPointer] < pivotValue) {
    swap(leftPointer, low, arr);
  }
  quickSort(arr, low, leftPointer - 1);
  quickSort(arr, leftPointer + 1, high)
}

function swap(a, b, arr) {
  const temp = arr[a];
  arr[a] = arr[b];
  arr[b] = temp;
}


var a = [];
for (let i = 0; i < 10; i++) {
  a.push(Math.ceil((Math.random() * Math.random()) * 100));
}
quickSort2(a);
console.log(a);


function quickSort2(arr, low = 0, high=arr.length - 1) {
  if (low >= high) return;
  let leftPointer = low;
  let rightPointer = high;
  const pivotValue = arr[rightPointer];
  while (leftPointer < rightPointer) {
    while (arr[leftPointer] <= pivotValue && leftPointer < rightPointer) {
      leftPointer++;
    }
    // 注意这个的arr[rightPointer]在第一次运行是在原始位置，也就是pivotValue的位置
    // 不管是哪个指针碰哪个指针，被碰的那个值肯定在之前已经传给另外一边了，也就是被碰的值一定多余的
    // 刚好一开始的pivotValue取值的那个index的值被覆盖了，所以放在被碰的位置(代码位置3
    // 而这个时候，这个碰撞位置，左边一定<= pivotValue，右边一定>= pivotValue,所以放在碰撞位置是合适的
    arr[rightPointer] = arr[leftPointer]; //1
    while (arr[rightPointer] >= pivotValue && leftPointer < rightPointer) {
      rightPointer--;
    }
    arr[leftPointer] = arr[rightPointer]; //2
  }
  arr[rightPointer] = pivotValue; // 3
  quickSort2(arr, low, leftPointer - 1);
  quickSort2(arr, leftPointer + 1, high)
}