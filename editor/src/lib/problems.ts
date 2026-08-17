import type { LangId } from "@/lib/languages";

export type ProblemTest = {
  id: string;
  /** Shown to students */
  label: string;
  stdin: string;
  /** Expected stdout (trimmed comparison) */
  expected: string;
  /** Hidden from UI when true */
  hidden?: boolean;
};

export type Problem = {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  /** Default / recommended language */
  langId: LangId;
  /** Markdown-ish plain text description */
  description: string;
  /** Hints / constraints */
  constraints?: string;
  /** Official starter for langId (and fallback base) */
  starterCode: string;
  /** Optional per-language starter overrides */
  starters?: Partial<Record<LangId, string>>;
  tests: ProblemTest[];
};

export const PROBLEMS: Problem[] = [
  {
    id: "sum-two",
    title: "Sum of Two Numbers",
    difficulty: "easy",
    langId: "python",
    description:
      "Read two integers a and b from standard input (one per line) and print their sum.",
    constraints: "−10^9 ≤ a, b ≤ 10^9",
    starterCode: `a = int(input())
b = int(input())
# TODO: print a + b
`,
    tests: [
      { id: "t1", label: "Sample 1", stdin: "2\n3\n", expected: "5" },
      { id: "t2", label: "Sample 2", stdin: "10\n-4\n", expected: "6" },
      {
        id: "t3",
        label: "Hidden large",
        stdin: "1000000000\n1000000000\n",
        expected: "2000000000",
        hidden: true,
      },
    ],
  },
  {
    id: "even-or-odd",
    title: "Even or Odd",
    difficulty: "easy",
    langId: "java",
    description:
      'Read one integer n. Print a single line: "even" if n is even, or "odd" if n is odd (lowercase). Do not print for other numbers — only for n itself.',
    starterCode: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        // TODO: if n is even print "even", else print "odd" (one line only)
        sc.close();
    }
}
`,
    tests: [
      { id: "t1", label: "Even", stdin: "4\n", expected: "even" },
      { id: "t2", label: "Odd", stdin: "7\n", expected: "odd" },
      { id: "t3", label: "Zero", stdin: "0\n", expected: "even", hidden: true },
    ],
  },
  {
    id: "max-of-three",
    title: "Maximum of Three",
    difficulty: "easy",
    langId: "cpp",
    description:
      "Read three integers a, b, c (space-separated on one line). Print the maximum.",
    starterCode: `#include <iostream>
using namespace std;

int main() {
    int a, b, c;
    cin >> a >> b >> c;
    // TODO: print max(a, b, c)
    return 0;
}
`,
    tests: [
      { id: "t1", label: "Sample 1", stdin: "1 5 3\n", expected: "5" },
      { id: "t2", label: "Sample 2", stdin: "9 2 9\n", expected: "9" },
      {
        id: "t3",
        label: "Negatives",
        stdin: "-1 -8 -3\n",
        expected: "-1",
        hidden: true,
      },
    ],
  },
  {
    id: "fizzbuzz-n",
    title: "FizzBuzz to N",
    difficulty: "medium",
    langId: "go",
    description:
      'Read integer n. For each i from 1 to n (inclusive), print on its own line: "FizzBuzz" if divisible by 15, "Fizz" if by 3, "Buzz" if by 5, otherwise i.',
    starterCode: `package main

import "fmt"

func main() {
	var n int
	fmt.Scan(&n)
	// TODO: FizzBuzz 1..n
}
`,
    tests: [
      {
        id: "t1",
        label: "n = 5",
        stdin: "5\n",
        expected: "1\n2\nFizz\n4\nBuzz",
      },
      {
        id: "t2",
        label: "n = 15",
        stdin: "15\n",
        expected:
          "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz",
      },
    ],
  },
  {
    id: "reverse-string",
    title: "Reverse a String",
    difficulty: "easy",
    langId: "php",
    description:
      "Read one line of text and print it reversed. Do not add extra spaces or newlines beyond the reversed text.",
    starterCode: `<?php
