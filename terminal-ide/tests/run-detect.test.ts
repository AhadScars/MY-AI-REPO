import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readJavaPackage,
  resolveJavaMainClass,
  resolveJavaSourceRoot,
  isSpringBootPom,
  isSpringBootGradle,
  isSpringBootApplicationSource,
  isSpringBootRunnablePath,
  findJavaProject,
  resolveSpringBootMainClass,
  projectDependenciesLikelyMissing,
} from '../electron/main/run/run-service';

/**
 * Unit-level checks for runner extension mapping (logic mirrored from RunService.detect).
 * Full spawn tests need the Electron main process.
 */
function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.java') return 'java';
  if (ext === '.py' || ext === '.pyw') return 'python';
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return 'javascript';
  if (ext === '.ts' || ext === '.tsx') return 'typescript';
  if (ext === '.go') return 'go';
  if (ext === '.rs') return 'rust';
  if (ext === '.c') return 'c';
  if (ext === '.cpp' || ext === '.cc') return 'cpp';
  return 'unknown';
}

describe('run language detection', () => {
  it('maps common extensions', () => {
    expect(detectLanguage('A.java')).toBe('java');
    expect(detectLanguage('x.py')).toBe('python');
    expect(detectLanguage('app.js')).toBe('javascript');
    expect(detectLanguage('main.ts')).toBe('typescript');
    expect(detectLanguage('main.go')).toBe('go');
  });
});

describe('java package-aware main class', () => {
  it('reads package declaration', () => {
    expect(readJavaPackage('package school;\npublic class A {}')).toBe('school');
    expect(readJavaPackage('  package com.example.app;\n')).toBe('com.example.app');
    expect(readJavaPackage('public class A {}')).toBe('');
  });

  it('builds FQN for packaged classes', () => {
    expect(resolveJavaMainClass('SchoolManagementSystem', 'school')).toBe(
      'school.SchoolManagementSystem',
    );
    expect(resolveJavaMainClass('Main', '')).toBe('Main');
  });

  it('resolves source root from package path', () => {
    const fileDir = path.join('project', 'src', 'school');
    expect(resolveJavaSourceRoot(fileDir, 'school')).toBe(path.join('project', 'src'));
    expect(resolveJavaSourceRoot(fileDir, '')).toBe(fileDir);
  });
});

describe('spring boot detection', () => {
  it('detects Spring Boot from pom.xml', () => {
    expect(
      isSpringBootPom(`
        <parent>
          <groupId>org.springframework.boot</groupId>
          <artifactId>spring-boot-starter-parent</artifactId>
        </parent>
      `),
    ).toBe(true);
    expect(isSpringBootPom('<project><artifactId>plain-java</artifactId></project>')).toBe(
      false,
    );
  });

  it('detects Spring Boot from Gradle scripts', () => {
    expect(
      isSpringBootGradle(`
        plugins {
          id 'org.springframework.boot' version '3.2.0'
          id 'java'
        }
      `),
    ).toBe(true);
    expect(isSpringBootGradle(`plugins { id 'java' }`)).toBe(false);
  });

  it('detects @SpringBootApplication source', () => {
    expect(
      isSpringBootApplicationSource(`
        package com.example;
        import org.springframework.boot.autoconfigure.SpringBootApplication;
        @SpringBootApplication
        public class DemoApplication {}
      `),
    ).toBe(true);
    expect(isSpringBootApplicationSource('public class Main { public static void main() {} }')).toBe(
      false,
    );
  });

  it('marks typical paths as Spring Boot runnable', () => {
    expect(isSpringBootRunnablePath('/app/pom.xml')).toBe(true);
    expect(isSpringBootRunnablePath('/app/build.gradle')).toBe(true);
    expect(isSpringBootRunnablePath('/app/build.gradle.kts')).toBe(true);
    expect(isSpringBootRunnablePath('/app/src/main/resources/application.properties')).toBe(true);
    expect(isSpringBootRunnablePath('/app/src/main/java/DemoApplication.java')).toBe(true);
    expect(isSpringBootRunnablePath('/app/README.md')).toBe(false);
  });
});

describe('findJavaProject / resolveSpringBootMainClass', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-spring-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('finds Maven Spring Boot project from nested java file', () => {
    const srcDir = path.join(tmp, 'src', 'main', 'java', 'com', 'example');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(tmp, 'pom.xml'),
      `<project>
        <parent>
          <groupId>org.springframework.boot</groupId>
          <artifactId>spring-boot-starter-parent</artifactId>
          <version>3.2.0</version>
        </parent>
      </project>`,
    );
    const javaFile = path.join(srcDir, 'DemoApplication.java');
    fs.writeFileSync(
      javaFile,
      `package com.example;
@SpringBootApplication
public class DemoApplication {
  public static void main(String[] args) {}
}
`,
    );

    const project = findJavaProject(javaFile);
    expect(project).not.toBeNull();
    expect(project!.tool).toBe('maven');
    expect(project!.isSpringBoot).toBe(true);
    expect(project!.root).toBe(tmp);
    expect(resolveSpringBootMainClass(javaFile)).toBe('com.example.DemoApplication');
  });

  it('finds Gradle Spring Boot project and wrapper', () => {
    fs.writeFileSync(
      path.join(tmp, 'build.gradle'),
      `plugins { id 'org.springframework.boot' version '3.2.0' }`,
    );
    const wrapper = path.join(tmp, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
    fs.writeFileSync(wrapper, '#!/bin/sh\n');
    const appProps = path.join(tmp, 'src', 'main', 'resources');
    fs.mkdirSync(appProps, { recursive: true });
    const props = path.join(appProps, 'application.properties');
    fs.writeFileSync(props, 'server.port=8080\n');

    const project = findJavaProject(props);
    expect(project).not.toBeNull();
    expect(project!.tool).toBe('gradle');
    expect(project!.isSpringBoot).toBe(true);
    expect(project!.wrapperPath).toBe(wrapper);
  });

  it('returns non-Spring Maven project when pom has no spring-boot', () => {
    fs.writeFileSync(
      path.join(tmp, 'pom.xml'),
      `<project><artifactId>cli</artifactId></project>`,
    );
    const project = findJavaProject(path.join(tmp, 'pom.xml'));
    expect(project).not.toBeNull();
    expect(project!.isSpringBoot).toBe(false);
  });

  it('detects missing vs present Maven build output', () => {
    expect(projectDependenciesLikelyMissing(tmp, 'maven')).toBe(true);
    fs.mkdirSync(path.join(tmp, 'target', 'classes'), { recursive: true });
    expect(projectDependenciesLikelyMissing(tmp, 'maven')).toBe(false);
  });
});
