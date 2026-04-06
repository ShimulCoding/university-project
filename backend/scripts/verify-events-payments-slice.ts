type CheckResult = {
  label: string;
  ok: boolean;
  details: string;
};

function ensureEnvDefaults() {
  process.env.NODE_ENV ??= "development";
  process.env.PORT ??= "4000";
  process.env.FRONTEND_URL ??= "http://localhost:3000";
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/mu_cse_transparency";
  process.env.JWT_ACCESS_SECRET ??= "replace-with-long-random-access-secret";
  process.env.JWT_REFRESH_SECRET ??= "replace-with-long-random-refresh-secret";
  process.env.ACCESS_TOKEN_TTL ??= "15m";
  process.env.REFRESH_TOKEN_TTL ??= "7d";
  process.env.ACCESS_TOKEN_COOKIE_NAME ??= "mu_access_token";
  process.env.REFRESH_TOKEN_COOKIE_NAME ??= "mu_refresh_token";
  process.env.BCRYPT_SALT_ROUNDS ??= "12";
  process.env.UPLOADS_ROOT ??= "uploads";
}

async function checkRoute(
  baseUrl: string,
  input: {
    label: string;
    path: string;
    method?: string;
    expectedStatus: number;
  },
): Promise<CheckResult> {
  const response = await fetch(`${baseUrl}${input.path}`, {
    method: input.method ?? "GET",
  });

  const ok = response.status === input.expectedStatus;

  return {
    label: input.label,
    ok,
    details: `${input.method ?? "GET"} ${input.path} -> ${response.status}`,
  };
}

async function main() {
  ensureEnvDefaults();

  const { createApp } = await import("../src/app");
  const app = createApp();
  const server = app.listen(0);

  await new Promise<void>((resolve) => {
    server.once("listening", () => resolve());
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to bind the verification server to a local port.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const results = await Promise.all([
      checkRoute(baseUrl, {
        label: "Health endpoint",
        path: "/health",
        expectedStatus: 200,
      }),
      checkRoute(baseUrl, {
        label: "Public events rejects non-public status filter",
        path: "/api/events?status=DRAFT",
        expectedStatus: 400,
      }),
      checkRoute(baseUrl, {
        label: "Manage events route requires authentication",
        path: "/api/events/manage/list",
        expectedStatus: 401,
      }),
      checkRoute(baseUrl, {
        label: "My registrations route requires authentication",
        path: "/api/registrations/me",
        expectedStatus: 401,
      }),
      checkRoute(baseUrl, {
        label: "Verification queue route requires authentication",
        path: "/api/payments/verification-queue",
        expectedStatus: 401,
      }),
      checkRoute(baseUrl, {
        label: "Income record route requires authentication",
        path: "/api/payments/income-records",
        expectedStatus: 401,
      }),
    ]);

    for (const result of results) {
      const prefix = result.ok ? "[ok]" : "[fail]";
      console.log(`${prefix} ${result.label}: ${result.details}`);
    }

    const failedChecks = results.filter((result) => !result.ok);

    if (failedChecks.length > 0) {
      throw new Error("Route verification failed for one or more checks.");
    }

    console.log("Events, registrations, payments, and income route smoke verification passed.");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

void main().catch((error) => {
  console.error("Backend slice verification failed.", error);
  process.exit(1);
});
