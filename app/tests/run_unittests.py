#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Run all unittest-based tests for the sat-annotator backend.
"""
import sys
import os
import unittest
import re
import subprocess
from pathlib import Path


def main():
    """Run all unittest-based tests."""
    # Get the directory of this script
    script_dir = Path(__file__).resolve().parent
    
    # Get the app directory (parent of tests directory)
    app_dir = script_dir.parent
    
    # Add the app directory to sys.path
    if str(app_dir) not in sys.path:
        sys.path.insert(0, str(app_dir))
    
    # Set environment variable to indicate we're in test mode
    os.environ["SAT_ANNOTATOR_TEST_MODE"] = "1"
    
    # Get a list of unittest files
    unittest_files = [
        "unittest_session_store.py",
        "unittest_session_manager.py", 
        "unittest_image_processing.py",
        "unittest_main_api.py",
        "unittest_sam_segmenter.py",
        "unittest_session_images_api.py",
        "unittest_segmentation_api.py"
    ]
    
    # Import and run each unittest file separately
    results = []
    all_tests = 0
    failures = 0
    errors = 0
    
    for test_file in unittest_files:
        print(f"\n===== Running {test_file} =====")
        test_path = script_dir / test_file
        
        # Run the test file as a subprocess with timeout
        try:
            # Run with real-time output for better debugging
            print(f"Running: python {test_path}")
            result = subprocess.run(
                [sys.executable, str(test_path)],
                capture_output=True,
                text=True,
                timeout=30  # Add timeout to catch hanging tests
            )
            # Print output
            if result.stdout:
                print(result.stdout)
            else:
                print("(No output)")
                
            if result.stderr:
                print("ERRORS:")
                print(result.stderr)
            
            # Determine test status
            stdout_content = result.stdout or ""
            stderr_content = result.stderr or ""
            
            if "OK" in stdout_content:
                status = "PASS"
            elif "FAILED" in stdout_content or "ERROR" in stdout_content:
                status = "FAIL"
            else:
                status = "UNKNOWN"
                
        except subprocess.TimeoutExpired:
            print("ERROR: Test timed out after 30 seconds")
            status = "TIMEOUT"
            errors += 1
            result = None
              # Extract test counts if we have results
        if result:
            try:
                test_count = 0
                fail_count = 0
                error_count = 0
                
                # Get safe content to work with
                stdout_content = result.stdout or ""
                stderr_content = result.stderr or ""
                
                # Process test counts with multiple approaches for reliability
                
                # First check for explicit "Ran X tests" in stdout (standard unittest output)
                ran_match = re.search(r'Ran (\d+) test', stdout_content)
                if ran_match:
                    test_count = int(ran_match.group(1))
                # Also check output for "Tests run: X" (our custom output)
                else:
                    tests_run_match = re.search(r'Tests run: (\d+)', stdout_content)
                    if tests_run_match:
                        test_count = int(tests_run_match.group(1))
                    else:
                        # Count lines ending with "... ok" which typically appear for each test
                        ok_matches = re.findall(r'\.+ ok$', stdout_content, re.MULTILINE)
                        if ok_matches:
                            test_count = len(ok_matches)
                        else:
                            # Look for pattern "test_name (...) ... ok"
                            test_ok_matches = re.findall(r'test_\w+\s+\([^)]+\).*ok', stdout_content)
                            if test_ok_matches:
                                test_count = len(test_ok_matches)
                            else:
                                # Look for test_* methods in output as last resort
                                method_matches = re.findall(r'test_\w+', stdout_content)
                                if method_matches:
                                    test_count = len(set(method_matches))  # Use set to remove duplicates
                
                # Check for failures
                fail_matches = re.search(r'[Ff]ailures[=:]?\s*(\d+)', stdout_content)
                if fail_matches:
                    fail_count = int(fail_matches.group(1))
                
                # Check for errors
                error_matches = re.search(r'[Ee]rrors[=:]?\s*(\d+)', stdout_content)
                if error_matches:
                    error_count = int(error_matches.group(1))
                
                # Update overall counts
                all_tests += test_count
                failures += fail_count
                errors += error_count
                
                # Add to results
                results.append((test_file, status, test_count))
                
                print(f"Detected {test_count} tests, {fail_count} failures, {error_count} errors")
                
            except Exception as e:
                print(f"Error parsing test results: {e}")
                # Still add the file to results with unknown status
                results.append((test_file, "ERROR", 0))
        else:
            # Add the timed out file
            results.append((test_file, "TIMEOUT", 0))
    
    # Print summary
    print("\n\n===== TEST SUMMARY =====")
    print(f"{'Test File':<32} {'Status':<10} {'Tests':<10}")
    print("-" * 55)
    for test_file, status, count in results:
        print(f"{test_file:<32} {status:<10} {count:<10}")
    print("-" * 55)
    print(f"Total tests: {all_tests}")
    print(f"Failures:    {failures}")
    print(f"Errors:      {errors}")
    
    # Overall status
    if all_tests == 0:
        print("\nWARNING: No test results were detected!")
    elif failures == 0 and errors == 0:
        print(f"\nALL {all_tests} TESTS PASSED!")
    else:
        print(f"\nTESTS FAILED: {failures + errors} issues found in {all_tests} tests.")
    
    # Return success if all tests passed
    return 0 if failures == 0 and errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
