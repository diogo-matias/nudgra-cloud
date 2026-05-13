import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import { requireAllowedOperatorUserId } from "./lib/operatorAccess";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
  callbacks: {
    beforeSessionCreation: async (ctx, { userId }) => {
      await requireAllowedOperatorUserId(ctx, userId);
    },
  },
});
