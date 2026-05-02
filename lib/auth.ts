import { betterAuth } from "better-auth";
import { LibsqlDialect } from "@libsql/kysely-libsql";

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("TURSO_DATABASE_URL is not set");

export const auth = betterAuth({
  database: {
    dialect: new LibsqlDialect({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
    type: "sqlite",
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    disableSignUp: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
});
