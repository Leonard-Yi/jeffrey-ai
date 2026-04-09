/**
 * Data Isolation Test
 * Verifies that users can only see their own data
 */
import "dotenv/config";
import { prisma } from "@/lib/db";

const TEST_PREFIX = "__test_iso_";

async function cleanup() {
  await prisma.personTag.deleteMany({
    where: { person: { name: { startsWith: TEST_PREFIX } } },
  });
  await prisma.interactionPerson.deleteMany({
    where: { person: { name: { startsWith: TEST_PREFIX } } },
  });
  await prisma.interaction.deleteMany({
    where: { contextType: { startsWith: TEST_PREFIX } },
  });
  await prisma.person.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  });
}

async function main() {
  console.log("=== Data Isolation Test ===\n");

  // Get or create two test users
  const users = await prisma.user.findMany({
    where: { email: { in: [`${TEST_PREFIX}a@test.com`, `${TEST_PREFIX}b@test.com`] } },
  });

  let userA = users.find(u => u.email === `${TEST_PREFIX}a@test.com`);
  let userB = users.find(u => u.email === `${TEST_PREFIX}b@test.com`);

  if (!userA) {
    userA = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}a@test.com`,
        name: "Test User A",
        emailVerified: new Date(),
        passwordHash: "test_hash_a",
      },
    });
    console.log("Created test user A:", userA.id);
  }

  if (!userB) {
    userB = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}b@test.com`,
        name: "Test User B",
        emailVerified: new Date(),
        passwordHash: "test_hash_b",
      },
    });
    console.log("Created test user B:", userB.id);
  }

  console.log(`\nUser A: ${userA.id}`);
  console.log(`User B: ${userB.id}`);

  // Cleanup old test data
  await cleanup();

  // Create test data as User A
  const personA = await prisma.person.create({
    data: {
      name: `${TEST_PREFIX}Alice`,
      userId: userA.id,
      careers: [{ name: "Engineer", weight: 0.9 }],
      lastContactDate: new Date(),
    },
  });

  const personB = await prisma.person.create({
    data: {
      name: `${TEST_PREFIX}Bob`,
      userId: userB.id,
      careers: [{ name: "Designer", weight: 0.8 }],
      lastContactDate: new Date(),
    },
  });

  console.log(`\nCreated Person A (belongs to user A): ${personA.id}`);
  console.log(`Created Person B (belongs to user B): ${personB.id}`);

  // Test 1: Query as User A - should only see Person A
  const personsAsA = await prisma.person.findMany({
    where: { userId: userA.id, deletedAt: null, mergedIntoId: null },
  });

  console.log(`\n--- Test 1: Query as User A ---`);
  console.log(`Expected: 1 person (Alice)`);
  console.log(`Actual: ${personsAsA.length} person(s)`);
  console.log(`Names: ${personsAsA.map(p => p.name).join(", ")}`);

  const test1Pass = personsAsA.length === 1 && personsAsA[0].name === `${TEST_PREFIX}Alice`;
  console.log(`Result: ${test1Pass ? "✅ PASS" : "❌ FAIL"}`);

  // Test 2: Query as User B - should only see Person B
  const personsAsB = await prisma.person.findMany({
    where: { userId: userB.id, deletedAt: null, mergedIntoId: null },
  });

  console.log(`\n--- Test 2: Query as User B ---`);
  console.log(`Expected: 1 person (Bob)`);
  console.log(`Actual: ${personsAsB.length} person(s)`);
  console.log(`Names: ${personsAsB.map(p => p.name).join(", ")}`);

  const test2Pass = personsAsB.length === 1 && personsAsB[0].name === `${TEST_PREFIX}Bob`;
  console.log(`Result: ${test2Pass ? "✅ PASS" : "❌ FAIL"}`);

  // Test 3: Graph service - User A should not see User B's data
  const { getGraphData } = await import("@/lib/graphService");

  const graphAsA = await getGraphData({}, userA.id);
  const graphAsB = await getGraphData({}, userB.id);

  console.log(`\n--- Test 3: Graph Service Isolation ---`);
  console.log(`User A graph nodes: ${graphAsA.nodes.length} (expected: 1)`);
  console.log(`User B graph nodes: ${graphAsB.nodes.length} (expected: 1)`);

  const test3Pass = graphAsA.nodes.length === 1 && graphAsB.nodes.length === 1;
  console.log(`Result: ${test3Pass ? "✅ PASS" : "❌ FAIL"}`);

  // Cleanup
  await cleanup();
  console.log("\n--- Cleanup complete ---");

  // Final result
  const allPass = test1Pass && test2Pass && test3Pass;
  console.log(`\n=== Overall: ${allPass ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"} ===`);

  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
