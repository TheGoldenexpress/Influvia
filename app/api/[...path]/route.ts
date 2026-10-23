import { dispatch } from "../../../lib/service";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return dispatch(request, (await params).path.join("/"));
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return dispatch(request, (await params).path.join("/"));
}
