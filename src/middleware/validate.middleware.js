import { ZodError } from "zod";

export function validate(schema) {
  return (req, res, next) => {
    try {
      const validatedData = schema.parse(req.body);

      req.validatedBody = validatedData;

      next();
    } catch (error) {

      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.flatten()
        });
      }

      next(error);
    }
  };
}