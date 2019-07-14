// The binarySearch() function is licensed under the UNLICENSE
// https://github.com/Olical/binary-search

// Modified for use in Discourse

export default function binarySearch(list, target, keyProp) {
  let min = 0;
  let max = list.length - 1;
  let guess;
  const keyProperty = keyProp || "id";

  while (min <= max) {
    guess = Math.floor((min + max) / 2);

    if (Ember.get(list[guess], keyProperty) === target) {
      return guess;
    } else {
      if (Ember.get(list[guess], keyProperty) < target) {
        min = guess + 1;
      } else {
        max = guess - 1;
      }
    }
  }

  return -1;
}
