
function selectionSort(arr) {
  for (let i = 0; i < arr.length; i++) {
    let lowestIndex = i;
    for (let j = i; j < arr.length; j++) {
      // TODO binary search to reduce swap
      if (arr[j] < arr[lowestIndex]) {
        lowestIndex = j;
      }
    }
    swap(arr, i, lowestIndex)
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

selectionSort(a);
console.log(a);

