import { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma.js";

const SALT_ROUNDS = 12;
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "15m";
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || "7d";
const REFRESH_COOKIE = "refresh_token";
const IS_PROD = process.env.NODE_ENV === "production";

function getGoogleClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not configured");
  return new OAuth2Client(clientId, clientSecret);
}

function sanitizeUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login — email + password login
  app.post<{
    Body: { email: string; password: string };
  }>("/login", async (req, reply) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return reply.badRequest("email and password are required");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }
    if (!user.passwordHash) {
      return reply
        .code(401)
        .send({ error: "This account uses Google sign-in only" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    const accessToken = app.jwt.sign(
      { ...payload, type: "access" as const },
      { expiresIn: ACCESS_EXPIRY },
    );
    const refreshToken = app.jwt.sign(
      { ...payload, type: "refresh" as const },
      { expiresIn: REFRESH_EXPIRY },
    );

    reply.setCookie(REFRESH_COOKIE, refreshToken, {
      path: "/api/auth",
      httpOnly: true,
      secure: IS_PROD,
      sameSite: IS_PROD ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.send({ accessToken, user: sanitizeUser(user) });
  });

  // POST /api/auth/google — Google OAuth login (ID token or authorization code)
  app.post<{
    Body: { credential?: string; code?: string };
  }>("/google", async (req, reply) => {
    const { credential, code } = req.body;
    if (!credential && !code) {
      return reply.badRequest("credential or code is required");
    }

    let googleEmail: string;
    let googleName: string;
    let googleSub: string;

    try {
      const client = getGoogleClient();

      if (credential) {
        // Google One Tap / Sign In With Google (ID token)
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          return reply.code(401).send({ error: "Invalid Google token" });
        }
        googleEmail = payload.email;
        googleName = payload.name || payload.email;
        googleSub = payload.sub;
      } else {
        // Authorization code flow
        const redirectUri =
          process.env.GOOGLE_REDIRECT_URI ||
          "http://localhost:5173/auth/google/callback";
        const { tokens } = await client.getToken({
          code: code!,
          redirect_uri: redirectUri,
        });
        if (!tokens.id_token) {
          return reply.code(401).send({ error: "Failed to get Google token" });
        }
        const ticket = await client.verifyIdToken({
          idToken: tokens.id_token,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          return reply.code(401).send({ error: "Invalid Google token" });
        }
        googleEmail = payload.email;
        googleName = payload.name || payload.email;
        googleSub = payload.sub;
      }
    } catch (err) {
      app.log.error(err, "Google auth verification failed");
      return reply.code(401).send({ error: "Google authentication failed" });
    }

    // Find existing user by googleId or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId: googleSub }, { email: googleEmail }],
      },
    });

    if (!user) {
      // No matching user — account must be created by admin
      return reply.code(403).send({
        error:
          "No account found for this Google email. Contact your administrator.",
      });
    }

    if (!user.isActive) {
      return reply.code(403).send({ error: "Account is deactivated" });
    }

    // Link Google ID if not already linked
    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: googleSub },
      });
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    const accessToken = app.jwt.sign(
      { ...payload, type: "access" as const },
      { expiresIn: ACCESS_EXPIRY },
    );
    const refreshToken = app.jwt.sign(
      { ...payload, type: "refresh" as const },
      { expiresIn: REFRESH_EXPIRY },
    );

    reply.setCookie(REFRESH_COOKIE, refreshToken, {
      path: "/api/auth",
      httpOnly: true,
      secure: IS_PROD,
      sameSite: IS_PROD ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.send({ accessToken, user: sanitizeUser(user) });
  });

  // POST /api/auth/refresh — renew access token using refresh cookie
  app.post("/refresh", async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (!token) {
      return reply.code(401).send({ error: "No refresh token" });
    }

    let decoded;
    try {
      decoded = app.jwt.verify<{
        sub: string;
        email: string;
        role: string;
        tenantId: string;
        type: string;
      }>(token);
    } catch {
      reply.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
      return reply.code(401).send({ error: "Invalid refresh token" });
    }

    if (decoded.type !== "refresh") {
      return reply.code(401).send({ error: "Invalid token type" });
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
    });
    if (!user || !user.isActive) {
      reply.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
      return reply.code(401).send({ error: "Account not found or inactive" });
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    const accessToken = app.jwt.sign(
      { ...payload, type: "access" as const },
      { expiresIn: ACCESS_EXPIRY },
    );

    // Rotate refresh token
    const newRefreshToken = app.jwt.sign(
      { ...payload, type: "refresh" as const },
      { expiresIn: REFRESH_EXPIRY },
    );

    reply.setCookie(REFRESH_COOKIE, newRefreshToken, {
      path: "/api/auth",
      httpOnly: true,
      secure: IS_PROD,
      sameSite: IS_PROD ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.send({ accessToken, user: sanitizeUser(user) });
  });

  // POST /api/auth/logout — clear refresh cookie
  app.post("/logout", async (_req, reply) => {
    reply.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    return reply.code(204).send();
  });

  // GET /api/auth/me — return the current user (requires valid access token)
  app.get("/me", async (req, reply) => {
    try {
      const decoded = (await req.jwtVerify()) as {
        sub: string;
        type: string;
      };
      if (decoded.type !== "access") {
        return reply.code(401).send({ error: "Invalid token type" });
      }
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
      });
      if (!user || !user.isActive) {
        return reply.code(401).send({ error: "User not found" });
      }
      return reply.send({ user: sanitizeUser(user) });
    } catch {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });
}