$line = trim(fgets(STDIN));
// TODO: print reverse of $line
echo $line;
`,
    tests: [
      { id: "t1", label: "hello", stdin: "hello\n", expected: "olleh" },
      { id: "t2", label: "abc", stdin: "abc\n", expected: "cba" },
    ],
  },
  {
    id: "ts-sum-array",
    title: "Sum an Array (TypeScript)",
    difficulty: "easy",
    langId: "typescript",
    description:
      "Given the array below, print the sum of all numbers on a single line. Edit only the computation if needed.",
    starterCode: `const nums: number[] = [3, 7, 2, 9, 4];
// TODO: print the sum of nums
const sum = 0;
console.log(sum);
`,
    tests: [
      { id: "t1", label: "Fixed array", stdin: "", expected: "25" },
    ],
  },
  {
    id: "count-vowels",
    title: "Count Vowels",
    difficulty: "easy",
    langId: "ruby",
    description:
      'Read one line. Print the number of vowels (a, e, i, o, u) case-insensitive. "y" is not a vowel.',
    starterCode: `line = gets.to_s
# TODO: count vowels and print the number
`,
    tests: [
      { id: "t1", label: "hello", stdin: "hello\n", expected: "2" },
      { id: "t2", label: "AEIOU", stdin: "AEIOU\n", expected: "5" },
      {
        id: "t3",
        label: "rhythm",
        stdin: "rhythm\n",
        expected: "0",
        hidden: true,
      },
    ],
  },
  {
    id: "sql-top-students",
    title: "SQL: Top Students",
    difficulty: "medium",
    langId: "sql",
    description:
      "A table `scores(name TEXT, score INTEGER)` already has data inserted in the starter. Write a query that returns names with score ≥ 90, ordered by score descending.",
    starterCode: `CREATE TABLE scores (
  name TEXT,
  score INTEGER
);

INSERT INTO scores VALUES
  ('Ada', 95),
  ('Grace', 88),
  ('Alan', 91),
  ('Lin', 70);

-- TODO: select name, score where score >= 90 order by score desc
`,
    tests: [
      {
        id: "t1",
        label: "Query output",
        stdin: "",
        expected: "Ada|95\nAlan|91",
      },
    ],
  },
  {
    id: "rust-factorial",
    title: "Factorial",
    difficulty: "medium",
    langId: "rust",
    description: "Read one integer n (0 ≤ n ≤ 12). Print n!.",
    starterCode: `use std::io::{self, BufRead};

fn main() {
    let stdin = io::stdin();
    let line = stdin.lock().lines().next().unwrap().unwrap();
    let n: u64 = line.trim().parse().unwrap();
    // TODO: print n!
    println!("{}", n);
}
`,
    tests: [
      { id: "t1", label: "5!", stdin: "5\n", expected: "120" },
      { id: "t2", label: "0!", stdin: "0\n", expected: "1" },
      { id: "t3", label: "10!", stdin: "10\n", expected: "3628800", hidden: true },
    ],
  },
  {
    id: "absolute-value",
    title: "Absolute Value",
    difficulty: "easy",
    langId: "python",
    description: "Read one integer n and print its absolute value.",
    starterCode: `n = int(input())
# TODO: print |n|
`,
    tests: [
      { id: "t1", label: "Positive", stdin: "5\n", expected: "5" },
      { id: "t2", label: "Negative", stdin: "-12\n", expected: "12" },
      { id: "t3", label: "Zero", stdin: "0\n", expected: "0", hidden: true },
    ],
  },
  {
    id: "celsius-to-f",
    title: "Celsius to Fahrenheit",
    difficulty: "easy",
    langId: "c",
    description:
      "Read one integer Celsius temperature C. Print Fahrenheit as an integer: F = C * 9 / 5 + 32 (integer division is fine for samples).",
    starterCode: `#include <stdio.h>

