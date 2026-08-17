import type { LangId } from "@/lib/languages";

export type GalleryItem = {
  id: string;
  title: string;
  description: string;
  category: "basics" | "algorithms" | "web" | "data";
  langId: LangId;
  code: string;
  stdin?: string;
};

export const GALLERY_CATEGORIES: {
  id: GalleryItem["category"];
  label: string;
}[] = [
  { id: "basics", label: "Basics" },
  { id: "algorithms", label: "Algorithms" },
  { id: "web", label: "Web" },
  { id: "data", label: "Data" },
];

export const GALLERY: GalleryItem[] = [
  {
    id: "py-hello",
    title: "Python Hello + Input",
    description: "Read name and number, print a greeting.",
    category: "basics",
    langId: "python",
    code: `name = input("Name: ")
n = int(input("Number: "))
print(f"Hi {name}, double is {n * 2}")
`,
  },
  {
    id: "java-loop",
    title: "Java For Loop",
    description: "Print numbers 1–10 with a for loop.",
    category: "basics",
    langId: "java",
    code: `public class Main {
    public static void main(String[] args) {
        for (int i = 1; i <= 10; i++) {
            System.out.println(i);
        }
    }
}
`,
  },
  {
    id: "go-fizzbuzz",
    title: "Go FizzBuzz",
    description: "Classic FizzBuzz 1–20 in Go.",
    category: "basics",
    langId: "go",
    code: `package main

import "fmt"

func main() {
	for i := 1; i <= 20; i++ {
		switch {
		case i%15 == 0:
			fmt.Println("FizzBuzz")
		case i%3 == 0:
			fmt.Println("Fizz")
		case i%5 == 0:
			fmt.Println("Buzz")
		default:
			fmt.Println(i)
		}
	}
}
`,
  },
  {
    id: "ts-types",
    title: "TypeScript Types",
    description: "Interfaces and typed functions.",
    category: "basics",
    langId: "typescript",
    code: `interface User {
  name: string;
  age: number;
}

function introduce(u: User): string {
  return \`\${u.name} is \${u.age} years old\`;
}

const user: User = { name: "Ada", age: 36 };
console.log(introduce(user));
`,
  },
  {
    id: "rust-fib",
    title: "Rust Fibonacci",
    description: "Print the first 12 Fibonacci numbers.",
    category: "algorithms",
    langId: "rust",
    code: `fn main() {
    let mut a: u64 = 0;
    let mut b: u64 = 1;
    for _ in 0..12 {
        println!("{}", a);
        let next = a + b;
        a = b;
        b = next;
    }
}
`,
  },
  {
    id: "kt-factorial",
    title: "Kotlin Factorial",
    description: "Recursive factorial for n = 6.",
    category: "algorithms",
    langId: "kotlin",
    code: `fun factorial(n: Int): Long =
    if (n <= 1) 1 else n * factorial(n - 1)

fun main() {
    val n = 6
    println("factorial($n) = \${factorial(n)}")
}
`,
  },
  {
    id: "cpp-binary-search",
    title: "C++ Binary Search",
    description: "Search for a target in a sorted array.",
    category: "algorithms",
    langId: "cpp",
    code: `#include <iostream>
#include <vector>
using namespace std;

int binarySearch(const vector<int>& a, int target) {
    int lo = 0, hi = (int)a.size() - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] == target) return mid;
        if (a[mid] < target) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}

int main() {
    vector<int> a = {1, 3, 5, 7, 9, 11};
    cout << binarySearch(a, 7) << endl;   // 3
    cout << binarySearch(a, 4) << endl;   // -1
    return 0;
}
`,
  },
  {
    id: "py-bubble",
    title: "Python Bubble Sort",
    description: "Sort a list in ascending order.",
    category: "algorithms",
    langId: "python",
    code: `def bubble_sort(arr):
    a = list(arr)
    n = len(a)
    for i in range(n):
        for j in range(0, n - i - 1):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
    return a

nums = [5, 1, 4, 2, 8]
print(bubble_sort(nums))
`,
  },
  {
    id: "html-card",
    title: "HTML Profile Card",
    description: "A simple styled profile card page.",
    category: "web",
    langId: "html",
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Profile Card</title>
  <style>
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0;
    }
    .card {
      width: 280px; padding: 1.5rem; border-radius: 16px;
      background: #1e293b; border: 1px solid #334155; text-align: center;
    }
    .avatar {
      width: 72px; height: 72px; margin: 0 auto 1rem; border-radius: 50%;
      background: linear-gradient(135deg, #38bdf8, #a78bfa);
    }
    h1 { margin: 0 0 .25rem; font-size: 1.25rem; }
    p { margin: 0; color: #94a3b8; font-size: .9rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="avatar"></div>
    <h1>Alex Dev</h1>
    <p>Frontend · Open source</p>
  </div>
</body>
</html>
`,
  },
  {
    id: "css-button",
    title: "CSS Fancy Button",
    description: "Hover effects on a demo button.",
    category: "web",
    langId: "css",
    code: `body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #111827;
  font-family: system-ui, sans-serif;
}

.box {
  text-align: center;
  color: #e5e7eb;
}

.box h1 { font-size: 1.25rem; margin-bottom: 1rem; }

.badge {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: 999px;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  color: white;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
  transition: transform 0.2s, box-shadow 0.2s;
}

.badge:hover {
  transform: translateY(-3px) scale(1.03);
  box-shadow: 0 12px 28px rgba(139, 92, 246, 0.45);
}
`,
  },
  {
    id: "js-array",
    title: "JS Array Methods",
    description: "map, filter, reduce demo in the browser.",
    category: "basics",
    langId: "javascript",
    code: `const nums = [1, 2, 3, 4, 5, 6];

const doubled = nums.map((n) => n * 2);
const evens = nums.filter((n) => n % 2 === 0);
const sum = nums.reduce((a, b) => a + b, 0);

console.log("doubled:", doubled);
console.log("evens:", evens);
console.log("sum:", sum);
`,
  },
  {
    id: "sql-join",
    title: "SQL JOIN",
    description: "Join students with grades.",
    category: "data",
    langId: "sql",
    code: `CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT
);

CREATE TABLE grades (
  student_id INTEGER,
  course TEXT,
  score INTEGER
);

INSERT INTO students VALUES (1, 'Ada'), (2, 'Grace'), (3, 'Alan');
INSERT INTO grades VALUES
  (1, 'Math', 95),
  (1, 'CS', 98),
  (2, 'Math', 90),
  (3, 'CS', 88);

SELECT s.name, g.course, g.score
FROM students s
JOIN grades g ON g.student_id = s.id
ORDER BY g.score DESC;
`,
  },
  {
    id: "php-hello",
    title: "PHP Hello",
    description: "Simple PHP script with string and loop.",
    category: "basics",
    langId: "php",
    code: `<?php
echo "Hello from PHP!\\n";
for ($i = 1; $i <= 5; $i++) {
    echo "Count: $i\\n";
}
`,
  },
  {
    id: "rb-hash",
    title: "Ruby Hash",
    description: "Work with a hash of scores.",
    category: "basics",
    langId: "ruby",
    code: `scores = { "Ada" => 95, "Grace" => 88, "Alan" => 91 }

scores.each do |name, score|
  puts "#{name}: #{score}"
end

avg = scores.values.sum.to_f / scores.size
puts "Average: #{avg.round(1)}"
`,
  },
  {
    id: "cs-linq-style",
    title: "C# LINQ-style",
    description: "Filter and project a list of numbers.",
    category: "basics",
    langId: "csharp",
    code: `using System;
using System.Linq;

public class Program {
    public static void Main() {
        int[] nums = { 1, 2, 3, 4, 5, 6, 7, 8, 9 };
        var result = nums
            .Where(n => n % 2 == 0)
            .Select(n => n * n);

        foreach (var x in result) {
            Console.WriteLine(x);
        }
    }
}
`,
  },
  {
    id: "py-list-comp",
    title: "Python List Comprehension",
    description: "Squares of even numbers with a list comprehension.",
    category: "basics",
    langId: "python",
    code: `nums = list(range(1, 11))
squares = [n * n for n in nums if n % 2 == 0]
print(squares)
`,
  },
  {
    id: "java-array-sum",
    title: "Java Array Sum",
    description: "Sum all elements of an int array.",
    category: "basics",
    langId: "java",
    code: `public class Main {
    public static void main(String[] args) {
        int[] a = {4, 8, 15, 16, 23, 42};
        int sum = 0;
        for (int x : a) sum += x;
        System.out.println(sum);
    }
}
`,
  },
  {
    id: "c-pointers-swap",
    title: "C Swap with Pointers",
    description: "Swap two ints using pointers.",
    category: "basics",
    langId: "c",
    code: `#include <stdio.h>

void swap(int *x, int *y) {
    int t = *x;
    *x = *y;
    *y = t;
}

int main(void) {
    int a = 3, b = 7;
    printf("before: %d %d\\n", a, b);
    swap(&a, &b);
    printf("after:  %d %d\\n", a, b);
    return 0;
}
`,
  },
  {
    id: "go-slices",
    title: "Go Slices",
    description: "Append and iterate a slice of strings.",
    category: "basics",
    langId: "go",
    code: `package main

import "fmt"

func main() {
	langs := []string{"Go", "Rust", "Python"}
	langs = append(langs, "TypeScript")
	for i, v := range langs {
		fmt.Printf("%d: %s\\n", i, v)
	}
}
`,
  },
  {
    id: "kt-when",
    title: "Kotlin when",
    description: "Map day numbers to names with when.",
    category: "basics",
    langId: "kotlin",
    code: `fun dayName(d: Int): String = when (d) {
    1 -> "Mon"
    2 -> "Tue"
    3 -> "Wed"
    4 -> "Thu"
    5 -> "Fri"
    6 -> "Sat"
    7 -> "Sun"
    else -> "?"
}

fun main() {
    for (i in 1..7) println("$i -> \${dayName(i)}")
}
`,
  },
  {
    id: "py-two-sum",
    title: "Python Two Sum Brute Force",
    description: "Find indices of two numbers that add to target.",
    category: "algorithms",
    langId: "python",
    code: `def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return i, j
    return None

print(two_sum([2, 7, 11, 15], 9))
print(two_sum([3, 2, 4], 6))
`,
  },
  {
    id: "cpp-stack",
    title: "C++ Stack (Brackets)",
    description: "Check balanced parentheses with a stack.",
    category: "algorithms",
    langId: "cpp",
    code: `#include <iostream>
#include <stack>
#include <string>
using namespace std;

bool balanced(const string& s) {
    stack<char> st;
    for (char c : s) {
        if (c == '(') st.push(c);
        else if (c == ')') {
            if (st.empty()) return false;
            st.pop();
        }
    }
    return st.empty();
}

int main() {
    cout << (balanced("(())()") ? "yes" : "no") << endl;
    cout << (balanced("(()") ? "yes" : "no") << endl;
    return 0;
}
`,
  },
  {
    id: "rust-hashmap",
    title: "Rust HashMap Frequency",
    description: "Count character frequencies in a string.",
    category: "algorithms",
    langId: "rust",
    code: `use std::collections::HashMap;

fn main() {
    let s = "banana";
    let mut freq = HashMap::new();
    for ch in s.chars() {
        *freq.entry(ch).or_insert(0) += 1;
    }
    for (ch, count) in &freq {
        println!("{}: {}", ch, count);
    }
}
`,
  },
  {
    id: "java-binary-search",
    title: "Java Binary Search",
    description: "Search a sorted array and print the index.",
    category: "algorithms",
    langId: "java",
    code: `public class Main {
    static int binarySearch(int[] a, int target) {
        int lo = 0, hi = a.length - 1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (a[mid] == target) return mid;
            if (a[mid] < target) lo = mid + 1;
            else hi = mid - 1;
        }
        return -1;
    }

    public static void main(String[] args) {
        int[] a = {1, 3, 5, 7, 9, 11};
        System.out.println(binarySearch(a, 7));
        System.out.println(binarySearch(a, 2));
    }
}
`,
  },
  {
    id: "sql-group-by",
    title: "SQL GROUP BY",
    description: "Average score per course.",
    category: "data",
    langId: "sql",
    code: `CREATE TABLE grades (
  course TEXT,
  score INTEGER
);

