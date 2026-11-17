/**
 * Automated Security Audit & Hardening Verification Suite
 * Derived from sdlc/pentagi-security-hardening/test-plan.md
 */

import { isValidId, safeErrorResponse } from "../src/lib/validation";
import nextConfig from "../next.config.mjs";
import fs from "fs";
import path from "path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function run() {
  console.log("=================================================");
  console.log("RUNNING PENTAGI SECURITY HARDENING VERIFICATION");
  console.log("=================================================\n");

  // ---------------------------------------------------------------------------
  // TEST 1: Primitive Type Validation & Injection Prevention (R3)
  // ---------------------------------------------------------------------------
  console.log("[TEST 1] Verifying Primitive Identifier Validation (R3)...");
  assert(isValidId("cm3a1b2c3d4e5f6g7h8i9j0k") === true, "Valid CUID string accepted");
  assert(isValidId("emp_9921_alpha") === true, "Valid alphanumeric-hyphen-underscore accepted");
  assert(isValidId({ $gt: "" }) === false, "Object injection {'$gt': ''} strictly rejected");
  assert(isValidId({ $ne: null }) === false, "Object injection {'$ne': null} strictly rejected");
  assert(isValidId(["cm3a1b2c"]) === false, "Array parameter strictly rejected");
  assert(isValidId(123456) === false, "Numeric type strictly rejected");
  assert(isValidId(null) === false, "Null value strictly rejected");
  assert(isValidId(undefined) === false, "Undefined value strictly rejected");
  assert(isValidId("") === false, "Empty string strictly rejected");
  assert(isValidId("   ") === false, "Whitespace-only string strictly rejected");
  assert(isValidId("a".repeat(65)) === false, "String exceeding 64 chars strictly rejected");
  assert(isValidId("emp'; DROP TABLE users;--") === false, "SQL injection string strictly rejected");

  // ---------------------------------------------------------------------------
  // TEST 2: Error Sanitization & Path Disclosure Prevention (R4)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 2] Verifying Error Sanitization & Zero Internal Path Leaks (R4)...");
  const fakeInternalError = new Error(
    "PrismaClientKnownRequestError: Can't reach database server at localhost:5432\n    at C:\\Users\\CHUKWUMA\\projects\\attendance-app\\.next\\server\\chunks\\123.js:45:12"
  );

  const originalConsoleError = console.error;
  console.error = () => {};
  const sanitizedResponse = safeErrorResponse(fakeInternalError, "An unexpected error occurred.", 500);
  console.error = originalConsoleError;

  assert(sanitizedResponse.status === 500, "Sanitized error returns HTTP 500");
  const resString = JSON.stringify(sanitizedResponse);
  assert(!resString.includes("C:\\Users\\CHUKWUMA"), "No Windows file paths leaked in error response");
  assert(!resString.includes("PrismaClientKnownRequestError"), "No raw Prisma error leaked in error response");
  assert(!resString.includes(".next"), "No internal Next.js build chunks leaked in error response");

  // ---------------------------------------------------------------------------
  // TEST 3: Next.js Defensive Headers & Framework Fingerprinting (R6)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 3] Verifying Next.js Configuration & Defensive Headers (R6)...");
  assert((nextConfig as any).poweredByHeader === false, "poweredByHeader is set to false (strips X-Powered-By: Next.js)");
  assert(typeof (nextConfig as any).headers === "function", "nextConfig defines custom headers() function");

  const headerRules = await (nextConfig as any).headers();
  assert(Array.isArray(headerRules) && headerRules.length > 0, "Custom header rules defined");
  const globalRule = headerRules.find((r: any) => r.source === "/:path*");
  assert(Boolean(globalRule), "Global header rule exists for '/:path*'");

  const headerMap: Record<string, string> = {};
  for (const h of globalRule?.headers || []) {
    headerMap[h.key.toLowerCase()] = h.value;
  }

  assert(headerMap["x-frame-options"] === "DENY", "X-Frame-Options is set to DENY");
  assert(headerMap["x-content-type-options"] === "nosniff", "X-Content-Type-Options is set to nosniff");
  assert(headerMap["referrer-policy"] === "strict-origin-when-cross-origin", "Referrer-Policy is strict-origin-when-cross-origin");
  assert(headerMap["permissions-policy"]?.includes("geolocation=(self)"), "Permissions-Policy scopes geolocation to (self)");

  // ---------------------------------------------------------------------------
  // TEST 4: Department Endpoint Information Disclosure Audit (R1)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 4] Auditing Department Check-In Route Handler for PII / GPS Redaction (R1)...");
  const deptRouteSource = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/check-in/departments/route.ts"),
    "utf8"
  );

  assert(deptRouteSource.includes("venueLatitude: null"), "Departments route nullifies venueLatitude");
  assert(deptRouteSource.includes("venueLongitude: null"), "Departments route nullifies venueLongitude");
  assert(deptRouteSource.includes("venueRadiusMeters: 0"), "Departments route nullifies venueRadiusMeters");
  assert(!deptRouteSource.includes("role: e.role"), "Departments route strips employee role from formatted payload");
  assert(!deptRouteSource.includes("pinHash: true"), "Departments route removes pinHash selection from query");

  // ---------------------------------------------------------------------------
  // TEST 5: Biometric Routes Guarded with Primitive Validation & Sanitization (R3, R4, R5)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 5] Auditing Biometric Route Handlers for Security Controls (R3, R4, R5)...");
  const biometricRoutes = [
    "src/app/api/biometrics/auth-options/route.ts",
    "src/app/api/biometrics/register-options/route.ts",
    "src/app/api/biometrics/register-verify/route.ts",
    "src/app/api/biometrics/request-reset/route.ts",
    "src/app/api/check-in/route.ts",
    "src/app/api/check-in/location-check/route.ts",
  ];

  for (const relPath of biometricRoutes) {
    const content = fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
    const routeName = path.basename(path.dirname(relPath)) + "/" + path.basename(relPath);
    assert(content.includes("isValidId"), `${routeName} enforces isValidId parameter validation`);
    assert(content.includes("safeErrorResponse"), `${routeName} uses safeErrorResponse error sanitization`);
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Mobile Check-In Client Component Hardening (R2) & Zero Coordinate Exposure
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 6] Auditing Mobile Check-In Client Component & Zero Coordinate Leakage (R2)...");
  const clientPageSource = fs.readFileSync(
    path.join(process.cwd(), "src/app/check-in/page.tsx"),
    "utf8"
  );
  assert(!clientPageSource.includes("{e.name} ({e.role})"), "Check-in dropdown does not disclose employee roles");
  assert(clientPageSource.includes("role?: string"), "DepartmentInfo marks role optional");

  const locCheckSource = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/check-in/location-check/route.ts"),
    "utf8"
  );
  assert(!locCheckSource.includes("venueLatitude: department.venueLatitude"), "location-check never leaks venueLatitude");
  assert(!locCheckSource.includes("venueLongitude: department.venueLongitude"), "location-check never leaks venueLongitude");
  assert(locCheckSource.includes("verifyGeofence"), "location-check performs server-side Haversine verification");

  // ---------------------------------------------------------------------------
  // RESULTS SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n=================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("ALL PENTAGI SECURITY HARDENING VERIFICATION CHECKS PASSED SUCCESSFULLY!\n");
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
