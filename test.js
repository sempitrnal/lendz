function twoSum(nums, target) {
  const map = new Map();
  for (i = 0; i < nums.length; i++) {
    const comp = target - nums[i];
    if (map.has(comp)) {
      return [map.get(comp), i];
    }
    map.set(nums[i], i);
  }
  return [];
}
console.log(twoSum([2, 7, 11, 15], 26));

function isPalindrome(str) {
  let left = 0;
  let right = str.length - 1;
  while (left < right) {
    if (str[left] != str[right]) {
      return false;
    }
    left++;
    right--;
  }
  return true;
}

console.log(isPalindrome("racecar"));
// Count frequency
function countChars(str) {
  const result = {};

  for (const char of str) {
    result[char] = (result[char] || 0) + 1;
  }

  return result;
}

console.log(countChars("yeahman"));