int main(void) {
    int c;
    scanf("%d", &c);
    // TODO: print Fahrenheit
    return 0;
}
`,
    tests: [
      { id: "t1", label: "0°C", stdin: "0\n", expected: "32" },
      { id: "t2", label: "100°C", stdin: "100\n", expected: "212" },
      { id: "t3", label: "20°C", stdin: "20\n", expected: "68", hidden: true },
    ],
  },
  {
    id: "sum-1-to-n",
    title: "Sum 1 to N",
    difficulty: "easy",
    langId: "java",
    description:
      "Read a positive integer n. Print the sum 1 + 2 + … + n.",
    constraints: "1 ≤ n ≤ 10^4",
    starterCode: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        // TODO: print sum 1..n
        sc.close();
    }
}
`,
    tests: [
      { id: "t1", label: "n=3", stdin: "3\n", expected: "6" },
      { id: "t2", label: "n=10", stdin: "10\n", expected: "55" },
      { id: "t3", label: "n=1", stdin: "1\n", expected: "1", hidden: true },
    ],
  },
  {
    id: "min-of-list",
    title: "Minimum of N Numbers",
    difficulty: "easy",
    langId: "cpp",
    description:
      "First line: integer n. Second line: n space-separated integers. Print the minimum value.",
    starterCode: `#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;
    // TODO: read n ints and print the minimum
    return 0;
}
`,
    tests: [
      { id: "t1", label: "Sample 1", stdin: "5\n3 1 4 1 5\n", expected: "1" },
      { id: "t2", label: "Sample 2", stdin: "3\n-2 0 -7\n", expected: "-7" },
      {
        id: "t3",
        label: "Single",
        stdin: "1\n42\n",
        expected: "42",
        hidden: true,
      },
    ],
  },
  {
    id: "palindrome-string",
    title: "Palindrome Check",
    difficulty: "medium",
    langId: "python",
    description:
      'Read one line (letters only). Print "yes" if it is a palindrome (same forwards and backwards), otherwise "no". Case-sensitive.',
    starterCode: `s = input().strip()
# TODO: print "yes" or "no"
`,
    tests: [
      { id: "t1", label: "radar", stdin: "radar\n", expected: "yes" },
      { id: "t2", label: "hello", stdin: "hello\n", expected: "no" },
      { id: "t3", label: "a", stdin: "a\n", expected: "yes", hidden: true },
      {
        id: "t4",
        label: "abba",
        stdin: "abba\n",
        expected: "yes",
        hidden: true,
      },
    ],
  },
  {
    id: "count-digits",
    title: "Count Digits",
    difficulty: "easy",
    langId: "kotlin",
    description:
      "Read one non-negative integer n (as a line of digits). Print how many digits it has. Leading zeros are not present except for n = 0.",
    starterCode: `fun main() {
    val s = readLine()!!.trim()
    // TODO: print number of digits
}
`,
    tests: [
      { id: "t1", label: "12345", stdin: "12345\n", expected: "5" },
      { id: "t2", label: "0", stdin: "0\n", expected: "1" },
      { id: "t3", label: "7", stdin: "7\n", expected: "1", hidden: true },
    ],
  },
  {
    id: "power-of-two",
    title: "Power of Two?",
    difficulty: "medium",
    langId: "go",
    description:
      'Read one positive integer n. Print "yes" if n is a power of two (1, 2, 4, 8, …), otherwise "no".',
    starterCode: `package main

import "fmt"

func main() {
	var n int
	fmt.Scan(&n)
	// TODO: print "yes" or "no"
}
`,
    tests: [
      { id: "t1", label: "8", stdin: "8\n", expected: "yes" },
      { id: "t2", label: "6", stdin: "6\n", expected: "no" },
      { id: "t3", label: "1", stdin: "1\n", expected: "yes", hidden: true },
      { id: "t4", label: "1024", stdin: "1024\n", expected: "yes", hidden: true },
    ],
  },
  {
    id: "grade-letter",
    title: "Letter Grade",
    difficulty: "easy",
    langId: "csharp",
    description:
      'Read an integer score 0–100. Print A if ≥90, B if ≥80, C if ≥70, D if ≥60, else F.',
    starterCode: `using System;

public class Program {
    public static void Main() {
        int score = int.Parse(Console.ReadLine() ?? "0");
        // TODO: print letter grade
    }
}
`,
    tests: [
      { id: "t1", label: "95 → A", stdin: "95\n", expected: "A" },
      { id: "t2", label: "82 → B", stdin: "82\n", expected: "B" },
      { id: "t3", label: "70 → C", stdin: "70\n", expected: "C", hidden: true },
      { id: "t4", label: "59 → F", stdin: "59\n", expected: "F", hidden: true },
    ],
  },
  {
    id: "array-average",
    title: "Average (Integer)",
    difficulty: "easy",
    langId: "javascript",
    description:
      "Given the array in the starter, print the integer average (truncate toward zero): sum / length.",
    starterCode: `const nums = [10, 20, 30, 40];
// TODO: print integer average
console.log(0);
`,
    tests: [
      { id: "t1", label: "Fixed array", stdin: "", expected: "25" },
    ],
  },
  {
    id: "second-largest",
    title: "Second Largest",
    difficulty: "medium",
    langId: "java",
    description:
      "First line: n (n ≥ 2). Second line: n distinct integers. Print the second largest value.",
    starterCode: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        // TODO: read n ints, print second largest
        sc.close();
    }
}
`,
    tests: [
      { id: "t1", label: "Sample 1", stdin: "5\n3 1 4 2 5\n", expected: "4" },
      { id: "t2", label: "Sample 2", stdin: "3\n10 20 15\n", expected: "15" },
      {
        id: "t3",
        label: "Negatives",
        stdin: "4\n-1 -5 -2 -9\n",
        expected: "-2",
        hidden: true,
      },
    ],
  },
  {
    id: "gcd-two",
    title: "GCD of Two Numbers",
    difficulty: "medium",
    langId: "python",
    description:
      "Read two positive integers a and b (one per line). Print gcd(a, b).",
    starterCode: `a = int(input())
