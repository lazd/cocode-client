module.exports = [
  {
    name: 'Introduction',
    video: true,
    code: false
  },
  {
    name: 'FizzBuzz',
    video: true,
    test: function() {
      var expected = 'FizzBuzzFizzBuzzBuzzFizzBuzzFizzBuzzFizzBuzzFizzBuzzBuzzFizzFizzBuzzBuzzFizzBuzzFizzBuzzFizzBuzzFizzBuzzBuzzFizzBuzzFizzBuzzFizzBuzzFizzBuzzBuzzFizzFizzBuzzBuzzFizzBuzzFizzBuzzFizzBuzzFizzBuzzBuzzFizzBuzzFizzBuzzFizzBuzzFizzBuzzBuzzFizzFizzBuzzBuzzFizzBuzzFizzBuzzFizzBuzzFizzBuzzBuzzFizzBuzzFizzBuzzFizzBuzzFizzBuzzBuzzFizzFizzBuzzBuzzFizzBuzzFizzBuzzFizzBuzzFizzBuzzBuzzFizzBuzzFizzBuzzFizzBuzzFizzBuzzBuzzFizzFizzBuzzBuzzFizzBuzzFizzBuzzFizzBuzzFizzBuzzBuzzFizzBuzzFizzBuzzFizzBuzzFizzBuzzBuzzFizzFizzBuzzBuzzFizzBuzzFizzBuzzFizzBuzzFizzBuzzBuzzFizzBuzzFizzBuzzFizzBuzzFizzBuzzBuzzFizz';
      fizzBuzz();
      console.assert(console.output === expected, 'Should print the correct output', 'Expected '+expected+'\nGot '+console.output);
    },
    code: '/**\n\
  FizzBuzz\n\
\n\
  * Write a program that prints the numbers from 1 to 100.\n\
  * For multiples of three print "Fizz" instead of the number.\n\
  * For the multiples of five print "Buzz".\n\
  * For numbers which are multiples of both three and five print "FizzBuzz".\n\
*/\n\
\n\
function fizzBuzz() {\n\
  \n\
}\n\
\n\
'
  },
  {
    name: 'Given a sorted array of numbers, write a search function',
    video: true,
    test: function() {
      console.assert('14 is in the array', search(arr, 14));
      console.assert('10 is in the array', search(arr, 10));
      console.assert('3 is NOT in the array', search(arr, 3));
      console.assert('9 is NOT in the array', search(arr, 3));
    },
    code: '/**\n\
  Search in a sorted array\n\
\n\
  * Given a sorted array of numbers, write a search function\n\
  * Your search function should return true if the value is found and false otherwise\n\
  * Your function should be faster than O(n)\n\
*/\n\
\n\
var arr = [1, 2, 4, 5, 7, 8, 10, 12, 14, 18, 22];\n\
\n\
function search(arr, val) {\n\
  \n\
}\n\
\n\
'
  },
  {
    name: 'Implement JSON.stringify()',
    video: true,
    code: '/**\n\
  JSON.stringify()\n\
\n\
  * Implement JSON.stringify()\n\
  * Your function should take an object and return a JSON string\n\
  * The JSON must be valid for any given any data type, regardless of content\n\
*/\n\
\n\
function stringify(obj) {\n\
  \n\
}\n\
\n\
stringify({\n\
  name: \'Value\',\n\
  quote: \'"Ain\'t nothin but a G thang",\n\
  sayHi: function() { alert(\'Hi!\'); },\n\
  clue: null,\n\
  meaning: undefined,\n\
  \'new-items\': [\n\
    \'First\',\n\
    \'Second\'\n\
  ]\n\
});\n\
'
  },
  {
    name: 'Reverse an array in place',
    video: true,
    code: '/**\n\
  Search in a sorted array\n\
\n\
  * Given an array, reverse it in place. Don\t use the built in Array.reverse().\n\
*/\n\
\n\
function reverse(arr) {\n\
\n\
}\n\
\n\
reverse([15, 10, 5, 1, 2, 3]);\n\
'
  },
  {
    name: 'Next Steps',
    video: true,
    code: false
  }
];
