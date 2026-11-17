import fs from "fs";
import path from "path";
import os from "os";

// Default showcase content for this project
const DEFAULT_POST = `Most companies spend thousands on dedicated biometric fingerprint terminals to prevent buddy punching.

I replaced them with a standard mobile browser tab, WebAuthn, and GPS geofencing.

Here is why:
I was building an attendance & payroll deduction platform for hospitality and entertainment staff. The operational constraints were tough:
• Zero-app install friction (staff shouldn't have to download native apps from an app store).
• Shifts that cross midnight (clocking in at 10 PM and checking out at 3 AM the next day breaks typical calendar date schemas).
• Strict proof of physical presence without installing expensive wall scanners.

Here’s the architecture that made it work:

1. Browser-Native Biometrics (WebAuthn / FIDO2)
Instead of capturing raw fingerprint scans, the mobile browser requests Face ID / Touch ID / Android Biometrics. The device's hardware Secure Enclave signs a one-time cryptographic server challenge. The private key never leaves the employee’s phone.

2. Server-Side Haversine Geofencing
The client transmits HTML5 GPS coordinates with accuracy metadata. The backend calculates great-circle distance against the venue coordinates. Check-in is locked unless the device is physically within the configurable radius (default 100m).

3. The Cross-Midnight Shift Normalizer
Nightlife and event shifts don't follow calendar days. If someone clocks out at 2:30 AM on Tuesday, they are finishing Monday's shift. A sliding shift-window algorithm dynamically attributes early-morning checkouts back to the arrival shift date.

4. Multi-Tier RBAC & Audit Ledger
Assistant managers mark daily logs, but any cash-impacting penalty (lateness, absence, infractions) is routed into an Owner approval queue before deduction totals recalculate.

The modern web platform already gives us access to secure hardware enclaves and high-precision geolocation. You often don't need a native app or proprietary hardware to build high-trust physical workflows.

How do you currently handle physical presence or overnight shift logic in your systems?

#softwareengineering #webdev #nextjs #webauthn #systemdesign`;

const localProjectImage = path.resolve(process.cwd(), "showcase_architecture.jpg");
const artifactImage = path.resolve(
  "C:/Users/CHUKWUMA/.gemini/antigravity/brain/b1fae3b5-23d4-46ca-ae43-ef2ff6299a51/biometric_attendance_architecture_1794837359801.jpg"
);
const DEFAULT_IMAGE = fs.existsSync(localProjectImage) ? localProjectImage : artifactImage;

function loadEnvValue(key: string): string | null {
  if (process.env[key]) {
    return process.env[key]!.trim();
  }
  // 1. Current working directory .env
  const localEnv = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(localEnv)) {
    const lines = fs.readFileSync(localEnv, "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(new RegExp(`^\\s*${key}\\s*=\\s*["']?(.*?)["']?\\s*$`));
      if (match && match[1]) return match[1].trim();
    }
  }
  // 2. Global user profile ~/.linkedin.env
  const globalEnv = path.resolve(os.homedir(), ".linkedin.env");
  if (fs.existsSync(globalEnv)) {
    const lines = fs.readFileSync(globalEnv, "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(new RegExp(`^\\s*${key}\\s*=\\s*["']?(.*?)["']?\\s*$`));
      if (match && match[1]) return match[1].trim();
    }
  }
  return null;
}

function loadEnvToken(): string | null {
  return loadEnvValue("LINKEDIN_ACCESS_TOKEN");
}

function loadEnvAuthor(): string | null {
  return loadEnvValue("LINKEDIN_PERSON_URN");
}

function parseArgs() {
  const args = process.argv.slice(2);
  const isAttendanceApp = path.resolve(process.cwd()).toLowerCase().includes("attendance-app");
  let text = isAttendanceApp ? DEFAULT_POST : "";
  let imagePath: string | null = isAttendanceApp && fs.existsSync(DEFAULT_IMAGE) ? DEFAULT_IMAGE : null;
  let authorOverride: string | null = loadEnvAuthor();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--text" && args[i + 1]) {
      text = args[i + 1];
      i++;
    } else if (args[i] === "--author" && args[i + 1]) {
      authorOverride = args[i + 1];
      i++;
    } else if (args[i] === "--text-file" && args[i + 1]) {
      const p = path.resolve(args[i + 1]);
      if (fs.existsSync(p)) text = fs.readFileSync(p, "utf-8");
      i++;
    } else if (args[i] === "--image" && args[i + 1]) {
      imagePath = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === "--no-image") {
      imagePath = null;
    }
  }

  if (!text) {
    console.error("❌ Error: No post content provided.\n");
    console.log("Usage in other projects:");
    console.log('  linkedin-publish --text "Your post content..." --image ./screenshot.png\n');
    console.log("Or via a markdown / text file:");
    console.log('  linkedin-publish --text-file ./showcase.md --image ./diagram.png\n');
    process.exit(1);
  }

  return { text, imagePath, authorOverride };
}

