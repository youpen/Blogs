function insertionSort(arr) {
  for (let i = 1; i < arr.length; i++) {
    for (let j = i; j > 0; j--) {
      if (arr[j-1] > arr[j]) {
        swap(arr, j-1, j);
      } else {
        break;
      }
    }
  }
}

function swap(arr, i, j){
  const temp = arr[i];
  arr[i] = arr[j];
  arr[j] = temp;
}

const a = [];
for (let i = 0; i < 10; i++) {
  a.push(Math.ceil((Math.random() * Math.random()) * 100));
}

insertionSort(a);
console.log(a);
