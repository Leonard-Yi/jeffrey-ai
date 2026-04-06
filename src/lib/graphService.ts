import "dotenv/config";
import { prisma } from "@/lib/db";

export interface GraphNode {
  id: string;
  label: string;
  val: number; // relationshipScore normalized to 0-1 range
  group: string; // primary career tag
  city: string;
  lastContact: string;
}

export interface GraphLink {
  source: string;
  target: string;
  type: "interaction" | "introducedBy" | "sharedCareer" | "sharedCity" | "sharedInterest" | "sharedPlace" | "sharedVibe";
  strength: number;
}

export interface GraphCluster {
  id: string;
  name: string;
  category: "city" | "career" | "interest" | "place" | "vibe";
  memberIds: string[];
  color: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  clusters: GraphCluster[];
}

export interface GraphFilter {
  group?: string; // filters by person name containing the group string
  city?: string;  // filters by person name containing the city string (placeholder)
  linkType?: "interaction" | "introducedBy" | "sharedCareer" | "sharedCity" | "sharedInterest" | "sharedPlace" | "sharedVibe";  // filter by link type
  minStrength?: number;  // minimum strength threshold
}

// Helper to ensure source < target for undirected edges
function canonicalKey(a: string, b: string): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

// Helper to determine the canonical source (lexicographically smaller ID)
function canonicalSource(a: string, b: string): string {
  return a < b ? a : b;
}

/**
 * Fetches all persons and their interactions from the database,
 * transforms them into a graph format suitable for react-force-graph.
 */
