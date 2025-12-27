"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogQuerySchema = void 0;
const zod_1 = require("zod");
const PriceFilter = zod_1.z.object({
    field: zod_1.z.literal("price"),
    op: zod_1.z.enum(["gt", "gte", "lt", "lte", "eq"]),
    value: zod_1.z.number().finite(),
});
const InFilter = zod_1.z.object({
    field: zod_1.z.enum(["category", "region", "certification"]),
    op: zod_1.z.literal("in"),
    value: zod_1.z.array(zod_1.z.string().min(1)).min(1),
});
const TextFilter = zod_1.z.object({
    field: zod_1.z.literal("text"),
    op: zod_1.z.literal("contains"),
    value: zod_1.z.string().min(1),
});
const TransportFilter = zod_1.z.object({
    field: zod_1.z.literal("transport"),
    op: zod_1.z.literal("eq"),
    value: zod_1.z.string().min(1),
});
exports.CatalogQuerySchema = zod_1.z
    .object({
    entity: zod_1.z.enum(["products", "offers"]),
    intent: zod_1.z.enum(["list", "grouped_list", "aggregate", "show_offers"]),
    filters: zod_1.z.array(zod_1.z.union([PriceFilter, InFilter, TextFilter, TransportFilter])).optional(),
    groupBy: zod_1.z.array(zod_1.z.enum(["category", "region", "certification", "transport"])).optional(),
    sort: zod_1.z
        .object({
        field: zod_1.z.literal("price"),
        direction: zod_1.z.enum(["asc", "desc"]),
    })
        .optional(),
    aggregate: zod_1.z
        .object({
        type: zod_1.z.enum(["min", "max", "count"]),
        field: zod_1.z.literal("price"),
    })
        .optional(),
    limit: zod_1.z.number().int().positive().max(50).optional(),
})
    .strict();
//# sourceMappingURL=catalog-query.schema.js.map