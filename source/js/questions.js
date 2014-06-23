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
      var expected = '12Fizz4BuzzFizz78FizzBuzz11Fizz1314FizzBuzz1617Fizz19BuzzFizz2223FizzBuzz26Fizz2829FizzBuzz3132Fizz34BuzzFizz3738FizzBuzz41Fizz4344FizzBuzz4647Fizz49BuzzFizz5253FizzBuzz56Fizz5859FizzBuzz6162Fizz64BuzzFizz6768FizzBuzz71Fizz7374FizzBuzz7677Fizz79BuzzFizz8283FizzBuzz86Fizz8889FizzBuzz9192Fizz94BuzzFizz9798FizzBuzz';
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
    test: function() {
      var obj = {
        name: 'Value',
        quote: '"Ain\'t nothin but a G thang"',
        sayHi: function() { alert('Hi!'); },
        clue: null,
        meaning: undefined,
        'new-items': [
          'First',
          'Second'
        ]
      };
      var output = stringify(obj);
      console.assert(output === JSON.stringify(obj), 'Output should match JSON.stringify\'s output');
    },
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
'
  },
  {
    name: 'Reverse an array in place',
    video: true,
    test: function() {
      var actual = reverse([15, 10, 5, 1, 2, 3]);
      var expected = [3, 2, 1, 5, 10, 15];
      console.assert(actual.length === expected.length, 'Should have the correct number of items', 'Expected '+expected.length+'\nGot '+actual.length);
      actual.forEach(function(number, index) {
        console.assert(number === expected[index], 'Should match index at '+index, 'Expected '+expected[index]+'\nGot '+number);
      });
    },
    code: '/**\n\
  Search in a sorted array\n\
\n\
  * Given an array, reverse it in place. Don\t use the built in Array.reverse().\n\
*/\n\
\n\
function reverse(arr) {\n\
\n\
}\n\
'
  },
  {
    name: 'Next Steps',
    video: true,
    code: false
  }
];
