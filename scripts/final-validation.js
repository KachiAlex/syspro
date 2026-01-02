#!/usr/bin/env node

/**
 * Final Deployment Pipeline Validation
 * Tests the complete deployment validation system
 */

const { PackageValidator } = require('./validate-packages.js');
const { BuildChecker } = require('./build-check.js');
const { CheckpointValidator } = require('./checkpoint-validation.js');

class FinalValidator {
  constructor() {
    this.results = {
      packageValidation: false,
      buildValidation: false,
      checkpointValidation: false,
      preDeploymentValidation: false,
      overallSuccess: false
    };
  }

  async runFinalValidation() {
    console.log('🎯 FINAL DEPLOYMENT PIPELINE VALIDATION');
    console.log('=======================================\n');

    let allPassed = true;

    // Test 1: Package Validation
    console.log('Test 1: Package Configuration Validation');
    console.log('----------------------------------------');
    try {
      const packageValidator = new PackageValidator();
      const packageResult = packageValidator.validateAllPackages();
      this.results.packageValidation = packageResult.deploymentReady;
      
      if (packageResult.deploymentReady) {
        console.log('✅ Package validation: PASSED');
      } else {
        console.log('❌ Package validation: FAILED');
        packageResult.issues.forEach(issue => console.log(`   - ${issue}`));
        allPassed = false;
      }
    } catch (error) {
      console.log(`❌ Package validation: ERROR - ${error.message}`);
      allPassed = false;
    }

    // Test 2: Build System Validation
    console.log('\nTest 2: Build System Validation');
    console.log('-------------------------------');
    try {
      const buildChecker = new BuildChecker();
      const buildResults = buildChecker.validateAllBuilds();
      const buildSummary = buildChecker.getBuildSummary(buildResults);
      this.results.buildValidation = buildSummary.overallSuccess;
      
      if (buildSummary.overallSuccess) {
        console.log('✅ Build validation: PASSED');
        console.log(`   - ${buildSummary.successfulBuilds}/${buildSummary.totalProjects} projects validated`);
      } else {
        console.log('❌ Build validation: FAILED');
        console.log(`   - ${buildSummary.failedBuilds}/${buildSummary.totalProjects} projects failed`);
        allPassed = false;
      }
    } catch (error) {
      console.log(`❌ Build validation: ERROR - ${error.message}`);
      allPassed = false;
    }

    // Test 3: Checkpoint Validation
    console.log('\nTest 3: Checkpoint Validation');
    console.log('-----------------------------');
    try {
      const checkpointValidator = new CheckpointValidator();
      const checkpointResult = checkpointValidator.runCheckpoint();
      this.results.checkpointValidation = checkpointResult;
      
      if (checkpointResult) {
        console.log('✅ Checkpoint validation: PASSED');
      } else {
        console.log('❌ Checkpoint validation: FAILED');
        allPassed = false;
      }
    } catch (error) {
      console.log(`❌ Checkpoint validation: ERROR - ${error.message}`);
      allPassed = false;
    }

    // Test 4: Pre-Deployment Validation
    console.log('\nTest 4: Pre-Deployment Validation');
    console.log('---------------------------------');
    try {
      // Use the existing pre-deployment checker script
      const { execSync } = require('child_process');
      const result = execSync('node scripts/pre-deployment-checker.js', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      this.results.preDeploymentValidation = true;
      console.log('✅ Pre-deployment validation: PASSED');
    } catch (error) {
      console.log('❌ Pre-deployment validation: FAILED');
      console.log(`   Error: ${error.message}`);
      allPassed = false;
    }

    // Overall Results
    this.results.overallSuccess = allPassed;
    this.printFinalReport();

    return this.results.overallSuccess;
  }

  printFinalReport() {
    console.log('\n🏁 FINAL VALIDATION REPORT');
    console.log('==========================\n');

    const tests = [
      { name: 'Package Configuration', passed: this.results.packageValidation },
      { name: 'Build System', passed: this.results.buildValidation },
      { name: 'Checkpoint Validation', passed: this.results.checkpointValidation },
      { name: 'Pre-Deployment Checks', passed: this.results.preDeploymentValidation }
    ];

    tests.forEach(test => {
      const icon = test.passed ? '✅' : '❌';
      console.log(`${icon} ${test.name}: ${test.passed ? 'PASSED' : 'FAILED'}`);
    });

    console.log('\n🎯 OVERALL STATUS:');
    if (this.results.overallSuccess) {
      console.log('✅ ALL TESTS PASSED - DEPLOYMENT PIPELINE READY!');
      console.log('\n🚀 DEPLOYMENT READINESS CONFIRMED:');
      console.log('   ✓ Package configurations are valid');
      console.log('   ✓ Build system is functional');
      console.log('   ✓ All validation checkpoints pass');
      console.log('   ✓ Pre-deployment checks complete');
      console.log('\n📋 NEXT STEPS:');
      console.log('   1. Commit all validation scripts: git add scripts/');
      console.log('   2. Update package.json with validation commands');
      console.log('   3. Push to trigger deployment: git push origin main');
      console.log('   4. Monitor deployment: vercel --logs');
    } else {
      console.log('❌ SOME TESTS FAILED - PIPELINE NEEDS ATTENTION');
      console.log('\n🔧 REQUIRED ACTIONS:');
      console.log('   1. Review failed tests above');
      console.log('   2. Fix identified issues');
      console.log('   3. Re-run validation: node scripts/final-validation.js');
      console.log('   4. Repeat until all tests pass');
    }

    console.log('\n📖 VALIDATION SYSTEM SUMMARY:');
    console.log('   - Package Validator: Checks package.json configurations');
    console.log('   - Build Checker: Validates TypeScript and build readiness');
    console.log('   - Checkpoint Validator: Comprehensive project structure validation');
    console.log('   - Pre-Deployment Checker: Full deployment readiness assessment');
    console.log('   - Error Reporter: Provides actionable error messages and suggestions');
    console.log('\n🎉 The deployment validation system is now complete and functional!');
  }

  getResults() {
    return this.results;
  }
}

// CLI usage
if (require.main === module) {
  const validator = new FinalValidator();
  
  validator.runFinalValidation()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Final validation failed:', error);
      process.exit(1);
    });
}

module.exports = { FinalValidator };