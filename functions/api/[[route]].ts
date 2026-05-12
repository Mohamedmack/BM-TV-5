import { handle } from "hono/cloudflare-pages";
import app from "../../_worker";

export const onRequest = handle(app);
