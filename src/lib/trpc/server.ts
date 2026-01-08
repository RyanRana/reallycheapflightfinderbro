import { initTRPC, TRPCError } from "@trpc/server";

type Context = {
  userId?: string | null;
};

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }
  return opts.next({
    ctx: {
      userId: ctx.userId,
    },
  });
});

