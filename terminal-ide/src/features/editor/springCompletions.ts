/**
 * Monaco autocomplete for Spring Boot / SpringApplication (Java).
 * Provides snippets + symbols without a full Java LSP.
 */
import type * as Monaco from 'monaco-editor';

let disposable: Monaco.IDisposable | null = null;

interface SpringItem {
  label: string;
  /** Filter / prefix match */
  filter?: string;
  insertText: string;
  detail: string;
  documentation?: string;
  kind: 'snippet' | 'class' | 'method' | 'keyword' | 'interface' | 'field';
  /** Prefer higher numbers */
  sort?: string;
}

const SPRING_ITEMS: SpringItem[] = [
  // ── SpringApplication entry ─────────────────────────────────────────────
  {
    label: 'SpringApplication',
    filter: 'SpringApplication',
    insertText: 'SpringApplication',
    detail: 'org.springframework.boot.SpringApplication',
    documentation: 'Bootstrap class for a Spring Boot application.',
    kind: 'class',
    sort: '0',
  },
  {
    label: 'SpringApplication.run',
    filter: 'SpringApplication.run',
    insertText: 'SpringApplication.run(${1:Application}.class, args);',
    detail: 'Spring Boot · start application',
    documentation: 'Launch a Spring Boot application from the main method.',
    kind: 'snippet',
    sort: '0',
  },
  {
    label: 'spring-main',
    filter: 'springmain main SpringApplication',
    insertText: [
      'public static void main(String[] args) {',
      '\tSpringApplication.run(${1:${TM_FILENAME_BASE}}.class, args);',
      '}',
    ].join('\n'),
    detail: 'Snippet · main + SpringApplication.run',
    kind: 'snippet',
    sort: '0',
  },
  {
    label: 'spring-boot-app',
    filter: 'springbootapp SpringBootApplication',
    insertText: [
      'package ${1:com.example};',
      '',
      'import org.springframework.boot.SpringApplication;',
      'import org.springframework.boot.autoconfigure.SpringBootApplication;',
      '',
      '@SpringBootApplication',
      'public class ${2:${TM_FILENAME_BASE}} {',
      '',
      '\tpublic static void main(String[] args) {',
      '\t\tSpringApplication.run(${2:${TM_FILENAME_BASE}}.class, args);',
      '\t}',
      '}',
    ].join('\n'),
    detail: 'Snippet · full Spring Boot application class',
    kind: 'snippet',
    sort: '0',
  },
  {
    label: 'import SpringApplication',
    filter: 'import SpringApplication',
    insertText: 'import org.springframework.boot.SpringApplication;',
    detail: 'Import · SpringApplication',
    kind: 'snippet',
    sort: '1',
  },
  {
    label: 'import SpringBootApplication',
    filter: 'import SpringBootApplication',
    insertText: 'import org.springframework.boot.autoconfigure.SpringBootApplication;',
    detail: 'Import · @SpringBootApplication',
    kind: 'snippet',
    sort: '1',
  },

  // ── Annotations ─────────────────────────────────────────────────────────
  {
    label: '@SpringBootApplication',
    filter: 'SpringBootApplication',
    insertText: '@SpringBootApplication',
    detail: 'Annotation · Spring Boot entry',
    kind: 'keyword',
    sort: '1',
  },
  {
    label: '@RestController',
    filter: 'RestController',
    insertText: '@RestController',
    detail: 'Annotation · REST controller',
    kind: 'keyword',
  },
  {
    label: '@Controller',
    filter: 'Controller',
    insertText: '@Controller',
    detail: 'Annotation · MVC controller',
    kind: 'keyword',
  },
  {
    label: '@Service',
    filter: 'Service',
    insertText: '@Service',
    detail: 'Annotation · service bean',
    kind: 'keyword',
  },
  {
    label: '@Repository',
    filter: 'Repository',
    insertText: '@Repository',
    detail: 'Annotation · persistence',
    kind: 'keyword',
  },
  {
    label: '@Component',
    filter: 'Component',
    insertText: '@Component',
    detail: 'Annotation · generic bean',
    kind: 'keyword',
  },
  {
    label: '@Autowired',
    filter: 'Autowired',
    insertText: '@Autowired',
    detail: 'Annotation · inject dependency',
    kind: 'keyword',
  },
  {
    label: '@GetMapping',
    filter: 'GetMapping',
    insertText: '@GetMapping("${1:/}")',
    detail: 'Annotation · HTTP GET',
    kind: 'snippet',
  },
  {
    label: '@PostMapping',
    filter: 'PostMapping',
    insertText: '@PostMapping("${1:/}")',
    detail: 'Annotation · HTTP POST',
    kind: 'snippet',
  },
  {
    label: '@PutMapping',
    filter: 'PutMapping',
    insertText: '@PutMapping("${1:/}")',
    detail: 'Annotation · HTTP PUT',
    kind: 'snippet',
  },
  {
    label: '@DeleteMapping',
    filter: 'DeleteMapping',
    insertText: '@DeleteMapping("${1:/}")',
    detail: 'Annotation · HTTP DELETE',
    kind: 'snippet',
  },
  {
    label: '@RequestMapping',
    filter: 'RequestMapping',
    insertText: '@RequestMapping("${1:/api}")',
    detail: 'Annotation · request mapping',
    kind: 'snippet',
  },
  {
    label: '@RequestBody',
    filter: 'RequestBody',
    insertText: '@RequestBody',
    detail: 'Annotation · request body',
    kind: 'keyword',
  },
  {
    label: '@PathVariable',
    filter: 'PathVariable',
    insertText: '@PathVariable ${1:String} ${2:id}',
    detail: 'Annotation · path variable',
    kind: 'snippet',
  },
  {
    label: '@RequestParam',
    filter: 'RequestParam',
    insertText: '@RequestParam ${1:String} ${2:name}',
    detail: 'Annotation · query param',
    kind: 'snippet',
  },
  {
    label: '@Entity',
    filter: 'Entity',
    insertText: '@Entity',
    detail: 'JPA · entity',
    kind: 'keyword',
  },
  {
    label: '@Table',
    filter: 'Table',
    insertText: '@Table(name = "${1:table}")',
    detail: 'JPA · table name',
    kind: 'snippet',
  },
  {
    label: '@Id',
    filter: 'Id',
    insertText: '@Id',
    detail: 'JPA · primary key',
    kind: 'keyword',
  },
  {
    label: '@GeneratedValue',
    filter: 'GeneratedValue',
    insertText: '@GeneratedValue(strategy = GenerationType.IDENTITY)',
    detail: 'JPA · generated id',
    kind: 'snippet',
  },
  {
    label: '@Column',
    filter: 'Column',
    insertText: '@Column(name = "${1:column}")',
    detail: 'JPA · column',
    kind: 'snippet',
  },
  {
    label: '@Configuration',
    filter: 'Configuration',
    insertText: '@Configuration',
    detail: 'Annotation · config class',
    kind: 'keyword',
  },
  {
    label: '@Bean',
    filter: 'Bean',
    insertText: '@Bean',
    detail: 'Annotation · bean method',
    kind: 'keyword',
  },
  {
    label: '@Value',
    filter: 'Value',
    insertText: '@Value("${${1:property.name}}")',
    detail: 'Annotation · inject property',
    kind: 'snippet',
  },
  {
    label: '@EnableAutoConfiguration',
    filter: 'EnableAutoConfiguration',
    insertText: '@EnableAutoConfiguration',
    detail: 'Annotation · auto-config',
    kind: 'keyword',
  },
  {
    label: '@EnableJpaRepositories',
    filter: 'EnableJpaRepositories',
    insertText: '@EnableJpaRepositories',
    detail: 'Annotation · JPA repositories',
    kind: 'keyword',
  },
  {
    label: '@Transactional',
    filter: 'Transactional',
    insertText: '@Transactional',
    detail: 'Annotation · transaction',
    kind: 'keyword',
  },

  // ── Common types ────────────────────────────────────────────────────────
  {
    label: 'ResponseEntity',
    filter: 'ResponseEntity',
    insertText: 'ResponseEntity',
    detail: 'org.springframework.http.ResponseEntity',
    kind: 'class',
  },
  {
    label: 'ResponseEntity.ok',
    filter: 'ResponseEntity.ok',
    insertText: 'ResponseEntity.ok(${1:body})',
    detail: 'HTTP 200 response',
    kind: 'snippet',
  },
  {
    label: 'HttpStatus',
    filter: 'HttpStatus',
    insertText: 'HttpStatus',
    detail: 'org.springframework.http.HttpStatus',
    kind: 'class',
  },
  {
    label: 'JpaRepository',
    filter: 'JpaRepository',
    insertText: 'JpaRepository<${1:Entity}, ${2:Long}>',
    detail: 'org.springframework.data.jpa.repository.JpaRepository',
    kind: 'interface',
  },
  {
    label: 'CrudRepository',
    filter: 'CrudRepository',
    insertText: 'CrudRepository<${1:Entity}, ${2:Long}>',
    detail: 'org.springframework.data.repository.CrudRepository',
    kind: 'interface',
  },
  {
    label: 'ApplicationRunner',
    filter: 'ApplicationRunner',
    insertText: 'ApplicationRunner',
    detail: 'org.springframework.boot.ApplicationRunner',
    kind: 'interface',
  },
  {
    label: 'CommandLineRunner',
    filter: 'CommandLineRunner',
    insertText: 'CommandLineRunner',
    detail: 'org.springframework.boot.CommandLineRunner',
    kind: 'interface',
  },

  // ── REST controller snippet ─────────────────────────────────────────────
  {
    label: 'spring-rest-controller',
    filter: 'restcontroller springrest',
    insertText: [
      '@RestController',
      '@RequestMapping("${1:/api}")',
      'public class ${2:Api}Controller {',
      '',
      '\t@GetMapping',
      '\tpublic String hello() {',
      '\t\treturn "${3:Hello}";',
      '\t}',
      '}',
    ].join('\n'),
    detail: 'Snippet · REST controller',
    kind: 'snippet',
    sort: '2',
  },
];

