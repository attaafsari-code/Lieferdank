import { api } from "@/server/api/handler";
import { getDriverRank } from "@/server/services/ranks";
export const dynamic = "force-dynamic";
export const GET = api({ auth: "driver" }, async ({ session }) => getDriverRank(session!.driver!.id));
