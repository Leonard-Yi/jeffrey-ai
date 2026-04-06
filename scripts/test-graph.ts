import "dotenv/config";
import { getGraphData } from "../src/lib/graphService";

async function main() {
  try {
    console.log("Testing graph service...");

    // Get all data
    const allData = await getGraphData();
    console.log(`Total nodes: ${allData.nodes.length}`);
    console.log(`Total links: ${allData.links.length}`);

    // Count link types
    const linkCounts: Record<string, number> = {};
    for (const link of allData.links) {
      linkCounts[link.type] = (linkCounts[link.type] || 0) + 1;
    }

    console.log("\nLink breakdown by type:");
    for (const [type, count] of Object.entries(linkCounts)) {
      console.log(`  ${type}: ${count} 条`);
    }

    // Print sample nodes
    console.log("\nSample nodes:");
    allData.nodes.slice(0, 3).forEach(node => {
      console.log(`- ${node.label} (${node.group}), score: ${node.val}, last contact: ${node.lastContact}`);
    });

    // Print sample links
    console.log("\nSample links:");
    allData.links.slice(0, 3).forEach(link => {
      console.log(`- ${link.source} -> ${link.target} (${link.type}, strength: ${link.strength})`);
    });

    // Test with link type filter
    console.log("\nTesting with linkType filter...");
    for (const linkType of ["sharedCareer", "sharedInterest", "introducedBy"]) {
      try {
        const filteredData = await getGraphData({ linkType: linkType as any });
        console.log(`${linkType}: ${filteredData.links.length} 条`);
      } catch (e) {
        console.log(`${linkType}: error - ${(e as Error).message}`);
      }
    }

    // Test with minStrength filter
    console.log("\nTesting with minStrength filter...");
    const strongLinks = await getGraphData({ minStrength: 0.5 });
    console.log(`Links with strength >= 0.5: ${strongLinks.links.length}`);

    // Test with group filter (if we have any nodes)
    if (allData.nodes.length > 0) {
      console.log("\nTesting with group filter...");
      const filteredData = await getGraphData({ group: allData.nodes[0].group });
      console.log(`Group-filtered nodes: ${filteredData.nodes.length}`);
      console.log(`Group-filtered links: ${filteredData.links.length}`);
    }

    console.log("\n✅ Graph service test completed successfully");
  } catch (error) {
    console.error("❌ Error in graph test:", error);
    process.exit(1);
  }
}

main();
