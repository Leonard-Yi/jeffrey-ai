import { NextRequest } from "next/server";
import { getGraphData, GraphData } from "@/lib/graphService";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const group = searchParams.get("group") || undefined;
    const city = searchParams.get("city") || undefined;
    const linkTypeParam = searchParams.get("linkType") || undefined;
    const minStrengthStr = searchParams.get("minStrength");

    // Validate linkType if provided
    let linkType: "interaction" | "introducedBy" | "sharedCareer" | "sharedCity" | "sharedInterest" | "sharedPlace" | "sharedVibe" | undefined;
    if (linkTypeParam) {
      const validTypes = ["interaction", "introducedBy", "sharedCareer", "sharedCity", "sharedInterest", "sharedPlace", "sharedVibe"];
      if (validTypes.includes(linkTypeParam)) {
        linkType = linkTypeParam as any;
      } else {
        return Response.json(
          { error: `Invalid linkType. Valid values: ${validTypes.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // Parse minStrength if provided
    let minStrength: number | undefined;
    if (minStrengthStr) {
      const parsed = parseFloat(minStrengthStr);
      if (isNaN(parsed)) {
        return Response.json(
          { error: "minStrength must be a valid number" },
          { status: 400 }
        );
      }
      minStrength = parsed;
    }

    const filter = {
      group,
      city,
      linkType,
      minStrength
    };

    const graphData: GraphData = await getGraphData(filter);

    return Response.json(graphData);
  } catch (error) {
    console.error("Error in graph API:", error);
    return Response.json(
      { error: "Failed to fetch graph data" },
      { status: 500 }
    );
  }
}
