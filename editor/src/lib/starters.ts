import {
  type LangId,
  getLanguage,
  LANGUAGES,
} from "@/lib/languages";
import type { Problem } from "@/lib/problems";
import type { GalleryItem } from "@/lib/gallery";

/** Languages suitable for I/O problems / terminal examples. */
export function runnableLangIds(): LangId[] {
  return LANGUAGES.filter(
    (l) => l.runner === "judge0" || l.runner === "browser-js"
  ).map((l) => l.id);
}

/** Whether a problem can be solved in this language. */
export function problemSupportsLang(problem: Problem, langId: LangId): boolean {
  const lang = getLanguage(langId);
  if (lang.runner === "preview") return false;
  // SQL problems only run as SQL
  if (problem.langId === "sql") return langId === "sql";
  // Non-SQL I/O problems: any Judge0 / browser JS language (not SQL)
  if (langId === "sql") return false;
  return lang.runner === "judge0" || lang.runner === "browser-js";
}

/** Languages offered for a problem in the picker. */
export function languagesForProblem(problem: Problem): LangId[] {
  return runnableLangIds().filter((id) => problemSupportsLang(problem, id));
}

/** Gallery examples: any runnable language, or the item's own language (incl. html/css). */
export function languagesForGallery(item: GalleryItem): LangId[] {
  const own = item.langId;
  const run = runnableLangIds();
  if (getLanguage(own).runner === "preview") {
    // Web examples: keep html/css + allow switching among web + all runnable
    const web: LangId[] = ["html", "css", ...run];
    return [...new Set(web)];
  }
  return run;
}

function headerComment(langId: LangId, title: string, description: string): string {
  const body = `Problem: ${title}\n${description}\nTODO: read from stdin, write answer to stdout.`;
  switch (langId) {
    case "python":
    case "ruby":
    case "sql":
      return body
        .split("\n")
        .map((l) => `# ${l}`)
        .join("\n");
    case "php":
      return (
        "<?php\n" +
        body
          .split("\n")
          .map((l) => `// ${l}`)
          .join("\n")
      );
    default:
      return body
        .split("\n")
        .map((l) => `// ${l}`)
        .join("\n");
  }
}

/** Minimal TODO starter for a language (used when no official starter exists). */
export function genericProblemStarter(
  langId: LangId,
  title: string,
  description: string
): string {
  const h = headerComment(langId, title, description);
  switch (langId) {
    case "python":
      return `${h}\n\n# n = int(input())\n`;
    case "java":
      return `${h}

import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // TODO: solve
        sc.close();
    }
}
`;
    case "c":
      return `${h}

#include <stdio.h>

int main(void) {
    // TODO: solve
    return 0;
}
`;
    case "cpp":
      return `${h}

#include <iostream>
using namespace std;

int main() {
    // TODO: solve
    return 0;
}
`;
    case "javascript":
      return `${h}

// Browser / Node style — for Judge0 tests prefer reading stdin if needed.
// console.log(answer);
`;
    case "typescript":
      return `${h}

// TODO: solve and console.log the answer
`;
    case "go":
      return `${h}

package main

import "fmt"

func main() {
	// TODO: solve
	_ = fmt.Println
}
`;
    case "rust":
      return `${h}

use std::io::{self, BufRead};

fn main() {
    let stdin = io::stdin();
    // let line = stdin.lock().lines().next().unwrap().unwrap();
    // TODO: solve
}
`;
    case "kotlin":
      return `${h}

fun main() {
    // val n = readLine()!!.toInt()
    // TODO: solve
}
`;
    case "php":
      return `${h}

// $n = (int) trim(fgets(STDIN));
// TODO: solve
`;
    case "ruby":
      return `${h}

# n = gets.to_i
# TODO: solve
`;
    case "csharp":
      return `${h}

using System;

public class Program {
    public static void Main() {
        // var n = int.Parse(Console.ReadLine() ?? "0");
        // TODO: solve
    }
}
`;
    case "sql":
      return `${h}

-- TODO: write your SQL query
`;
    default:
      return `${h}\n`;
  }
}

/**
 * Starter code for a problem in the chosen language.
 * Uses the official starter when language matches the problem default,
 * optional per-language overrides, otherwise a generic TODO template.
 */
export function getProblemStarter(problem: Problem, langId: LangId): string {
  if (langId === problem.langId) return problem.starterCode;
  const override = problem.starters?.[langId];
  if (override) return override;
  return genericProblemStarter(langId, problem.title, problem.description);
}

/**
 * Code to open for a gallery item in the chosen language.
 * Same language → original example. Different → note + that language's sample.
 */
export function getGalleryCode(item: GalleryItem, langId: LangId): string {
  if (langId === item.langId) return item.code;

  const lang = getLanguage(langId);
  const note =
    langId === "python" || langId === "ruby"
      ? `# Gallery example "${item.title}" was written for ${getLanguage(item.langId).label}.\n# Rewrite or adapt it in ${lang.label}.\n\n`
      : langId === "sql"
        ? `-- Gallery example "${item.title}" was written for ${getLanguage(item.langId).label}.\n-- Rewrite or adapt it in ${lang.label}.\n\n`
        : `// Gallery example "${item.title}" was written for ${getLanguage(item.langId).label}.\n// Rewrite or adapt it in ${lang.label}.\n\n`;

  // Prefer a light template over the full language sample for cleaner start
  if (lang.runner === "preview") {
    return note + lang.sample;
  }
  return note + lang.sample;
}
