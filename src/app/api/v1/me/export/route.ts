import { api } from "@/server/api/handler";
import { mobileExport } from "@/server/services/mobile";
export const GET = api({ auth: "driver" }, async ({ session }) => mobileExport(session!.user));
