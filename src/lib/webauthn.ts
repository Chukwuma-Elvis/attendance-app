import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import { prisma } from "@/lib/db";

/**
 * Gets Relying Party (RP) configuration based on incoming request host.
 */
export function getRelyingPartyConfig(reqHost: string) {
  // Extract hostname without port (e.g., "localhost" from "localhost:3000")
  const hostname = reqHost.split(":")[0];
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const protocol = isLocalhost ? "http" : "https";
  const origin = `${protocol}://${reqHost}`;

  return {
    rpName: "Employee Attendance Portal",
    rpID: hostname,
    origin,
  };
}

/**
 * Creates and stores a registration challenge for an employee.
 */
export async function createRegistrationChallenge(
  employee: { id: string; name: string },
  reqHost: string
) {
  const { rpName, rpID } = getRelyingPartyConfig(reqHost);

  // Retrieve existing credentials for exclusion
  const existingCredentials = await prisma.biometricCredential.findMany({
    where: { employeeId: employee.id },
    select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(employee.id),
    userName: employee.name,
    userDisplayName: employee.name,
    attestationType: "none",
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.credentialId,
      transports: cred.transports as any,
    })),
    authenticatorSelection: {
      authenticatorAttachment: "platform", // Platform authenticators: Face ID, Touch ID, Android Biometrics
      userVerification: "required",
      residentKey: "preferred",
    },
  });

  // Store challenge with 5-minute expiration
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await prisma.biometricChallenge.create({
    data: {
      employeeId: employee.id,
      challenge: options.challenge,
      purpose: "REGISTRATION",
      expiresAt,
    },
  });

  return options;
}

/**
 * Verifies a passkey registration response and saves the credential.
 */
export async function verifyAndSaveRegistration(
  employeeId: string,
  response: any,
  reqHost: string,
  deviceName?: string
): Promise<VerifiedRegistrationResponse> {
  const { origin, rpID } = getRelyingPartyConfig(reqHost);

  const challengeRecord = await prisma.biometricChallenge.findFirst({
    where: {
      employeeId,
      purpose: "REGISTRATION",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!challengeRecord) {
    throw new Error("Biometric registration challenge has expired or was not found. Please try again.");
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challengeRecord.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });

  if (verification.verified && verification.registrationInfo) {
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    // Remove any previously paired device credentials (ensures 1 active device per employee)
    await prisma.biometricCredential.deleteMany({
      where: { employeeId },
    });

    await prisma.biometricCredential.create({
      data: {
        employeeId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports ?? [],
        deviceName: deviceName || "Smartphone Biometric",
      },
    });

    // Reset authorization flags back to locked
    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        biometricResetAllowed: false,
        biometricResetRequested: false,
      },
    });

    // Clean up consumed challenge
    await prisma.biometricChallenge.deleteMany({
      where: { employeeId, purpose: "REGISTRATION" },
    });
  }

  return verification;
}

/**
 * Creates an authentication challenge for employee biometric check-in.
 */
export async function createAuthenticationChallenge(
  employeeId: string,
  reqHost: string
) {
  const { rpID } = getRelyingPartyConfig(reqHost);

  const credentials = await prisma.biometricCredential.findMany({
    where: { employeeId },
  });

  if (credentials.length === 0) {
    throw new Error(
      "No biometric passkey registered on this device yet. Please register your biometric identification first."
    );
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: credentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports as any,
    })),
  });

  // Store challenge with 5-minute expiration
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await prisma.biometricChallenge.create({
    data: {
      employeeId,
      challenge: options.challenge,
      purpose: "AUTHENTICATION",
      expiresAt,
    },
  });

  return options;
}

/**
 * Verifies biometric authentication response during check-in / check-out.
 */
export async function verifyAuthentication(
  employeeId: string,
  response: any,
  reqHost: string
): Promise<VerifiedAuthenticationResponse> {
  const { origin, rpID } = getRelyingPartyConfig(reqHost);

  const challengeRecord = await prisma.biometricChallenge.findFirst({
    where: {
      employeeId,
      purpose: "AUTHENTICATION",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!challengeRecord) {
    throw new Error("Biometric authentication challenge has expired. Please try again.");
  }

  const credentialRecord = await prisma.biometricCredential.findUnique({
    where: { credentialId: response.id },
  });

  if (!credentialRecord || credentialRecord.employeeId !== employeeId) {
    throw new Error("Biometric credential does not match this employee.");
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challengeRecord.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: credentialRecord.credentialId,
      publicKey: new Uint8Array(credentialRecord.publicKey),
      counter: Number(credentialRecord.counter),
      transports: credentialRecord.transports as any,
    },
    requireUserVerification: true,
  });

  if (verification.verified) {
    // Update counter
    await prisma.biometricCredential.update({
      where: { id: credentialRecord.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
      },
    });

    // Delete used challenges
    await prisma.biometricChallenge.deleteMany({
      where: { employeeId, purpose: "AUTHENTICATION" },
    });
  }

  return verification;
}
