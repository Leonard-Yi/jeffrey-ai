import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const EDITABLE_FIELDS = [
  "name",
  "vibeTags",
  "baseCities",
  "favoritePlaces",
  "relationshipScore",
  "lastContactDate",
  "coreMemories",
  "introducedById",
  "introducedByIds",
] as const;

type EditableField = typeof EDITABLE_FIELDS[number];

function parseArrayField(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const person = await prisma.person.findUnique({
      where: { id },
      include: {
        introducedBy: {
          select: { id: true, name: true },
        },
        interactions: {
          include: {
            interaction: {
              include: {
                persons: {
                  include: {
                    person: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!person) {
      return Response.json({ error: "Person not found" }, { status: 404 });
    }

    return Response.json(person);
  } catch (error) {
    console.error("Error in GET /api/members/[id]:", error);
    return Response.json({ error: "Failed to fetch person" }, { status: 500 });
  } finally {
    await prisma?.$disconnect();
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { field, value } = body as { field: string; value: unknown };

    // Check if field is editable
    if (!EDITABLE_FIELDS.includes(field as EditableField)) {
      return Response.json(
        { error: `Field '${field}' is not editable` },
        { status: 403 }
      );
    }

    // Validate field-specific rules
    switch (field) {
      case "name": {
        if (typeof value !== "string" || value.trim().length === 0) {
          return Response.json(
            { error: "Name must be a non-empty string" },
            { status: 400 }
          );
        }
        break;
      }
      case "relationshipScore": {
        const score = Number(value);
        if (isNaN(score) || score < 0 || score > 100) {
          return Response.json(
            { error: "relationshipScore must be a number between 0 and 100" },
            { status: 400 }
          );
        }
        break;
      }
      case "vibeTags":
      case "baseCities":
      case "favoritePlaces":
      case "coreMemories": {
        if (typeof value !== "string") {
          return Response.json(
            { error: `${field} must be a comma-separated string` },
            { status: 400 }
          );
        }
        break;
      }
      case "lastContactDate": {
        const date = new Date(value as string);
        if (isNaN(date.getTime())) {
          return Response.json(
            { error: "lastContactDate must be a valid ISO date string" },
            { status: 400 }
          );
        }
        break;
      }
      case "introducedById": {
        if (value !== null && typeof value !== "string") {
          return Response.json({ error: "introducedById must be a string or null" }, { status: 400 });
        }
        if (value !== null) {
          const target = await prisma.person.findUnique({ where: { id: value as string } });
          if (!target) {
            return Response.json({ error: "Target person not found" }, { status: 400 });
          }
          if (value === id) {
            return Response.json({ error: "Cannot select yourself as introducer" }, { status: 400 });
          }
        }
        break;
      }
      case "introducedByIds": {
        if (value !== null && !Array.isArray(value)) {
          return Response.json({ error: "introducedByIds must be an array or null" }, { status: 400 });
        }
        if (value !== null) {
          for (const id of value as string[]) {
            const target = await prisma.person.findUnique({ where: { id } });
            if (!target) {
              return Response.json({ error: `Person with id '${id}' not found` }, { status: 400 });
            }
          }
        }
        break;
      }
    }

    // Build the update data
    let dbValue: unknown;
    switch (field) {
      case "vibeTags":
      case "baseCities":
      case "favoritePlaces":
      case "coreMemories":
        dbValue = parseArrayField(value as string);
        break;
      case "relationshipScore":
        dbValue = Number(value);
        break;
      case "lastContactDate":
        dbValue = new Date(value as string);
        break;
      case "introducedById":
        dbValue = value === null ? null : value;
        break;
      case "introducedByIds":
        dbValue = Array.isArray(value) ? value : [];
        break;
      default:
        dbValue = value;
    }

    const updated = await prisma.person.update({
      where: { id },
      data: { [field]: dbValue },
    });

    return Response.json({ success: true, person: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return Response.json({ error: "Person not found" }, { status: 404 });
    }
    console.error("Error in PATCH /api/members/[id]:", error);
    return Response.json({ error: "Failed to update person: " + String((error as Error).message) }, { status: 500 });
  } finally {
    await prisma?.$disconnect();
  }
}