async function main() {
  console.log("\n🚀 LinkedIn Direct API Publisher (100% Free / No SaaS Subscription)\n");

  const token = loadEnvToken();

  if (!token) {
    console.error("❌ Error: No LINKEDIN_ACCESS_TOKEN found in your environment or .env file.\n");
    console.log("Follow these 3 simple steps to get your free token (takes ~2 minutes):\n");
    console.log("1. Open LinkedIn Developer Portal:");
    console.log("   👉 https://www.linkedin.com/developers/apps/new\n");
    console.log("2. Create an App (e.g., 'My Dev Publisher'):");
    console.log("   - Enter any app name and associate your LinkedIn profile/page.");
    console.log("   - Under the 'Products' tab, click 'Request Access' on:");
    console.log("     • 'Share on LinkedIn'");
    console.log("     • 'Sign In with LinkedIn using OpenID Connect'\n");
    console.log("3. Generate your Access Token:");
    console.log("   - Click the 'Auth' tab -> 'OAuth 2.0 tools' -> 'Token generator'");
    console.log("   - Check scopes: 'w_member_social' and 'openid' (or 'profile')");
    console.log("   - Click 'Request Token' and copy the token string.\n");
    console.log("4. Add it to your .env file:");
    console.log('   LINKEDIN_ACCESS_TOKEN="your_token_here"\n');
    console.log("Then run: npm run linkedin:publish\n");
    process.exit(1);
  }

  const { text, imagePath, authorOverride } = parseArgs();

  let authorUrn = authorOverride;

  if (authorUrn && !authorUrn.startsWith("urn:li:")) {
    authorUrn = `urn:li:person:${authorUrn}`;
  }

  // 1. Fetch user info to get author URN if not manually provided
  if (!authorUrn) {
    console.log("👤 Fetching your LinkedIn Profile URN...");
    const userRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (userRes.ok) {
      const userData = (await userRes.json()) as { sub: string; name?: string };
      authorUrn = `urn:li:person:${userData.sub}`;
      console.log(`✅ Authenticated as: ${userData.name || userData.sub} (${authorUrn})\n`);
    } else {
      const errText = await userRes.text();
      console.error(`❌ Could not auto-detect profile ID via /v2/userinfo (${userRes.status}):`, errText);
      console.log("\n💡 You can provide your LinkedIn Member ID directly:");
      console.log("1. Open your LinkedIn Profile in a browser (e.g. linkedin.com/in/your-name).");
      console.log("2. Press Ctrl+U (View Source) and press Ctrl+F to search for: urn:li:person: or data-member-id");
      console.log("3. Copy your numeric ID (e.g. 123456789) and run:");
      console.log('   npm run linkedin:publish -- --author 123456789\n');
      console.log("Or add to .env: LINKEDIN_PERSON_URN=\"123456789\"\n");
      process.exit(1);
    }
  } else {
    console.log(`👤 Using author URN: ${authorUrn}\n`);
  }

  let imageUrn: string | null = null;

  // 2. Upload image if present
  if (imagePath && fs.existsSync(imagePath)) {
    console.log(`🖼️  Uploading image asset: ${path.basename(imagePath)}...`);

    // Step A: Initialize upload
    const initRes = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "LinkedIn-Version": "202611",
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: authorUrn,
        },
      }),
    });

    if (!initRes.ok) {
      const err = await initRes.text();
      console.warn(`⚠️ Image initialization failed (${initRes.status}):`, err);
      console.log("Proceeding with text-only post...");
    } else {
      const initData = (await initRes.json()) as {
        value: { uploadUrl: string; image: string };
      };
      const { uploadUrl, image } = initData.value;

      // Step B: PUT binary image stream
      const fileBytes = fs.readFileSync(imagePath);
      const isPng = imagePath.toLowerCase().endsWith(".png");
      const contentType = isPng ? "image/png" : "image/jpeg";

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": contentType,
        },
        body: fileBytes,
      });

      if (!putRes.ok) {
        console.warn(`⚠️ Image binary upload failed (${putRes.status}). Proceeding with text only.`);
      } else {
        imageUrn = image;
        console.log(`✅ Image binary sent: ${imageUrn}`);
        console.log("⏳ Waiting for LinkedIn to process image asset...");
        for (let attempt = 0; attempt < 5; attempt++) {
          await new Promise((r) => setTimeout(r, 2000));
          try {
            const checkRes = await fetch(
              `https://api.linkedin.com/rest/images/${encodeURIComponent(imageUrn)}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "LinkedIn-Version": "202611",
                  "X-Restli-Protocol-Version": "2.0.0",
                },
              }
            );
            if (checkRes.ok) {
              const checkData = (await checkRes.json()) as { status: string };
              if (checkData.status === "AVAILABLE") {
                console.log("✅ Image asset status: AVAILABLE\n");
                break;
              }
            }
          } catch {
            // continue polling
          }
        }
      }
    }
  }

  // 3. Create the post
  console.log("📝 Publishing post to your LinkedIn feed...");

  const postPayload: Record<string, any> = {
    author: authorUrn,
    commentary: text,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if (imageUrn) {
    postPayload.content = {
      media: {
        id: imageUrn,
        altText: "Browser-Native Biometric Attendance Architecture Diagram",
      },
    };
  }

  const postRes = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": "202611",
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(postPayload),
  });

  if (!postRes.ok) {
    const errText = await postRes.text();
    console.error(`❌ Post creation failed (${postRes.status}):`, errText);
    process.exit(1);
  }

  const postUrn = postRes.headers.get("x-restli-id") || "";
  const postUrl = postUrn
    ? `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}/`
    : "https://www.linkedin.com/feed/";

  console.log("\n🎉 POST PUBLISHED DIRECTLY TO LINKEDIN!");
  if (postUrn) console.log(`📌 Post ID:  ${postUrn}`);
  console.log(`🔗 View Post: ${postUrl}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