b = int(input())
# TODO: print gcd(a, b)
`,
    tests: [
      { id: "t1", label: "12 18", stdin: "12\n18\n", expected: "6" },
      { id: "t2", label: "7 13", stdin: "7\n13\n", expected: "1" },
      {
        id: "t3",
        label: "100 25",
        stdin: "100\n25\n",
        expected: "25",
        hidden: true,
      },
    ],
  },
  {
    id: "prime-check",
    title: "Is Prime?",
    difficulty: "medium",
    langId: "cpp",
    description:
      'Read one integer n (n ≥ 2). Print "yes" if n is prime, otherwise "no".',
    starterCode: `#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;
    // TODO: print "yes" or "no"
    return 0;
}
`,
    tests: [
      { id: "t1", label: "7", stdin: "7\n", expected: "yes" },
      { id: "t2", label: "9", stdin: "9\n", expected: "no" },
      { id: "t3", label: "2", stdin: "2\n", expected: "yes", hidden: true },
      { id: "t4", label: "1", stdin: "1\n", expected: "no", hidden: true },
    ],
  },
  {
    id: "fibonacci-nth",
    title: "Nth Fibonacci",
    difficulty: "medium",
    langId: "rust",
    description:
      "Read n (0 ≤ n ≤ 30). Print the n-th Fibonacci number where F(0)=0, F(1)=1, F(2)=1, …",
    starterCode: `use std::io::{self, BufRead};

