import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email =
          typeof params.email === "string"
            ? params.email.trim().toLowerCase()
            : "";
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error("Ingresa un correo electrónico válido");
        }
        const name = typeof params.name === "string" ? params.name.trim() : "";
        if (name.length > 80) {
          throw new Error("El nombre debe tener como máximo 80 caracteres");
        }
        return { email, ...(name ? { name } : {}) };
      },
    }),
  ],
});