INSERT INTO grades VALUES
  ('Math', 90),
  ('Math', 80),
  ('CS', 95),
  ('CS', 85),
  ('CS', 100);

SELECT course, AVG(score) AS avg_score
FROM grades
GROUP BY course
ORDER BY course;
`,
  },
  {
    id: "sql-where-like",
    title: "SQL WHERE LIKE",
    description: "Find names starting with A.",
    category: "data",
    langId: "sql",
    code: `CREATE TABLE people (name TEXT, city TEXT);

INSERT INTO people VALUES
  ('Ada', 'London'),
  ('Alan', 'Manchester'),
  ('Grace', 'New York'),
  ('Alice', 'Paris');

SELECT name, city FROM people
WHERE name LIKE 'A%'
ORDER BY name;
`,
  },
  {
    id: "html-form",
    title: "HTML Form Demo",
    description: "Simple login-style form layout.",
    category: "web",
    langId: "html",
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Form</title>
  <style>
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: system-ui, sans-serif; background: #0b1220; color: #e2e8f0;
    }
    form {
      width: 280px; padding: 1.5rem; border-radius: 12px;
      background: #1e293b; border: 1px solid #334155;
      display: flex; flex-direction: column; gap: 0.75rem;
    }
    label { font-size: 0.85rem; color: #94a3b8; }
    input {
      padding: 0.55rem 0.7rem; border-radius: 8px; border: 1px solid #475569;
      background: #0f172a; color: #e2e8f0;
    }
    button {
      margin-top: 0.5rem; padding: 0.65rem; border: none; border-radius: 8px;
      background: #3b82f6; color: white; font-weight: 600; cursor: pointer;
    }
    button:hover { background: #60a5fa; }
  </style>
</head>
<body>
  <form onsubmit="event.preventDefault(); alert('Submitted!');">
    <div>
      <label>Email</label>
      <input type="email" placeholder="you@example.com" required />
    </div>
    <div>
      <label>Password</label>
      <input type="password" placeholder="••••••••" required />
    </div>
    <button type="submit">Sign in</button>
  </form>
</body>
</html>
`,
  },
  {
    id: "css-grid-cards",
    title: "CSS Grid Cards",
    description: "Three-column card grid on the demo box.",
    category: "web",
    langId: "css",
    code: `body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #0f172a;
  font-family: system-ui, sans-serif;
  color: #e2e8f0;
}

.box {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  width: min(420px, 90vw);
  padding: 1rem;
  border-radius: 16px;
  background: #1e293b;
  border: 1px solid #334155;
}

.box h1 {
  grid-column: 1 / -1;
  margin: 0 0 0.25rem;
  font-size: 1rem;
  text-align: center;
}

.box p, .badge {
  margin: 0;
  padding: 0.75rem;
  border-radius: 10px;
  background: #0f172a;
  border: 1px solid #334155;
  font-size: 0.8rem;
  text-align: center;
}

.badge {
  grid-column: 1 / -1;
  color: #4ade80;
  border-color: #166534;
  background: #052e16;
}
`,
  },
  {
    id: "js-promise",
    title: "JS Async Delay",
    description: "Simulate async work with a tiny delay loop.",
    category: "basics",
    langId: "javascript",
    code: `function delayLog(msg, ms) {
  // Simple sync demo (browser sandbox has no real sleep)
  console.log("start:", msg);
  let t = Date.now();
  while (Date.now() - t < ms) {}
  console.log("done after ~" + ms + "ms");
}

delayLog("task A", 5);
console.log("all finished");
`,
  },
  {
    id: "ts-generics",
    title: "TypeScript Generics",
    description: "Generic identity and first() helpers.",
    category: "basics",
    langId: "typescript",
    code: `function identity<T>(value: T): T {
  return value;
}

function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

console.log(identity<string>("hello"));
console.log(first([10, 20, 30]));
console.log(first(["a", "b"]));
`,
  },
  {
    id: "py-dict-merge",
    title: "Python Dict Merge",
    description: "Merge two dicts and pretty-print keys.",
    category: "data",
    langId: "python",
    code: `a = {"name": "Ada", "role": "Engineer"}
b = {"city": "London", "role": "Mathematician"}
merged = {**a, **b}
for k, v in merged.items():
    print(f"{k}: {v}")
`,
  },
  {
    id: "rust-struct",
    title: "Rust Struct",
    description: "Define a Point and compute distance-ish metric.",
    category: "basics",
    langId: "rust",
    code: `struct Point {
    x: f64,
    y: f64,
}

impl Point {
    fn manhattan(&self, other: &Point) -> f64 {
        (self.x - other.x).abs() + (self.y - other.y).abs()
    }
}

fn main() {
    let a = Point { x: 0.0, y: 0.0 };
    let b = Point { x: 3.0, y: 4.0 };
    println!("manhattan = {}", a.manhattan(&b));
}
`,
  },
];

export function getGalleryItem(id: string): GalleryItem | undefined {
  return GALLERY.find((g) => g.id === id);
}
