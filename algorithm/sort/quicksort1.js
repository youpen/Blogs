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
for (let i = 0; i < 10; i++) {
  a.push(Math.ceil((Math.random() * Math.random()) * 100));
}

quicksort(a);
console.log(a);

