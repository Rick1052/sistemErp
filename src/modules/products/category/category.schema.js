import { z } from "zod";

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(55, "Nome deve ter no máximo 55 caracteres"),

  parentId: z
    .string()
    .uuid("parentId deve ser um UUID válido")
    .optional()
    .nullable()
}).strict();

export const updateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(55, "Nome deve ter no máximo 55 caracteres"),

  parentId: z
    .string()
    .uuid("parentId deve ser um UUID válido")
    .optional()
    .nullable()
}).strict()