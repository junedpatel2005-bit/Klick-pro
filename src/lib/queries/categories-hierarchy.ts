import "server-only";
import { db } from "@/lib/db";

export type HierarchyParent = {
  id: number;
  name: string;
  slug: string;
  description: string;
  iconName: string;
  segment: "RESIDENTIAL" | "COMMERCIAL" | "INDUSTRIAL" | string;
  categoryCount: number;
  subcategoryCount: number;
  previewCategories: Array<{
    id: number;
    name: string;
    slug: string;
    subcategoryCount: number;
  }>;
};

export type HierarchyCategory = {
  id: number;
  name: string;
  slug: string;
  description: string;
  iconName: string;
  segment: string;
  parentId: number;
  parentName: string;
  parentSlug: string;
  subcategoryCount: number;
  previewSubcategories: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
};

export type HierarchySubcategory = {
  id: number;
  name: string;
  slug: string;
  description: string;
  iconName: string;
  segment: string;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  parentId: number;
  parentName: string;
  parentSlug: string;
};

export type CompleteCategoryHierarchy = {
  parents: HierarchyParent[];
  categories: HierarchyCategory[];
  subcategories: HierarchySubcategory[];
  totalCounts: {
    parents: number;
    categories: number;
    subcategories: number;
  };
};

export async function getCompleteCategoryHierarchy(): Promise<CompleteCategoryHierarchy> {
  const all = await db.serviceCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      iconName: true,
      segment: true,
      parentId: true,
    },
  });

  const byId = new Map(all.map((c) => [c.id, c]));

  // 1. Tier 1: Parents (parentId === null)
  const rawParents = all.filter((c) => c.parentId === null);
  const parentIds = new Set(rawParents.map((p) => p.id));

  // 2. Tier 2: Main Categories (parentId is one of parentIds)
  const rawCategories = all.filter((c) => c.parentId !== null && parentIds.has(c.parentId));
  const categoryIds = new Set(rawCategories.map((c) => c.id));

  // 3. Tier 3: Subcategories (parentId is one of categoryIds)
  const rawSubcategories = all.filter((c) => c.parentId !== null && categoryIds.has(c.parentId));

  // Subcategories grouped by category id
  const subsByCategoryId = new Map<number, typeof rawSubcategories>();
  for (const sub of rawSubcategories) {
    const list = subsByCategoryId.get(sub.parentId!) ?? [];
    list.push(sub);
    subsByCategoryId.set(sub.parentId!, list);
  }

  // Categories grouped by parent id
  const catsByParentId = new Map<number, typeof rawCategories>();
  for (const cat of rawCategories) {
    const list = catsByParentId.get(cat.parentId!) ?? [];
    list.push(cat);
    catsByParentId.set(cat.parentId!, list);
  }

  // Build Tier 1 objects
  const parents: HierarchyParent[] = rawParents.map((parent) => {
    const childrenCats = catsByParentId.get(parent.id) ?? [];
    const totalSubs = childrenCats.reduce((acc, cat) => {
      const catSubs = subsByCategoryId.get(cat.id) ?? [];
      return acc + catSubs.length;
    }, 0);

    return {
      id: parent.id,
      name: parent.name,
      slug: parent.slug,
      description:
        parent.description ||
        `Comprehensive ${parent.name.toLowerCase()} catalog covering all specialized services and certified professionals.`,
      iconName: parent.iconName || "Layers",
      segment: parent.segment || "RESIDENTIAL",
      categoryCount: childrenCats.length,
      subcategoryCount: totalSubs,
      previewCategories: childrenCats.slice(0, 6).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        subcategoryCount: (subsByCategoryId.get(c.id) ?? []).length,
      })),
    };
  });

  // Build Tier 2 objects
  const categories: HierarchyCategory[] = rawCategories.map((cat) => {
    const parent = byId.get(cat.parentId!);
    const childrenSubs = subsByCategoryId.get(cat.id) ?? [];

    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description:
        cat.description ||
        `Verified ${cat.name.toLowerCase()} solutions delivered by experienced, background-checked specialists.`,
      iconName: cat.iconName || "FolderTree",
      segment: cat.segment || parent?.segment || "RESIDENTIAL",
      parentId: parent?.id ?? 0,
      parentName: parent?.name ?? "General",
      parentSlug: parent?.slug ?? "general",
      subcategoryCount: childrenSubs.length,
      previewSubcategories: childrenSubs.slice(0, 5).map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
      })),
    };
  });

  // Build Tier 3 objects
  const subcategories: HierarchySubcategory[] = rawSubcategories.map((sub) => {
    const category = byId.get(sub.parentId!);
    const parent = category?.parentId ? byId.get(category.parentId) : null;

    return {
      id: sub.id,
      name: sub.name,
      slug: sub.slug,
      description:
        sub.description ||
        `Specialized ${sub.name.toLowerCase()} service with upfront pricing, verified milestone tracking, and quality guarantee.`,
      iconName: sub.iconName || "Sparkles",
      segment: sub.segment || category?.segment || parent?.segment || "RESIDENTIAL",
      categoryId: category?.id ?? 0,
      categoryName: category?.name ?? "General",
      categorySlug: category?.slug ?? "general",
      parentId: parent?.id ?? 0,
      parentName: parent?.name ?? "General",
      parentSlug: parent?.slug ?? "general",
    };
  });

  return {
    parents,
    categories,
    subcategories,
    totalCounts: {
      parents: parents.length,
      categories: categories.length,
      subcategories: subcategories.length,
    },
  };
}