function mapKind(
  monaco: typeof Monaco,
  kind: SpringItem['kind'],
): Monaco.languages.CompletionItemKind {
  const K = monaco.languages.CompletionItemKind;
  switch (kind) {
    case 'snippet':
      return K.Snippet;
    case 'class':
      return K.Class;
    case 'method':
      return K.Method;
    case 'keyword':
      return K.Keyword;
    case 'interface':
      return K.Interface;
    case 'field':
      return K.Field;
    default:
      return K.Text;
  }
}

function wordPrefix(model: Monaco.editor.ITextModel, position: Monaco.Position): string {
  const line = model.getLineContent(position.lineNumber);
  const before = line.slice(0, position.column - 1);
  // Match trailing identifier, optional leading @
  const m = before.match(/@?[A-Za-z_][\w.]*$/);
  return m ? m[0] : '';
}

function matchesPrefix(item: SpringItem, prefix: string): boolean {
  if (!prefix) return true;
  const p = prefix.toLowerCase().replace(/^@/, '');
  if (!p) return true;
  const hay = `${item.label} ${item.filter ?? ''} ${item.detail}`.toLowerCase();
  // Allow matching when user typed "SpringApp" or "@Spring"
  return (
    item.label.toLowerCase().includes(p) ||
    (item.filter ?? '').toLowerCase().includes(p) ||
    hay.includes(p) ||
    item.label.toLowerCase().replace('@', '').startsWith(p)
  );
}

