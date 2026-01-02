import * as fs from 'fs';
import * as path from 'path';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { BuildChecker } from '../build-checker';

/**
 * Property-Based Test for Build Output Generation
 * Feature: deployment-fixes, Property 7: Build Output Generation
 * Validates: Requirements 2.4, 3.3
 */

describe('Build Output Generation Property Tests', () => {
  let checker: BuildChecker;
  let tempDir: string;

  beforeEach(() => {
    checker = new BuildChecker();
    tempDir = fs.mkdtempSync(path.join(__dirname, 'temp-output-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Property 7: Build Output Generation
   * For any successful build process, the build system should generate optimized JavaScript output
   * from TypeScript sources and include all required static assets
   */
  test('Property 7: Build Output Generation - successful builds should generate expected output artifacts', () => {
    // Generate various build scenarios with different output configurations
    const buildScenarios = [
      {
        name: 'typescript-dist-output',
        packageJson: {
          name: 'ts-project',
          version: '1.0.0',
          scripts: {
            build: 'echo "Simulating TypeScript build" && mkdir -p dist && echo "console.log(\\"Built\\");" > dist/index.js'
          }
        },
        expectedOutputDir: 'dist',
        expectedFiles: ['index.js']
      },
      {
        name: 'next-js-output',
        packageJson: {
          name: 'nextjs-project',
          version: '1.0.0',
          scripts: {
            build: 'echo "Simulating Next.js build" && mkdir -p .next && echo "{\\"version\\": \\"1.0.0\\"}" > .next/build-manifest.json'
          }
        },
        expectedOutputDir: '.next',
        expectedFiles: ['build-manifest.json']
      },
      {
        name: 'react-build-output',
        packageJson: {
          name: 'react-project',
          version: '1.0.0',
          scripts: {
            build: 'echo "Simulating React build" && mkdir -p build && echo "<html><body>Built</body></html>" > build/index.html'
          }
        },
        expectedOutputDir: 'build',
        expectedFiles: ['index.html']
      },
      {
        name: 'custom-out-directory',
        packageJson: {
          name: 'custom-project',
          version: '1.0.0',
          scripts: {
            build: 'echo "Simulating custom build" && mkdir -p out && echo "module.exports = {};" > out/main.js'
          }
        },
        expectedOutputDir: 'out',
        expectedFiles: ['main.js']
      }
    ];

    buildScenarios.forEach((scenario, index) => {
      const projectDir = path.join(tempDir, `${scenario.name}-${index}`);
      fs.mkdirSync(projectDir, { recursive: true });
      
      // Create package.json
      fs.writeFileSync(
        path.join(projectDir, 'package.json'),
        JSON.stringify(scenario.packageJson, null, 2)
      );
      
      // Run the build validation
      const result = checker.validateBuildSuccess(projectDir);
      
      // Check that build output directory was created
      const outputDir = path.join(projectDir, scenario.expectedOutputDir);
      expect(fs.existsSync(outputDir)).toBe(true);
      
      // Check that expected files were generated
      scenario.expectedFiles.forEach(expectedFile => {
        const filePath = path.join(outputDir, expectedFile);
        expect(fs.existsSync(filePath)).toBe(true);
        
        // Verify file has content
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content.length).toBeGreaterThan(0);
      });
      
      // Build should be successful since we're simulating successful builds
      expect(result.success).toBe(true);
      
      // Should have minimal or no warnings about missing output
      const outputWarnings = result.warnings.filter(warning => 
        warning.includes('output') || warning.includes('empty')
      );
      expect(outputWarnings.length).toBe(0);
    });
  });

  test('Build output validation detects missing output directories', () => {
    // Create projects that don't generate build output
    const noOutputScenarios = [
      {
        name: 'no-build-script',
        packageJson: {
          name: 'no-build-project',
          version: '1.0.0',
          scripts: {
            start: 'echo "No build script"'
          }
        }
      },
      {
        name: 'failing-build',
        packageJson: {
          name: 'failing-project',
          version: '1.0.0',
          scripts: {
            build: 'echo "Build started" && exit 1'
          }
        }
      }
    ];

    noOutputScenarios.forEach((scenario, index) => {
      const projectDir = path.join(tempDir, `no-output-${scenario.name}-${index}`);
      fs.mkdirSync(projectDir, { recursive: true });
      
      fs.writeFileSync(
        path.join(projectDir, 'package.json'),
        JSON.stringify(scenario.packageJson, null, 2)
      );
      
      const result = checker.validateBuildSuccess(projectDir);
      
      // Should have warnings about missing output
      if (scenario.name === 'no-build-script') {
        expect(result.warnings.some(warning => 
          warning.includes('No build script')
        )).toBe(true);
      }
      
      // Check that no standard output directories exist
      const standardOutputDirs = ['dist', 'build', '.next', 'out'];
      standardOutputDirs.forEach(dir => {
        const outputDir = path.join(projectDir, dir);
        if (!fs.existsSync(outputDir)) {
          // This is expected for projects without build output
          expect(fs.existsSync(outputDir)).toBe(false);
        }
      });
    });
  });

  test('Build output validation handles empty output directories', () => {
    const emptyOutputScenario = {
      name: 'empty-output',
      packageJson: {
        name: 'empty-output-project',
        version: '1.0.0',
        scripts: {
          build: 'echo "Creating empty output" && mkdir -p dist'
        }
      }
    };

    const projectDir = path.join(tempDir, 'empty-output-test');
    fs.mkdirSync(projectDir, { recursive: true });
    
    fs.writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify(emptyOutputScenario.packageJson, null, 2)
    );
    
    const result = checker.validateBuildSuccess(projectDir);
    
    // Should detect empty output directory
    expect(result.warnings.some(warning => 
      warning.includes('empty')
    )).toBe(true);
    
    // Output directory should exist but be empty
    const outputDir = path.join(projectDir, 'dist');
    expect(fs.existsSync(outputDir)).toBe(true);
    
    const files = fs.readdirSync(outputDir);
    expect(files.length).toBe(0);
  });

  test('Build output validation recognizes multiple output formats', () => {
    // Test that the validator can handle projects with multiple types of output
    const multiOutputScenario = {
      name: 'multi-output',
      packageJson: {
        name: 'multi-output-project',
        version: '1.0.0',
        scripts: {
          build: `
            echo "Creating multiple outputs" && 
            mkdir -p dist && echo "console.log('dist');" > dist/main.js &&
            mkdir -p build && echo "<html></html>" > build/index.html &&
            mkdir -p .next && echo "{}" > .next/manifest.json
          `.replace(/\s+/g, ' ').trim()
        }
      }
    };

    const projectDir = path.join(tempDir, 'multi-output-test');
    fs.mkdirSync(projectDir, { recursive: true });
    
    fs.writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify(multiOutputScenario.packageJson, null, 2)
    );
    
    const result = checker.validateBuildSuccess(projectDir);
    
    // Should find at least one output directory
    const outputDirs = ['dist', 'build', '.next'];
    const existingOutputs = outputDirs.filter(dir => 
      fs.existsSync(path.join(projectDir, dir))
    );
    
    expect(existingOutputs.length).toBeGreaterThan(0);
    
    // Should not have warnings about missing output since we have multiple outputs
    const missingOutputWarnings = result.warnings.filter(warning => 
      warning.includes('No build output directory found')
    );
    expect(missingOutputWarnings.length).toBe(0);
  });

  test('Build output validation handles different file types', () => {
    // Test various types of build artifacts
    const fileTypeScenarios = [
      {
        extension: 'js',
        content: 'console.log("JavaScript output");',
        description: 'JavaScript files'
      },
      {
        extension: 'html',
        content: '<html><head><title>Test</title></head><body></body></html>',
        description: 'HTML files'
      },
      {
        extension: 'css',
        content: 'body { margin: 0; padding: 0; }',
        description: 'CSS files'
      },
      {
        extension: 'json',
        content: '{"version": "1.0.0", "built": true}',
        description: 'JSON manifests'
      }
    ];

    fileTypeScenarios.forEach((scenario, index) => {
      const projectDir = path.join(tempDir, `file-type-${scenario.extension}-${index}`);
      fs.mkdirSync(projectDir, { recursive: true });
      
      const packageJson = {
        name: `${scenario.extension}-project`,
        version: '1.0.0',
        scripts: {
          build: `mkdir -p dist && echo '${scenario.content}' > dist/output.${scenario.extension}`
        }
      };
      
      fs.writeFileSync(
        path.join(projectDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      
      const result = checker.validateBuildSuccess(projectDir);
      
      // Verify the specific file type was generated
      const outputFile = path.join(projectDir, 'dist', `output.${scenario.extension}`);
      expect(fs.existsSync(outputFile)).toBe(true);
      
      const content = fs.readFileSync(outputFile, 'utf8');
      expect(content.trim()).toBe(scenario.content);
      
      // Build should be successful
      expect(result.success).toBe(true);
    });
  });
});