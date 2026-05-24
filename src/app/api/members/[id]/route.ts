import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getEncryptionKeys } from "@/lib/getKeys";
import { createCryptoStore } from "@/lib/cryptoStore";
import { buildPersonSearchText, generateEmbedding, type WeightedTag } from "@/lib/embedding";

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
  "careers",
  "interests",
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
  const keys = await getEncryptionKeys();
  if (!keys) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = createCryptoStore(prisma, keys.encKey);

  try {
    const { id } = await context.params;

    // Fetch person with only needed fields, excluding massive embedding arrays
    const person = await store.person.findUnique({
      where: { id, userId: keys.userId },
      select: {
        id: true,
        name: true,
        careers: true,
        interests: true,
        vibeTags: true,
        baseCities: true,
        favoritePlaces: true,
        relationshipScore: true,
        lastContactDate: true,
        createdAt: true,
        updatedAt: true,
        introducedById: true,
        introducedByIds: true,
        searchText: true,
        deletedAt: true,
        mergedIntoId: true,
        aliases: true,
        introducedBy: {
          select: { id: true, name: true },
        },
        introductions: {
          where: { deletedAt: null },
          select: { id: true, name: true },
        },
        interactions: {
          include: {
            interaction: {
              select: {
                id: true,
                date: true,
                location: true,
                contextType: true,
                sentiment: true,
                actionItems: true,
                coreMemories: true,
                createdAt: true,
                persons: {
                  select: {
                    personId: true,
                    interactionId: true,
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
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const keys = await getEncryptionKeys();
  if (!keys) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = createCryptoStore(prisma, keys.encKey);

  // Check if key rotation is in progress (blocks writes)
  const patchingUser = await store.raw.user.findUnique({
    where: { id: keys.userId },
    select: { keyRotationInProgress: true }
  });
  if (patchingUser?.keyRotationInProgress) {
    return Response.json(
      { error: "密钥更新中，请稍后再试" },
      { status: 423 }
    );
  }

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
      case "coreMemories":
      case "careers":
      case "interests": {
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
          const target = await store.person.findUnique({ where: { id: value as string, userId: keys.userId } });
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
            const target = await store.person.findUnique({ where: { id, userId: keys.userId } });
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
      case "careers":
      case "interests": {
        // 解析格式："投行(80%), 律师(60%)" → [{ name: "投行", weight: 0.8 }, ...]
        dbValue = (value as string)
          .split(",")
          .map(s => s.trim())
          .filter(s => s.length > 0)
          .map(s => {
            const match = s.match(/^(.+?)\((\d+)%?\)$/);
            if (match) {
              return { name: match[1].trim(), weight: parseFloat(match[2]) / 100 };
            }
            return { name: s, weight: 1.0 };
          });
        break;
      }
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

    await store.person.update({
      where: { id, userId: keys.userId },
      data: { [field]: dbValue },
    });

    // 若修改了影响 embedding 的字段，则重新生成向量
    if (field === "name" || field === "vibeTags" || field === "careers" || field === "interests") {
      const current = await store.person.findUnique({
        where: { id, userId: keys.userId },
        select: { name: true, careers: true, interests: true, vibeTags: true },
      });
      if (current) {
        const searchText = buildPersonSearchText({
          name: current.name,
          careers: (current.careers ?? []) as WeightedTag[],
          interests: (current.interests ?? []) as WeightedTag[],
          vibeTags: current.vibeTags ?? [],
        });
        try {
          const embedding = await generateEmbedding(searchText);
          await store.person.update({
            where: { id, userId: keys.userId },
            data: { searchText, embedding },
          });
        } catch (embErr) {
          console.error("[Jeffrey.AI] PATCH: failed to regenerate embedding:", embErr);
        }
      }
    }

    // 取最新完整数据返回（含新 embedding），避免返回旧向量
    const latest = await store.person.findUnique({
      where: { id, userId: keys.userId },
      select: {
        id: true, name: true, careers: true, interests: true, vibeTags: true,
        baseCities: true, favoritePlaces: true, relationshipScore: true,
        lastContactDate: true, searchText: true,
      },
    });

    return Response.json({ success: true, person: latest });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return Response.json({ error: "Person not found" }, { status: 404 });
    }
    console.error("Error in PATCH /api/members/[id]:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
