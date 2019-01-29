function subquicksort(arr, left_pointer = 0, right_pointer = arr.length - 1) {
  if (left_pointer >= right_pointer) {
    return;
  }
  const initial_left = left_pointer;
  const initial_right = right_pointer;

  const standard = arr[left_pointer];
  while (left_pointer < right_pointer) {
    while (arr[left_pointer] < standard && left_pointer < right_pointer) {
      left_pointer++;
    }
    while (arr[right_pointer] >= standard && left_pointer < right_pointer) {
      right_pointer--;
    }
    const temp = arr[left_pointer];
    arr[left_pointer] = arr[right_pointer];
    arr[right_pointer] = temp;
  }
  subquicksort(arr, initial_left, left_pointer - 1);
  if (initial_left === left_pointer) {
    subquicksort(arr, right_pointer + 1, initial_right);
  } else {
    subquicksort(arr, right_pointer, initial_right);
  }
}

function quicksort(a) {
  subquicksort(a);
}

const a = [];
for (let i = 0; i < 29; i++) {
  a.push(Math.ceil((Math.random() * Math.random()) * 100));
}

// quicksort(a);
// console.log(a);

// version2
function quicksort(arr, left=0, right=arr.length-1) {
  if (left >= right) {
    return;
  }
  // let pivot = left;
  // TODO 自由定义pivot的实现
  const pivot = right;
  const partitionIndex = partition(arr, left, right, pivot)
  quicksort(arr, left, partitionIndex - 1);
  quicksort(arr, partitionIndex + 1, right);
  return arr
}

function partition(arr, left, right, pivot) {
  // partitionIndex永远指向大值
  // i永远指向小值
  let partitionIndex = left;
  for (let i = left; i < right; i++) {
    if (arr[i] < arr[pivot]) {
      swap(arr, i, partitionIndex);
      partitionIndex++;
    }
  }
  // 将中间值放在中间位置（可以避免很多边界问题，因为明确了下一次递归的两个数组范围）
  swap(arr, left, partitionIndex);
  return partitionIndex;
}


function swap(arr, i, j){
  const temp = arr[i];
  arr[i] = arr[j];
  arr[j] = temp;
}
const a = quicksort([11,8,14,3,6,2,7]);
console.log(a)