/**
 * Register Java completion items for Spring Boot / SpringApplication.
 * Safe to call multiple times (disposes previous registration).
 */
export function registerSpringCompletions(monaco: typeof Monaco): void {
  disposable?.dispose();

  disposable = monaco.languages.registerCompletionItemProvider('java', {
    triggerCharacters: ['.', '@', 'S', 's'],
    provideCompletionItems(model, position) {
      const prefix = wordPrefix(model, position);
      const word = model.getWordUntilPosition(position);
      // Range for replacing the typed prefix (include leading @)
      const line = model.getLineContent(position.lineNumber);
      const before = line.slice(0, position.column - 1);
      const atMatch = before.match(/@?[A-Za-z_][\w.]*$/);
      const startCol = atMatch
        ? position.column - atMatch[0].length
        : word.startColumn;
      const range = new monaco.Range(
        position.lineNumber,
        startCol,
        position.lineNumber,
        position.column,
      );

      const suggestions: Monaco.languages.CompletionItem[] = [];
      for (const item of SPRING_ITEMS) {
        if (!matchesPrefix(item, prefix)) continue;
        const isSnippet = item.insertText.includes('${') || item.insertText.includes('\n');
        suggestions.push({
          label: item.label,
          kind: mapKind(monaco, item.kind),
          detail: item.detail,
          documentation: item.documentation,
          insertText: item.insertText,
          insertTextRules: isSnippet
            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            : undefined,
          range,
          sortText: item.sort ?? '5' + item.label,
          filterText: item.filter ?? item.label,
        });
      }

      return { suggestions };
    },
  });
}

export function disposeSpringCompletions(): void {
  disposable?.dispose();
  disposable = null;
}
