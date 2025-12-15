import { z } from "zod"

const PriceFilter = z.object({
  field: z.literal("price"),
  op: z.enum(["gt", "gte", "lt", "lte", "eq"]),
  value: z.number().finite(),
})

const InFilter = z.object({
  field: z.enum(["category", "region", "certification"]),
  op: z.literal("in"),
  value: z.array(z.string().min(1)).min(1),
})

const TextFilter = z.object({
  field: z.literal("text"),
  op: z.literal("contains"),
  value: z.string().min(1),
})

export const CatalogQuerySchema = z
  .object({
    entity: z.enum(["products", "offers"]),
    intent: z.enum(["list", "grouped_list", "aggregate", "show_offers"]),
    filters: z.array(z.union([PriceFilter, InFilter, TextFilter])).optional(),
    groupBy: z.array(z.enum(["category", "region", "certification"])).optional(),
    sort: z
      .object({
        field: z.literal("price"),
        direction: z.enum(["asc", "desc"]),
      })
      .optional(),
    aggregate: z
      .object({
        type: z.enum(["min", "max", "count"]),
        field: z.literal("price"),
      })
      .optional(),
    limit: z.number().int().positive().max(50).optional(),
  })
  .strict()

export type CatalogQuery = z.infer<typeof CatalogQuerySchema>
