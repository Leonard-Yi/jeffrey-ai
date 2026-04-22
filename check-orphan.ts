import { prisma } from './src/lib/db';

async function main() {
  try {
    const orphanId = '0de864d0-758a-4ad3-94a5-7021982b1f97';

    // Check if this ID is referenced anywhere
    const asIntroducer = await prisma.person.findMany({
      where: { introducedById: orphanId }
    });
    console.log('People introduced BY this ID:', asIntroducer.length, asIntroducer.map(p => p.name));

    // Check interaction persons
    const inInteractionPerson = await prisma.interactionPerson.findMany({
      where: { personId: orphanId }
    });
    console.log('In InteractionPerson:', inInteractionPerson.length);

    // Get all person IDs
    const allPersons = await prisma.person.findMany({ select: { id: true } });
    const personIds = new Set(allPersons.map(p => p.id));
    console.log('Total persons in DB:', personIds.size);
    console.log('Orphan ID exists in DB:', personIds.has(orphanId));

    // Check for any person whose introducedById points to a non-existent person
    const allPersonsFull = await prisma.person.findMany({
      where: { deletedAt: null, mergedIntoId: null }
    });
    const badIntroductions = allPersonsFull.filter(
      p => p.introducedById && !personIds.has(p.introducedById)
    );
    console.log('People with invalid introducedById:', badIntroductions.length);
    if (badIntroductions.length > 0) {
      console.log('Examples:', badIntroductions.slice(0, 3).map(p => ({
        id: p.id, name: p.name, introducedById: p.introducedById
      })));
    }

    // Check if the specific node ID exists in ANY table
    const node = await prisma.person.findUnique({ where: { id: orphanId } });
    console.log('Node from error exists:', !!node);

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();