fn main() {
    let line = io::stdin().lock().lines().next().unwrap().unwrap();
    let n: u32 = line.trim().parse().unwrap();
    // TODO: print F(n)
    println!("0");
}
`,
    tests: [
      { id: "t1", label: "F(0)", stdin: "0\n", expected: "0" },
      { id: "t2", label: "F(6)", stdin: "6\n", expected: "8" },
      { id: "t3", label: "F(10)", stdin: "10\n", expected: "55", hidden: true },
    ],
  },
  {
    id: "word-count",
    title: "Word Count",
    difficulty: "easy",
    langId: "ruby",
    description:
      "Read one line. Print the number of words (separated by spaces). Empty line → 0.",
    starterCode: `line = gets.to_s.chomp
# TODO: print word count
`,
    tests: [
      { id: "t1", label: "Three words", stdin: "hello world code\n", expected: "3" },
      { id: "t2", label: "One", stdin: "hi\n", expected: "1" },
      {
        id: "t3",
        label: "Empty",
        stdin: "\n",
        expected: "0",
        hidden: true,
      },
    ],
  },
  {
    id: "multiplication-table",
    title: "Multiplication Table Row",
    difficulty: "easy",
    langId: "php",
    description:
      "Read integer n. Print n*1, n*2, …, n*10 separated by single spaces on one line.",
    starterCode: `<?php
$n = (int) trim(fgets(STDIN));
// TODO: print n*1 .. n*10 space-separated
`,
    tests: [
      {
        id: "t1",
        label: "n=2",
        stdin: "2\n",
        expected: "2 4 6 8 10 12 14 16 18 20",
      },
      {
        id: "t2",
        label: "n=5",
        stdin: "5\n",
        expected: "5 10 15 20 25 30 35 40 45 50",
      },
    ],
  },
  {
    id: "sql-count-high",
    title: "SQL: Count High Scores",
    difficulty: "easy",
    langId: "sql",
    description:
      "Using the given scores table, write a query that returns a single number: how many rows have score > 80.",
    starterCode: `CREATE TABLE scores (
  name TEXT,
  score INTEGER
);

INSERT INTO scores VALUES
  ('Ada', 95),
  ('Grace', 88),
  ('Alan', 70),
  ('Lin', 91);

-- TODO: count rows where score > 80
`,
    tests: [
      {
        id: "t1",
        label: "Count",
        stdin: "",
        expected: "3",
      },
    ],
  },
  {
    id: "two-sum-sorted",
    title: "Two Sum (Sorted)",
    difficulty: "hard",
    langId: "python",
    description:
      "First line: n and target. Second line: n strictly increasing integers. Print two 1-based indices i j (i < j) such that a[i]+a[j]=target. Exactly one solution exists.",
    starterCode: `n, target = map(int, input().split())
a = list(map(int, input().split()))
# TODO: print two 1-based indices
`,
    tests: [
      {
        id: "t1",
        label: "Sample 1",
        stdin: "4 9\n2 7 11 15\n",
        expected: "1 2",
      },
      {
        id: "t2",
        label: "Sample 2",
        stdin: "3 6\n1 2 4\n",
        expected: "2 3",
      },
      {
        id: "t3",
        label: "Hidden",
        stdin: "5 10\n1 3 5 7 9\n",
        expected: "2 5",
        hidden: true,
      },
    ],
  },
  {
    id: "anagram-check",
    title: "Anagram Check",
    difficulty: "medium",
    langId: "go",
    description:
      'Read two lowercase words (one per line). Print "yes" if they are anagrams of each other, otherwise "no".',
    starterCode: `package main

import "fmt"