export async function getGraphData(filter?: GraphFilter): Promise<GraphData> {
  // First get all persons
  const allPersons = await prisma.person.findMany();

  // Then get all interactions with their participants
  const allInteractions = await prisma.interaction.findMany({
    include: {
      persons: {
        include: {
          person: true
        }
      }
    }
  });

  // Build nodes with initial filtering
  let nodes: GraphNode[] = allPersons.map((person) => {
    const careersArray = person.careers as { name: string; weight: number }[];
    const firstCareer = careersArray.length > 0 ? careersArray[0].name : "unknown";

    const baseCitiesArray = person.baseCities as string[];
    const firstCity = baseCitiesArray && baseCitiesArray.length > 0 ? baseCitiesArray[0] : "";

    return {
      id: person.id,
      label: person.name,
      val: person.relationshipScore / 100, // normalize to 0-1 for node size
      group: firstCareer,
      city: firstCity, // use first base city if available
      lastContact: person.lastContactDate.toISOString(),
    };
  });

  // Apply node filters
  if (filter?.group) {
    nodes = nodes.filter(node => node.group.includes(filter.group!));
  }
  if (filter?.city) {
    // For demo purposes, treating city filter as name filter
    // Could be extended to an actual city field in the future
    nodes = nodes.filter(node => node.city.includes(filter.city!) || node.label.includes(filter.city!));
  }

  const nodeIds = new Set(nodes.map((n) => n.id));

  // Build links (only interaction and introducedBy)
  const links: GraphLink[] = [];

  // Process links between people in filtered nodes
  for (let i = 0; i < allPersons.length; i++) {
    const personA = allPersons[i];

    // Only process if personA is in filtered nodes
    if (!nodeIds.has(personA.id)) continue;

    for (let j = i + 1; j < allPersons.length; j++) {
      const personB = allPersons[j];

      // Only process if personB is in filtered nodes
      if (!nodeIds.has(personB.id)) continue;

      const source = canonicalSource(personA.id, personB.id);
      const target = source === personA.id ? personB.id : personA.id;

      // Calculate all potential link types between these two people

      // introducedBy links
      if (personA.introducedById === personB.id || personB.introducedById === personA.id) {
        links.push({
          source,
          target,
          type: "introducedBy",
          strength: 0.8,
        });
      }

      // sharedCareer links
      const careersA = personA.careers as { name: string; weight: number }[] || [];
      const careersB = personB.careers as { name: string; weight: number }[] || [];
      const careerNamesA = new Set(careersA.map(c => c.name));
      const sharedCareers = careersB.filter(c => careerNamesA.has(c.name));
      if (sharedCareers.length > 0) {
        const avgWeights = sharedCareers.map(c => {
          const weightA = careersA.find(ca => ca.name === c.name)?.weight || 0;
          return (weightA + c.weight) / 2;
        }).reduce((sum, w) => sum + w, 0) / sharedCareers.length;

        links.push({
          source,
          target,
          type: "sharedCareer",
          strength: 0.6 * avgWeights,
        });
      }

      // sharedCity links
      const citiesA = personA.baseCities as string[] || [];
      const citiesB = personB.baseCities as string[] || [];
      const sharedCities = citiesA.filter(city => citiesB.includes(city));
      if (sharedCities.length > 0) {
        links.push({
          source,
          target,
          type: "sharedCity",
          strength: 0.4,
        });
      }

      // sharedInterest links
      const interestsA = personA.interests as { name: string; weight: number }[] || [];
      const interestsB = personB.interests as { name: string; weight: number }[] || [];
      const interestNamesA = new Set(interestsA.map(i => i.name));
      const sharedInterests = interestsB.filter(i => interestNamesA.has(i.name));
      if (sharedInterests.length > 0) {
        links.push({
          source,
          target,
          type: "sharedInterest",
          strength: 0.3 * sharedInterests.length,
        });
      }

      // sharedPlace links
      const placesA = personA.favoritePlaces as string[] || [];
      const placesB = personB.favoritePlaces as string[] || [];
      const sharedPlaces = placesA.filter(place => placesB.includes(place));
      if (sharedPlaces.length > 0) {
        links.push({
          source,
          target,
          type: "sharedPlace",
          strength: 0.2,
        });
      }

      // sharedVibe links
      const vibesA = personA.vibeTags as string[] || [];
      const vibesB = personB.vibeTags as string[] || [];
      const sharedVibes = vibesA.filter(vibe => vibesB.includes(vibe));
      if (sharedVibes.length > 0) {
        links.push({
          source,
          target,
          type: "sharedVibe",
          strength: 0.2 * sharedVibes.length,
        });
      }
    }
  }

  // Build clusters for non-arrow relationships
  const clusters: GraphCluster[] = [];
  const clusterColorMap: Record<string, string> = {
    city: '#3b82f6',      // blue
    career: '#10b981',    // green
    interest: '#f59e0b',  // amber
    place: '#ec4899',     // pink
    vibe: '#8b5cf6',      // purple
  };

  // City clusters
  const cityMap = new Map<string, string[]>();
  for (const person of allPersons) {
    if (!nodeIds.has(person.id)) continue;
    const cities = person.baseCities as string[] || [];
    for (const city of cities) {
      if (!cityMap.has(city)) cityMap.set(city, []);
      cityMap.get(city)!.push(person.id);
    }
  }
  for (const [city, memberIds] of cityMap.entries()) {
    if (memberIds.length >= 1) {
      clusters.push({
        id: `city-${city}`,
        name: city,
        category: 'city',
        memberIds,
        color: clusterColorMap.city,
      });
    }
  }

  // Career clusters
  const careerMap = new Map<string, string[]>();
  for (const person of allPersons) {
    if (!nodeIds.has(person.id)) continue;
    const careers = person.careers as { name: string; weight: number }[] || [];
    for (const career of careers) {
      if (!careerMap.has(career.name)) careerMap.set(career.name, []);
      careerMap.get(career.name)!.push(person.id);
    }
  }
  for (const [career, memberIds] of careerMap.entries()) {
    if (memberIds.length >= 1) {
      clusters.push({
        id: `career-${career}`,
        name: career,
        category: 'career',
        memberIds,
        color: clusterColorMap.career,
      });
    }
  }

  // Interest clusters
  const interestMap = new Map<string, string[]>();
  for (const person of allPersons) {
    if (!nodeIds.has(person.id)) continue;
    const interests = person.interests as { name: string; weight: number }[] || [];
    for (const interest of interests) {
      if (!interestMap.has(interest.name)) interestMap.set(interest.name, []);
      interestMap.get(interest.name)!.push(person.id);
    }
  }
  for (const [interest, memberIds] of interestMap.entries()) {
    if (memberIds.length >= 1) {
      clusters.push({
        id: `interest-${interest}`,
        name: interest,
        category: 'interest',
        memberIds,
        color: clusterColorMap.interest,
      });
    }
  }

  // Place clusters
  const placeMap = new Map<string, string[]>();
  for (const person of allPersons) {
    if (!nodeIds.has(person.id)) continue;
    const places = person.favoritePlaces as string[] || [];
    for (const place of places) {
      if (!placeMap.has(place)) placeMap.set(place, []);
      placeMap.get(place)!.push(person.id);
    }
  }
  for (const [place, memberIds] of placeMap.entries()) {
    if (memberIds.length >= 1) {
      clusters.push({
        id: `place-${place}`,
        name: place,
        category: 'place',
        memberIds,
        color: clusterColorMap.place,
      });
    }
  }

  // Vibe clusters
  const vibeMap = new Map<string, string[]>();
  for (const person of allPersons) {
    if (!nodeIds.has(person.id)) continue;
    const vibes = person.vibeTags as string[] || [];
    for (const vibe of vibes) {
      if (!vibeMap.has(vibe)) vibeMap.set(vibe, []);
      vibeMap.get(vibe)!.push(person.id);
    }
  }
  for (const [vibe, memberIds] of vibeMap.entries()) {
    if (memberIds.length >= 1) {
      clusters.push({
        id: `vibe-${vibe}`,
        name: vibe,
        category: 'vibe',
        memberIds,
        color: clusterColorMap.vibe,
      });
    }
  }

  // Process interaction links from all interactions
  for (const interaction of allInteractions) {
    // Get only participants that are in the filtered nodes
    const participants = interaction.persons
      .map(ip => ip.person) // Get the actual Person from the join table
      .filter(p => nodeIds.has(p.id));

    if (participants.length < 2) continue;

    // Generate all pairs of participants for interaction links
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const personA = participants[i];
        const personB = participants[j];
        const source = canonicalSource(personA.id, personB.id);
        const target = source === personA.id ? personB.id : personA.id;

        // Check if this interaction link already exists
        const existingIndex = links.findIndex(
          link => link.source === source && link.target === target && link.type === "interaction"
        );

        if (existingIndex >= 0) {
          // Increment strength if link already exists
          links[existingIndex].strength += 0.5;
        } else {
          // Create new interaction link
          links.push({
            source,
            target,
            type: "interaction",
            strength: 0.5,
          });
        }
      }
    }
  }

  // Apply link filters
  let filteredLinks = links;

  if (filter?.linkType) {
    filteredLinks = filteredLinks.filter(link => link.type === filter.linkType);
  }

  if (filter?.minStrength !== undefined) {
    filteredLinks = filteredLinks.filter(link => link.strength >= filter.minStrength!);
  }

  return {
    nodes,
    links: filteredLinks,
    clusters,
  };
}