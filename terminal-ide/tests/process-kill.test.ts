import { describe, it, expect } from 'vitest';
import { extractPortsFromOutput } from '../electron/main/run/process-kill';
import { classifyProblemLine } from '../src/features/run/problemHighlight';

describe('extractPortsFromOutput', () => {
  it('finds Spring Boot Tomcat port', () => {
    const log = 'Tomcat started on port(s): 8081 (http) with context path \'\'';
    expect(extractPortsFromOutput(log)).toContain(8081);
  });

  it('finds Netty and localhost URLs', () => {
    const log = 'Netty started on port(s): 9090\nLocal: http://localhost:9090/';
    const ports = extractPortsFromOutput(log);
    expect(ports).toContain(9090);
  });
});

describe('classifyProblemLine', () => {
  it('flags port already in use', () => {
    expect(
      classifyProblemLine(
        'Web server failed to start. Port 8081 was already in use.',
      ),
    ).toBe('port');
    expect(classifyProblemLine('java.net.BindException: Address already in use')).toBe(
      'port',
    );
  });

  it('flags application failed to start', () => {
    expect(classifyProblemLine('***************************\nAPPLICATION FAILED TO START')).toBe(
      'fatal',
    );
  });

  it('flags build failure', () => {
    expect(classifyProblemLine('[ERROR] BUILD FAILURE')).toBe('build');
  });
});