func main() {
	var a, b string
	fmt.Scan(&a)
	fmt.Scan(&b)
	// TODO: print "yes" or "no"
}
`,
    tests: [
      { id: "t1", label: "listen/silent", stdin: "listen\nsilent\n", expected: "yes" },
      { id: "t2", label: "hello/world", stdin: "hello\nworld\n", expected: "no" },
      {
        id: "t3",
        label: "abc/cab",
        stdin: "abc\ncab\n",
        expected: "yes",
        hidden: true,
      },
    ],
  },
  {
    id: "matrix-diagonal-sum",
    title: "Diagonal Sum",
    difficulty: "medium",
    langId: "java",
    description:
      "First line: n. Next n lines: n integers each (matrix). Print the sum of the main diagonal (i==j).",
    starterCode: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        // TODO: read matrix, print main diagonal sum
        sc.close();
    }
}
`,
    tests: [
      {
        id: "t1",
        label: "2x2",
        stdin: "2\n1 2\n3 4\n",
        expected: "5",
      },
      {
        id: "t2",
        label: "3x3",
        stdin: "3\n1 0 0\n0 2 0\n0 0 3\n",
        expected: "6",
      },
    ],
  },
  {
    id: "ts-filter-even",
    title: "Filter Evens (TypeScript)",
    difficulty: "easy",
    langId: "typescript",
    description:
      "From the array below, print only even numbers, each on its own line, in order.",
    starterCode: `const nums: number[] = [1, 2, 3, 4, 5, 6, 7, 8];
// TODO: print each even number on its own line
`,
    tests: [
      {
        id: "t1",
        label: "Evens",
        stdin: "",
        expected: "2\n4\n6\n8",
      },
    ],
  },
  {
    id: "c-swap-print",
    title: "Swap Two Numbers",
    difficulty: "easy",
    langId: "c",
    description:
      "Read two integers a and b. Print them swapped (b then a) separated by a space.",
    starterCode: `#include <stdio.h>

int main(void) {
    int a, b;
    scanf("%d %d", &a, &b);
    // TODO: print b a
    return 0;
}
`,
    tests: [
      { id: "t1", label: "1 2", stdin: "1 2\n", expected: "2 1" },
      { id: "t2", label: "9 0", stdin: "9 0\n", expected: "0 9" },
    ],
  },
  {
    id: "hard-brackets",
    title: "Balanced Brackets",
    difficulty: "hard",
    langId: "python",
    description:
      'Read one line containing only (), [], {}. Print "yes" if brackets are correctly balanced, otherwise "no".',
    starterCode: `s = input().strip()
# TODO: print "yes" or "no"
`,
    tests: [
      { id: "t1", label: "Valid", stdin: "()[]{}\n", expected: "yes" },
      { id: "t2", label: "Invalid", stdin: "([)]\n", expected: "no" },
      {
        id: "t3",
        label: "Nested",
        stdin: "{[()]}\n",
        expected: "yes",
        hidden: true,
      },
      {
        id: "t4",
        label: "Empty",
        stdin: "\n",
        expected: "yes",
        hidden: true,
      },
    ],
  },
  {
    id: "kt-sum-digits",
    title: "Sum of Digits",
    difficulty: "easy",
    langId: "kotlin",
    description: "Read a non-negative integer (as a string of digits). Print the sum of its digits.",
    starterCode: `fun main() {
    val s = readLine()!!.trim()
    // TODO: print sum of digits
}
`,
    tests: [
      { id: "t1", label: "123", stdin: "123\n", expected: "6" },
      { id: "t2", label: "999", stdin: "999\n", expected: "27" },
      { id: "t3", label: "0", stdin: "0\n", expected: "0", hidden: true },
    ],
  },
  {
    id: "cs-factorial-iter",
    title: "Factorial (C#)",
    difficulty: "medium",
    langId: "csharp",
    description: "Read n (0 ≤ n ≤ 12). Print n! using an iterative approach.",
    starterCode: `using System;

public class Program {
    public static void Main() {
        int n = int.Parse(Console.ReadLine() ?? "0");
        // TODO: print n!
        Console.WriteLine(n);
    }
}
`,
    tests: [
      { id: "t1", label: "4!", stdin: "4\n", expected: "24" },
      { id: "t2", label: "0!", stdin: "0\n", expected: "1" },
      { id: "t3", label: "7!", stdin: "7\n", expected: "5040", hidden: true },
    ],
  },
  {
    id: "sql-avg-score",
    title: "SQL: Average Score",
    difficulty: "medium",
    langId: "sql",
    description:
      "Using the scores table, print the average score as a single value (SQLite may print a float).",
    starterCode: `CREATE TABLE scores (
  name TEXT,
  score INTEGER
);

INSERT INTO scores VALUES
  ('Ada', 100),
  ('Grace', 80),
  ('Alan', 90);

-- TODO: SELECT AVG(score) FROM scores
`,
    tests: [
      {
        id: "t1",
        label: "Average",
        stdin: "",
        expected: "90.0",
      },
    ],
  },
  {
    id: "hard-longest-word",
    title: "Longest Word",
    difficulty: "hard",
    langId: "cpp",
    description:
      "Read one line of words separated by spaces. Print the longest word. If ties, print the first one that appears.",
    starterCode: `#include <iostream>
#include <string>
#include <sstream>
using namespace std;

int main() {
    string line;
    getline(cin, line);
    // TODO: print longest word
    return 0;
}
`,
    tests: [
      {
        id: "t1",
        label: "Sample 1",
        stdin: "to be or not to be\n",
        expected: "not",
      },
      {
        id: "t2",
        label: "Sample 2",
        stdin: "a bb ccc dd\n",
        expected: "ccc",
      },
      {
        id: "t3",
        label: "Tie first",
        stdin: "cat dog bat\n",
        expected: "cat",
        hidden: true,
      },
    ],
  },
];

export function getProblem(id: string): Problem | undefined {
  return PROBLEMS.find((p) => p.id === id);
}

/** Normalize stdout for test comparison. */
export function normalizeOutput(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trimEnd()
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function outputsMatch(actual: string, expected: string): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

export type TestRunResult = {
  testId: string;
  label: string;
  hidden?: boolean;
  passed: boolean;
  actual: string;
  expected: string;
  time?: string | null;
  memory?: number | null;
  error?: string;
};

export async function runProblemTests(
  problem: Problem,
  code: string,
  /** Language the student is using (may differ from problem.langId) */
  language?: LangId
): Promise<TestRunResult[]> {
  const results: TestRunResult[] = [];
  const runLang = language ?? problem.langId;

  for (const test of problem.tests) {
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          stdin: test.stdin,
          language: runLang,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        compile?: { failed: boolean; stderr: string };
        run?: {
          stdout: string;
          stderr: string;
          code: number | null;
          time?: string | null;
          memory?: number | null;
        };
      };

      if (!data.ok) {
        results.push({
          testId: test.id,
          label: test.label,
          hidden: test.hidden,
          passed: false,
          actual: "",
          expected: test.expected,
          error: data.error || "Run failed",
        });
        continue;
      }

      if (data.compile?.failed) {
        results.push({
          testId: test.id,
          label: test.label,
          hidden: test.hidden,
          passed: false,
          actual: "",
          expected: test.expected,
          error: data.compile.stderr || "Compilation failed",
        });
        // No point continuing if compile fails
        for (const rest of problem.tests.slice(results.length)) {
          results.push({
            testId: rest.id,
            label: rest.label,
            hidden: rest.hidden,
            passed: false,
            actual: "",
            expected: rest.expected,
            error: "Skipped (compile error)",
          });
        }
        break;
      }

      const actual = data.run?.stdout ?? "";
      const passed = outputsMatch(actual, test.expected);
      results.push({
        testId: test.id,
        label: test.label,
        hidden: test.hidden,
        passed,
        actual,
        expected: test.expected,
        time: data.run?.time,
        memory: data.run?.memory,
        error: !passed && data.run?.stderr ? data.run.stderr : undefined,
      });
    } catch (err) {
      results.push({
        testId: test.id,
        label: test.label,
        hidden: test.hidden,
        passed: false,
        actual: "",
        expected: test.expected,
        error: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  return results;
}
